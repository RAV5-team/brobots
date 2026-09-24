# Проверка токенов Keycloak в сервисах (Go, Python)

Как сервису принять access token Keycloak realm `rav5`: проверить подпись и claims,
достать пользователя, закрыть эндпоинты по ролям и ходить в другие сервисы сервисным токеном.
Настройки Keycloak и адреса — [keycloak.md](keycloak.md).

Проверка локальная, по публичным ключам (JWKS): Keycloak не вызывается на каждый запрос,
и при его кратком сбое уже выданные токены продолжают работать. Шлюз nginx токены не проверяет.

## 1. Что приходит от Keycloak

Запрос несёт заголовок `Authorization: Bearer <access token>`. Токен — JWT, подпись RS256.

| Claim | Пример | Использование |
| --- | --- | --- |
| `sub` | `15a60d42-7ca7-40f1-9027-ad50f2fdb713` | ID пользователя (UUID, неизменный) — ключ пользователя в БД сервиса |
| `email`, `preferred_username` | `user@example.com` | только для отображения: пользователь может их сменить |
| `realm_access.roles` | `["user", "admin", ...]` | роли realm: `user`, `admin`, `service` |
| `azp` | `rav5-web` | клиент, которому выдан токен: `rav5-web` — браузер, `rav5-api-internal` — сервисный |
| `aud` | `["rav5-api", "rav5-sim", "account"]` | для кого токен; строка или массив |
| `iss` | `http://localhost/auth/realms/rav5` | издатель; сверяется побайтно |
| `typ` | `Bearer` | `Bearer` — access token; у ID token — `ID` |
| `exp`, `iat` | unix-время | access token живёт 5 минут |

Audience, которые выдаёт realm:

| Сервис | `OIDC_AUDIENCE` | Кто получает токен с этим aud |
| --- | --- | --- |
| api | `rav5-api` | пользователи (`rav5-web`) |
| simulation | `rav5-sim` | пользователи (`rav5-web`) и сервисный клиент `rav5-api-internal` |
| economics | `rav5-economics` | только сервисный клиент `rav5-api-internal` |

## 2. Конфигурация сервиса

Только из окружения:

| Переменная | Значение в docker compose |
| --- | --- |
| `OIDC_ISSUER` | `${PUBLIC_URL}/auth/realms/rav5` — публичный, без слэша в конце |
| `OIDC_JWKS_URL` | `http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/certs` |
| `OIDC_AUDIENCE` | см. таблицу выше |
| `OIDC_TOKEN_URL` | `http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/token` — если сервис сам ходит к другим |
| `KC_CLIENT_ID`, `KC_CLIENT_SECRET` | `rav5-api-internal`, `${KC_API_INTERNAL_SECRET}` — только у вызывающего сервиса |
| `INTERNAL_CALLER_AZP` | `rav5-api-internal` — у сервисов с внутренними эндпоинтами |

Контейнер сервиса должен быть в сети `edge` (там Keycloak) или в общей с ним сети.

Не используйте OIDC discovery (`oidc.NewProvider`, `.well-known`) для построения проверки:
JWKS берётся по внутреннему адресу, а `iss` в токене публичный — discovery откажет из-за
несовпадения. Адреса задаются явно.

## 3. Правила проверки

Одинаковые во всех сервисах:

1. Разрешён только `alg: RS256`. `none`, `HS256` и любые другие — отказ до проверки подписи.
2. Подпись — ключом из JWKS по `kid` из заголовка токена.
3. JWKS кэшируется и загружается при старте. При неизвестном `kid` (ротация ключей) —
   перезагрузка, но **не чаще раза в 30 с**: иначе запросы со случайным `kid` превращаются
   в DoS на Keycloak.
4. `iss == OIDC_ISSUER` побайтно.
5. `aud` содержит `OIDC_AUDIENCE`.
6. `exp`, `nbf` — с допуском 30 с на расхождение часов. `exp` обязателен.
7. `sub` обязателен.
8. `typ == "Bearer"`: ID token и refresh token подписаны тем же ключом, но токенами доступа
   не являются.
9. Сервисный токен (роль `service`) на пользовательских эндпоинтах — 403; пользовательский
   токен на внутренних эндпоинтах — 401. Если в сервисном токене вообще нет audience сервиса
   (например, в api: `rav5-api` сервисному клиенту не выдаётся), он отклоняется раньше — 401.

Ответы с ошибкой — JSON `{"code": "...", "message": "..."}`, сообщение на русском со
способом исправления:

| Ситуация | Статус | Заголовок |
| --- | --- | --- |
| нет токена, токен невалиден, просрочен | 401 | `WWW-Authenticate: Bearer error="invalid_token"` |
| токен валиден, нет нужной роли | 403 | |
| ресурс чужой | 404 (не 403 — не раскрываем существование) | |

Прочее:

- Не логировать токены целиком. Логировать `sub` и `X-Request-Id` (его ставит шлюз).
- CORS не включать: фронтенд, API и Keycloak на одном origin.
- `GET /healthz` без токена. Готовность (`healthy`) — только после первой успешной загрузки
  JWKS, чтобы первый запрос на холодном старте не падал.
- Заголовкам `X-User-Id`, `X-User-Roles` не доверять: шлюз их затирает, но источник
  истины — только проверенный токен.
- Гость — запрос без токена. Если токен прислан, он обязан быть валидным (401), даже на
  эндпоинтах, доступных гостю.

## 4. Go

Библиотеки: [`github.com/coreos/go-oidc/v3`](https://github.com/coreos/go-oidc) (проверка
claims), [`github.com/go-jose/go-jose/v4`](https://github.com/go-jose/go-jose) (JWS),
[`golang.org/x/oauth2/clientcredentials`](https://pkg.go.dev/golang.org/x/oauth2) (сервисный токен).

```bash
go get github.com/coreos/go-oidc/v3 github.com/go-jose/go-jose/v4 golang.org/x/oauth2
```

### 4.1 Кэш ключей с ограничением перезагрузки

`oidc.NewRemoteKeySet` перезагружает JWKS на каждый неизвестный `kid` без ограничения
частоты и не умеет предзагрузку. Свой `KeySet` реализует интерфейс `oidc.KeySet`:

```go
package auth

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-jose/go-jose/v4"
)

// MinRefreshInterval — не чаще раза в 30 с перезагружаем JWKS по неизвестному kid.
const MinRefreshInterval = 30 * time.Second

type KeySet struct {
	url    string
	client *http.Client

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time

	fetchMu sync.Mutex
	ready   atomic.Bool
}

func NewKeySet(url string) *KeySet {
	return &KeySet{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

// Ready — ключи хотя бы раз загружены (для /healthz).
func (k *KeySet) Ready() bool { return k.ready.Load() }

// Refresh безусловно загружает JWKS. Вызывается при старте в цикле до успеха.
func (k *KeySet) Refresh(ctx context.Context) error {
	k.fetchMu.Lock()
	defer k.fetchMu.Unlock()
	return k.fetchLocked(ctx)
}

func (k *KeySet) fetchLocked(ctx context.Context) error {
	k.mu.Lock()
	k.lastFetch = time.Now()
	k.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.url, nil)
	if err != nil {
		return err
	}
	resp, err := k.client.Do(req)
	if err != nil {
		return fmt.Errorf("загрузка JWKS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("загрузка JWKS: статус %d", resp.StatusCode)
	}
	var set jose.JSONWebKeySet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return fmt.Errorf("разбор JWKS: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey)
	for _, key := range set.Keys {
		// В JWKS Keycloak есть и ключ шифрования (use=enc) — он не нужен.
		if pub, ok := key.Key.(*rsa.PublicKey); ok && key.KeyID != "" && (key.Use == "" || key.Use == "sig") {
			keys[key.KeyID] = pub
		}
	}
	if len(keys) == 0 {
		return errors.New("в JWKS нет RSA-ключей подписи")
	}
	k.mu.Lock()
	k.keys = keys
	k.mu.Unlock()
	k.ready.Store(true)
	return nil
}

func (k *KeySet) lookup(kid string) *rsa.PublicKey {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.keys[kid]
}

func (k *KeySet) refreshIfStale(ctx context.Context) {
	k.fetchMu.Lock()
	defer k.fetchMu.Unlock()
	k.mu.RLock()
	stale := time.Since(k.lastFetch) >= MinRefreshInterval
	k.mu.RUnlock()
	if stale {
		_ = k.fetchLocked(ctx)
	}
}

// VerifySignature реализует oidc.KeySet: только RS256, ключ по kid.
func (k *KeySet) VerifySignature(ctx context.Context, raw string) ([]byte, error) {
	jws, err := jose.ParseSigned(raw, []jose.SignatureAlgorithm{jose.RS256})
	if err != nil {
		return nil, err
	}
	if len(jws.Signatures) != 1 {
		return nil, errors.New("ожидалась одна подпись")
	}
	kid := jws.Signatures[0].Header.KeyID
	key := k.lookup(kid)
	if key == nil {
		k.refreshIfStale(ctx)
		key = k.lookup(kid)
	}
	if key == nil {
		return nil, errors.New("неизвестный kid")
	}
	return jws.Verify(key)
}
```

### 4.2 Проверка токена

```go
package auth

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

const Leeway = 30 * time.Second

var ErrInvalidToken = errors.New("невалидный токен")

// Principal — вызывающий из проверенного токена.
type Principal struct {
	Subject   string
	Email     string
	Roles     []string
	AZP       string
	IsService bool
}

func (p Principal) HasRole(role string) bool { return slices.Contains(p.Roles, role) }

type Verifier struct{ v *oidc.IDTokenVerifier }

// NewVerifier — без discovery: JWKS внутренний, iss публичный.
func NewVerifier(issuer, audience string, keys oidc.KeySet) *Verifier {
	return &Verifier{v: oidc.NewVerifier(issuer, keys, &oidc.Config{
		ClientID:             audience, // проверка aud
		SupportedSigningAlgs: []string{oidc.RS256},
		// go-oidc не даёт допуска на exp — сдвигаем «сейчас» назад.
		Now: func() time.Time { return time.Now().Add(-Leeway) },
	})}
}

func (v *Verifier) Verify(ctx context.Context, raw string) (Principal, error) {
	tok, err := v.v.Verify(ctx, raw) // подпись, iss, aud, exp
	if err != nil {
		return Principal{}, errors.Join(ErrInvalidToken, err)
	}
	var c struct {
		Typ         string `json:"typ"`
		Email       string `json:"email"`
		AZP         string `json:"azp"`
		RealmAccess struct {
			Roles []string `json:"roles"`
		} `json:"realm_access"`
	}
	if err := tok.Claims(&c); err != nil {
		return Principal{}, errors.Join(ErrInvalidToken, err)
	}
	if tok.Subject == "" || c.Typ != "Bearer" {
		return Principal{}, ErrInvalidToken
	}
	return Principal{
		Subject: tok.Subject, Email: c.Email, Roles: c.RealmAccess.Roles, AZP: c.AZP,
		IsService: slices.Contains(c.RealmAccess.Roles, "service"),
	}, nil
}
```

### 4.3 Middleware

```go
package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type ctxKey struct{}

// FromContext — принципал запроса; ok=false для гостя.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}

type Middleware struct{ verifier *Verifier }

func NewMiddleware(v *Verifier) *Middleware { return &Middleware{verifier: v} }

func writeError(w http.ResponseWriter, status int, code, message string) {
	if status == http.StatusUnauthorized {
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"code": code, "message": message})
}

func unauthorized(w http.ResponseWriter) {
	writeError(w, 401, "unauthorized", "Требуется вход в систему. Войдите заново и повторите действие.")
}

func forbidden(w http.ResponseWriter) {
	writeError(w, 403, "forbidden", "Недостаточно прав. Обратитесь к администратору платформы.")
}

// authenticate: гость (если guestOK), пользователь или ответ 401/403.
func (m *Middleware) authenticate(w http.ResponseWriter, r *http.Request, guestOK bool) (*http.Request, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		if guestOK {
			return r, true
		}
		unauthorized(w)
		return nil, false
	}
	scheme, raw, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		unauthorized(w)
		return nil, false
	}
	p, err := m.verifier.Verify(r.Context(), strings.TrimSpace(raw))
	if err != nil {
		unauthorized(w)
		return nil, false
	}
	if p.IsService { // сервисный токен на пользовательских путях
		forbidden(w)
		return nil, false
	}
	return r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)), true
}

// OptionalAuth — гость или пользователь.
func (m *Middleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r, ok := m.authenticate(w, r, true); ok {
			next.ServeHTTP(w, r)
		}
	})
}

// RequireAuth — только пользователь с валидным токеном.
func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r, ok := m.authenticate(w, r, false); ok {
			next.ServeHTTP(w, r)
		}
	})
}

// RequireRole — пользователь с ролью realm.
func (m *Middleware) RequireRole(role string, next http.Handler) http.Handler {
	return m.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if p, _ := FromContext(r.Context()); !p.HasRole(role) {
			forbidden(w)
			return
		}
		next.ServeHTTP(w, r)
	}))
}

// RequireService — внутренние эндпоинты: только сервисный токен от callerAZP.
// Пользовательский токен здесь — 401.
func (m *Middleware) RequireService(callerAZP string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		scheme, raw, _ := strings.Cut(r.Header.Get("Authorization"), " ")
		p, err := m.verifier.Verify(r.Context(), strings.TrimSpace(raw))
		if !strings.EqualFold(scheme, "Bearer") || err != nil || !p.IsService || p.AZP != callerAZP {
			unauthorized(w)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	})
}
```

### 4.4 Подключение

```go
keys := auth.NewKeySet(os.Getenv("OIDC_JWKS_URL"))
go func() { // до первого успеха /healthz отвечает 503
	for keys.Refresh(ctx) != nil {
		time.Sleep(2 * time.Second)
	}
}()
mw := auth.NewMiddleware(auth.NewVerifier(os.Getenv("OIDC_ISSUER"), os.Getenv("OIDC_AUDIENCE"), keys))

mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
	if !keys.Ready() {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
})
mux.Handle("GET /catalog", mw.OptionalAuth(http.HandlerFunc(listCatalog)))
mux.Handle("GET /projects", mw.RequireAuth(http.HandlerFunc(listProjects)))
mux.Handle("POST /admin/import", mw.RequireRole("admin", http.HandlerFunc(importFile)))
mux.Handle("POST /internal/jobs", mw.RequireService(os.Getenv("INTERNAL_CALLER_AZP"), http.HandlerFunc(createJob)))

func listProjects(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.FromContext(r.Context())
	// Владение — в самом запросе: чужой ресурс неотличим от несуществующего (404).
	// SELECT ... FROM projects WHERE owner_id = $1        -- p.Subject
	// SELECT ... FROM projects WHERE id = $1 AND owner_id = $2
}
```

### 4.5 Вызов другого сервиса сервисным токеном

Клиент сам получает токен client credentials, кэширует его и обновляет перед истечением.
Пользовательский токен дальше не передаётся.

```go
import (
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

cc := clientcredentials.Config{
	ClientID:     os.Getenv("KC_CLIENT_ID"),
	ClientSecret: os.Getenv("KC_CLIENT_SECRET"),
	TokenURL:     os.Getenv("OIDC_TOKEN_URL"), // внутренний адрес Keycloak
}
tokenHTTP := &http.Client{Timeout: 10 * time.Second}
internal := cc.Client(context.WithValue(ctx, oauth2.HTTPClient, tokenHTTP))
internal.Timeout = 90 * time.Second

resp, err := internal.Post("http://simulation:8001/internal/jobs", "application/json", body)
```

Токен из `iss` публичный даже при запросе по внутреннему адресу — принимающий сервис
проверяет его теми же правилами.

## 5. Python (FastAPI)

Библиотека — [PyJWT](https://github.com/jpadilla/pyjwt) с криптографией:

```text
PyJWT[crypto]==2.10.1
```

`python-jose` не использовать (не поддерживается).

### 5.1 Проверка токена

```python
# app/core/auth.py
from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient

LEEWAY_SECONDS = 30
MIN_REFRESH_SECONDS = 30.0


class InvalidToken(Exception):
    """Токен отсутствует, невалиден или не является access token."""


@dataclass(frozen=True)
class Principal:
    sub: str
    email: str | None
    roles: frozenset[str]
    azp: str | None
    exp: int

    @property
    def is_service(self) -> bool:
        return "service" in self.roles

    def has_role(self, role: str) -> bool:
        return role in self.roles


class TokenVerifier:
    """Синхронная проверка. При промахе кэша ключей PyJWKClient делает HTTP-запрос,
    поэтому в async-коде вызывать через run_in_threadpool."""

    def __init__(self, issuer: str, jwks_url: str, audience: str) -> None:
        self._issuer = issuer
        self._audience = audience
        self._jwks = PyJWKClient(jwks_url, cache_keys=True, timeout=10)
        self._lock = threading.Lock()
        self._last_refresh = float("-inf")

    @classmethod
    def from_env(cls) -> TokenVerifier:
        return cls(os.environ["OIDC_ISSUER"], os.environ["OIDC_JWKS_URL"], os.environ["OIDC_AUDIENCE"])

    def preload(self) -> None:
        """Загрузить JWKS при старте; до успеха сервис не healthy."""
        self._jwks.get_signing_keys(refresh=True)

    def _key_for(self, kid: str):
        def find(refresh: bool):
            return next((k for k in self._jwks.get_signing_keys(refresh=refresh) if k.key_id == kid), None)

        key = find(refresh=False)
        if key is None:  # ротация ключей: перезагрузка не чаще раза в 30 с
            with self._lock:
                if time.monotonic() - self._last_refresh >= MIN_REFRESH_SECONDS:
                    self._last_refresh = time.monotonic()
                    key = find(refresh=True)
        if key is None:
            raise InvalidToken("неизвестный kid")
        return key.key

    def verify(self, token: str) -> Principal:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
                raise InvalidToken("недопустимый заголовок")
            claims = jwt.decode(
                token,
                self._key_for(header["kid"]),
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
            raise InvalidToken(str(exc)) from exc
        if claims.get("typ") != "Bearer":  # ID token подписан тем же ключом
            raise InvalidToken("не access token")
        return Principal(
            sub=claims["sub"],
            email=claims.get("email"),
            roles=frozenset((claims.get("realm_access") or {}).get("roles") or []),
            azp=claims.get("azp"),
            exp=int(claims["exp"]),
        )
```

### 5.2 Зависимости FastAPI

```python
# app/core/deps.py
import os

from fastapi import Depends, HTTPException, Request, Security
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import InvalidToken, Principal

# Только для OpenAPI: даёт securitySchemes.bearerAuth (http, bearer, JWT).
# Заголовок разбирается вручную, чтобы присланный не-Bearer заголовок давал 401, а не «гостя».
bearer_scheme = HTTPBearer(scheme_name="bearerAuth", bearerFormat="JWT", auto_error=False)

INTERNAL_CALLER_AZP = os.environ.get("INTERNAL_CALLER_AZP", "rav5-api-internal")


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str) -> None:
        headers = {"WWW-Authenticate": 'Bearer error="invalid_token"'} if status == 401 else None
        super().__init__(status_code=status, detail={"code": code, "message": message}, headers=headers)


def unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Требуется вход в систему. Войдите заново и повторите действие.")


def forbidden() -> ApiError:
    return ApiError(403, "forbidden", "Недостаточно прав. Обратитесь к администратору платформы.")


async def _principal(request: Request) -> Principal | None:
    header = request.headers.get("authorization")
    if header is None:
        return None  # гость
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise unauthorized()
    try:
        return await run_in_threadpool(request.app.state.verifier.verify, token.strip())
    except InvalidToken:
        raise unauthorized() from None


async def optional_user(
    request: Request, _: HTTPAuthorizationCredentials | None = Security(bearer_scheme)
) -> Principal | None:
    """Гость (None) или пользователь. Сервисный токен на публичных путях — 403."""
    principal = await _principal(request)
    if principal is not None and principal.is_service:
        raise forbidden()
    return principal


async def require_user(principal: Principal | None = Depends(optional_user)) -> Principal:
    if principal is None:
        raise unauthorized()
    return principal


def require_role(role: str):
    async def dependency(principal: Principal = Depends(require_user)) -> Principal:
        if not principal.has_role(role):
            raise forbidden()
        return principal

    return dependency


async def require_service(
    request: Request, _: HTTPAuthorizationCredentials | None = Security(bearer_scheme)
) -> Principal:
    """Внутренние эндпоинты: только сервисный токен от INTERNAL_CALLER_AZP.
    Пользовательский токен — 401."""
    principal = await _principal(request)
    if principal is None or not principal.is_service or principal.azp != INTERNAL_CALLER_AZP:
        raise unauthorized()
    return principal


async def api_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    """Тело ошибки — {"code", "message"}, а не {"detail": ...}."""
    body = exc.detail if isinstance(exc.detail, dict) else {"code": "http_error", "message": str(exc.detail)}
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)
```

### 5.3 Подключение

```python
# app/main.py
import os

from fastapi import APIRouter, Depends, FastAPI, HTTPException

from app.core.auth import TokenVerifier
from app.core.deps import api_error_handler, optional_user, require_role, require_service, require_user

app = FastAPI(root_path=os.environ.get("ROOT_PATH", ""))  # префикс шлюза — для Swagger UI
app.state.verifier = TokenVerifier.from_env()
app.add_exception_handler(HTTPException, api_error_handler)

internal = APIRouter(prefix="/internal", dependencies=[Depends(require_service)])


@app.on_event("startup")
def load_keys() -> None:
    app.state.verifier.preload()  # упадёт, если Keycloak недоступен — контейнер перезапустится


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, user=Depends(optional_user)):
    job = registry.get(job_id)
    if job is None or (not job.demo and (user is None or job.owner_id != user.sub)):
        raise not_found()  # чужая задача — 404
    return job


@app.post("/admin/norms")
async def upload_norms(admin=Depends(require_role("admin"))): ...


@internal.post("/jobs", status_code=201)
async def create_job(body: JobCreate): ...


app.include_router(internal)
```

### 5.4 WebSocket

Браузер не может поставить заголовок `Authorization` на WebSocket, а токен в URL попадает в
логи. Поэтому токен передаётся **первым сообщением**:

1. Проверить `Origin` против `ALLOWED_WS_ORIGIN` (`${PUBLIC_URL}`); не совпал — закрыть 1008.
2. `accept()`, ждать `{"type": "auth", "token": "..."}` не дольше 5 с.
3. Невалидный токен или таймаут — закрыть 4401; ресурс чужой или не найден — 4404.
4. `{"type": "reauth", "token": "..."}` продлевает сессию (тот же `sub`); без него соединение
   закрывается по наступлении `exp` кодом 4401.
5. Токен из query string не читать никогда.

```python
import asyncio
import time

from fastapi import WebSocket
from fastapi.concurrency import run_in_threadpool

from app.core.auth import InvalidToken


@app.websocket("/jobs/{job_id}/stream")
async def stream(ws: WebSocket, job_id: str) -> None:
    origin = ws.headers.get("origin")
    await ws.accept()
    if origin != os.environ["ALLOWED_WS_ORIGIN"]:
        return await ws.close(code=1008)
    try:
        msg = await asyncio.wait_for(ws.receive_json(), timeout=5)
        principal = await run_in_threadpool(ws.app.state.verifier.verify, msg["token"])
    except (asyncio.TimeoutError, ValueError, KeyError, TypeError, InvalidToken):
        return await ws.close(code=4401)
    if principal.is_service:
        return await ws.close(code=4403)
    job = registry.get(job_id)
    if job is None or job.owner_id != principal.sub:
        return await ws.close(code=4404)

    deadline = principal.exp
    # Дальше: цикл отправки событий + приём reauth. По истечении deadline — ws.close(code=4401).
    # При reauth: проверить новый токен, sub должен совпадать, deadline = новый exp.
```

### 5.5 Вызов другого сервиса сервисным токеном

```python
import time

import httpx


class ServiceTokenClient:
    """Кэширует токен client credentials и обновляет его за 30 с до истечения."""

    def __init__(self, token_url: str, client_id: str, secret: str) -> None:
        self._form = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret}
        self._token_url = token_url
        self._token: str | None = None
        self._expires_at = 0.0

    async def token(self, http: httpx.AsyncClient) -> str:
        if self._token is None or time.monotonic() > self._expires_at - 30:
            resp = await http.post(self._token_url, data=self._form, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            self._token, self._expires_at = data["access_token"], time.monotonic() + data["expires_in"]
        return self._token


async def calculate(http: httpx.AsyncClient, tokens: ServiceTokenClient, payload: dict) -> dict:
    headers = {"Authorization": f"Bearer {await tokens.token(http)}"}
    resp = await http.post("http://economics:8002/calculate", json=payload, headers=headers)
    resp.raise_for_status()
    return resp.json()
```

## 6. Тестирование

### Юнит-тесты без Keycloak

Сгенерируйте RSA-ключ в тесте, отдайте JWKS фейковым сервером (Go — `httptest.Server`,
Python — объект с методом `get_signing_keys`) и подписывайте токены с нужными claims.
Обязательные случаи:

| Токен | Ожидание |
| --- | --- |
| валидный access token | принят, роли и `sub` извлечены |
| `alg: none`; `alg: HS256` | 401 |
| изменённая подпись; изменённый payload | 401 |
| просрочен больше чем на 30 с; просрочен на 10 с | 401; принят |
| `iss` другой или с `/` на конце | 401 |
| `aud` без аудитории сервиса | 401 |
| `typ: ID` (ID token) | 401 |
| нет `sub`, нет `exp` | 401 |
| неизвестный `kid` 5 раз подряд | JWKS загружен не больше одного раза за 30 с |
| сервисный токен на пользовательском пути; пользовательский на `/internal/*` | 403; 401 |
| ресурс другого `sub` | 404 |

Пример выпуска токена в Python-тестах:

```python
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
now = int(time.time())
token = jwt.encode(
    {"iss": "http://localhost/auth/realms/rav5", "aud": ["rav5-sim"], "sub": "alice", "typ": "Bearer",
     "azp": "rav5-web", "iat": now, "exp": now + 300, "realm_access": {"roles": ["user"]}},
    key, algorithm="RS256", headers={"kid": "k1"},
)
```

### Против настоящего Keycloak

Поднимите `docker compose up -d --build`.

Сервисный токен:

```bash
curl -s http://localhost/auth/realms/rav5/protocol/openid-connect/token \
  -d grant_type=client_credentials -d client_id=rav5-api-internal \
  -d client_secret="$(grep ^KC_API_INTERNAL_SECRET .env | cut -d= -f2)" | jq -r .access_token
```

Пользовательский токен: у клиента `rav5-web` вход по паролю выключен (только PKCE), поэтому
для тестов используйте поток из `scripts/auth_smoke.py`:

```python
import sys; sys.path.insert(0, "scripts")
import auth_smoke as a
tokens = a.Browser(insecure=False).login("user@example.com", a.ENV["DEMO_USER_PASSWORD"])
print(tokens["access_token"])
```

## 7. Частые ошибки

| Симптом | Причина |
| --- | --- |
| Вход работает, все запросы к сервису — 401 | `OIDC_ISSUER` не совпадает с `iss` побайтно: другая схема, порт, слэш в конце. Сравните с `issuer` в `/auth/realms/rav5/.well-known/openid-configuration` |
| 401, в логе ошибка audience | неверный `OIDC_AUDIENCE` или токен выдан не тем клиентом |
| Ошибка «issuer did not match» при старте | использован discovery (`oidc.NewProvider`) — адреса задаются явно |
| Все токены стали невалидными после `docker compose down -v` | ключи подписи пересозданы; JWKS подтянется сам по новому `kid`, пользователям нужно войти заново. `sub` пользователей тоже новые |
| Токен истёк во время долгой операции | пользовательский токен живёт 5 минут; для фоновых вызовов между сервисами — сервисный токен |
| Сервис тормозит на каждом запросе | JWKS загружается без кэша; нужен кэш и перезагрузка только по неизвестному `kid` |
| Выход из системы не отключил пользователя сразу | access token действует до `exp` (до 5 минут) — это ограничение локальной проверки |
