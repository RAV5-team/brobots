#!/usr/bin/env python3
"""Smoke-тесты Keycloak RAV5: Postgres (БД keycloak), Keycloak, шлюз nginx на /auth.

Только стандартная библиотека. Внешние проверки идут через шлюз (PUBLIC_URL), внутренние —
через `docker compose exec`. Вход эмулирует браузер: authorization code + PKCE S256 через
настоящие формы Keycloak.

    ./scripts/auth-smoke.sh              # профиль из .env
    ./scripts/auth-smoke.sh --restart    # + перезапуск Keycloak
    ./scripts/auth-smoke.sh --insecure   # stand с самоподписанным сертификатом
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import http.cookiejar
import json
import os
import re
import secrets
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent.parent
DEMO_USER = "user@example.com"
DEMO_ADMIN = "admin@example.com"
ACCESS_TOKEN_LIFESPAN = 300
# Таблиц в схеме Keycloak заведомо больше: признак, что Keycloak сам накатил миграции.
MIN_KEYCLOAK_TABLES = 50


# --------------------------------------------------------------------------- окружение


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


ENV = read_env()
PUBLIC_URL = ENV["PUBLIC_URL"].rstrip("/")
ISSUER = f"{PUBLIC_URL}/auth/realms/rav5"
OIDC = f"{ISSUER}/protocol/openid-connect"
INTERNAL_OIDC = "http://keycloak:8080/auth/realms/rav5/protocol/openid-connect"
IS_STAND = PUBLIC_URL.startswith("https://")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt_claims(token: str) -> dict[str, Any]:
    payload = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


def audiences(claims: dict[str, Any]) -> set[str]:
    aud = claims.get("aud", [])
    return set(aud if isinstance(aud, list) else [aud])


def realm_roles(claims: dict[str, Any]) -> set[str]:
    return set(claims.get("realm_access", {}).get("roles", []))


# --------------------------------------------------------------------------- HTTP-клиент


class _LocalhostSecurePolicy(http.cookiejar.DefaultCookiePolicy):
    """Как браузеры: http://localhost — защищённый контекст, Secure-cookie Keycloak туда отправляются."""

    def return_ok_secure(self, cookie: http.cookiejar.Cookie, request: urllib.request.Request) -> bool:
        if urllib.parse.urlsplit(request.full_url).hostname in ("localhost", "127.0.0.1"):
            return True
        return super().return_ok_secure(cookie, request)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


@dataclass
class Resp:
    status: int
    headers: dict[str, str]
    body: str

    def json(self) -> Any:
        return json.loads(self.body or "null")


class Client:
    """HTTP-клиент с cookie и без автоматических редиректов."""

    def __init__(self, insecure: bool) -> None:
        handlers: list[Any] = [
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(_LocalhostSecurePolicy())),
            _NoRedirect(),
        ]
        if insecure:
            # Только по явному --insecure: stand с самоподписанным сертификатом.
            handlers.append(urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        self.opener = urllib.request.build_opener(*handlers)

    def request(self, url: str, *, data: dict[str, str] | None = None, token: str | None = None,
                method: str | None = None) -> Resp:
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        headers = {"Accept-Language": "ru"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            resp = self.opener.open(req, timeout=30)
        except urllib.error.HTTPError as exc:
            resp = exc
        return Resp(resp.status, {k.lower(): v for k, v in resp.headers.items()},
                    resp.read().decode("utf-8", "replace"))


class Browser(Client):
    """Клиент rav5-web: authorization code + PKCE S256, формы входа и регистрации."""

    FORM_RE = re.compile(r'<form[^>]*id="(kc-form-login|kc-register-form)"[^>]*action="([^"]+)"', re.S)

    def __init__(self, insecure: bool) -> None:
        super().__init__(insecure)
        self.verifier = b64url(secrets.token_bytes(32))
        self.redirect_uri = f"{PUBLIC_URL}/"

    def open_form(self, endpoint: str = "auth") -> str:
        challenge = b64url(hashlib.sha256(self.verifier.encode()).digest())
        query = urllib.parse.urlencode({
            "client_id": "rav5-web", "redirect_uri": self.redirect_uri, "response_type": "code",
            "response_mode": "fragment", "scope": "openid", "state": secrets.token_hex(8),
            "nonce": secrets.token_hex(8), "code_challenge": challenge, "code_challenge_method": "S256",
        })
        resp = self.request(f"{OIDC}/{endpoint}?{query}")
        expect(resp.status == 200, f"страница {endpoint}: {resp.status}")
        return resp.body

    def post_form(self, page: str, fields: dict[str, str]) -> Resp:
        match = self.FORM_RE.search(page)
        expect(match is not None, "на странице нет формы Keycloak")
        return self.request(html.unescape(match.group(2)), data=fields)

    def submit(self, page: str, fields: dict[str, str]) -> str:
        resp = self.post_form(page, fields)
        location = resp.headers.get("location", "")
        expect(resp.status == 302 and location.startswith(self.redirect_uri),
               f"после формы: {resp.status} {location[:120]} {re.sub(r'<[^>]+>', ' ', resp.body)[:200]!r}")
        fragment = urllib.parse.parse_qs(urllib.parse.urlsplit(location).fragment)
        expect("code" in fragment, f"нет code во фрагменте: {location[:120]}")
        return fragment["code"][0]

    def exchange(self, code: str) -> dict[str, Any]:
        resp = self.request(f"{OIDC}/token", data={
            "grant_type": "authorization_code", "client_id": "rav5-web", "code": code,
            "redirect_uri": self.redirect_uri, "code_verifier": self.verifier,
        })
        expect(resp.status == 200, f"обмен кода: {resp.status} {resp.body[:200]}")
        return resp.json()

    def login(self, username: str, password: str) -> dict[str, Any]:
        return self.exchange(self.submit(self.open_form(), {"username": username, "password": password}))


# --------------------------------------------------------------------------- docker


def compose(*args: str, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["docker", "compose", *args], cwd=ROOT, text=True, capture_output=True,
                          timeout=timeout, env=os.environ)


def psql(sql: str, *, db: str = "postgres") -> str:
    proc = compose("exec", "-T", "postgres", "psql", "-U", ENV["POSTGRES_USER"], "-d", db, "-At", "-c", sql)
    expect(proc.returncode == 0, f"psql: {proc.stderr.strip()}")
    return proc.stdout.strip()


def gateway_wget(url: str, post_data: dict[str, str] | None = None) -> str:
    """Запрос изнутри Docker-сети (контейнер gateway, busybox wget) — как ходят клиенты Keycloak."""
    args = ["exec", "-T", "gateway", "wget", "-qO-"]
    if post_data is not None:
        args += ["--post-data", urllib.parse.urlencode(post_data)]
    proc = compose(*args, url)
    expect(proc.returncode == 0, f"{url} изнутри сети: {proc.stderr.strip()}")
    return proc.stdout


def started_at(service: str) -> str:
    container = compose("ps", "-q", service).stdout.strip()
    proc = subprocess.run(["docker", "inspect", "-f", "{{.State.StartedAt}}", container],
                          text=True, capture_output=True, timeout=30)
    return proc.stdout.strip()


def wait_healthy(service: str, timeout: int) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if compose("ps", "--format", "{{.Health}}", service).stdout.strip() == "healthy":
            return
        time.sleep(3)
    raise AssertionError(f"{service} не стал healthy за {timeout} с")


# --------------------------------------------------------------------------- раннер


class Skip(Exception):
    pass


def expect(cond: bool, message: str) -> None:
    if not cond:
        raise AssertionError(message)


class Runner:
    MARKS = {"PASS": "\033[32mPASS\033[0m", "FAIL": "\033[31mFAIL\033[0m", "SKIP": "\033[33mSKIP\033[0m"}

    def __init__(self) -> None:
        self.statuses: list[str] = []

    def check(self, test_id: str, title: str, fn: Callable[[], str | None]) -> None:
        started = time.time()
        try:
            status, detail = "PASS", fn() or ""
        except Skip as exc:
            status, detail = "SKIP", str(exc)
        except AssertionError as exc:
            status, detail = "FAIL", str(exc) or "assertion"
        except Exception as exc:  # noqa: BLE001 — любая ошибка проверки = провал
            status, detail = "FAIL", f"{type(exc).__name__}: {exc}"
        self.statuses.append(status)
        suffix = f" — {detail}" if detail else ""
        print(f"{self.MARKS[status]} {test_id:<4} {title} ({time.time() - started:.1f}s){suffix}", flush=True)

    def summary(self) -> int:
        counts = {s: self.statuses.count(s) for s in ("PASS", "FAIL", "SKIP")}
        print(f"\nИтого: {counts['PASS']} passed, {counts['FAIL']} failed, {counts['SKIP']} skipped")
        return 1 if counts["FAIL"] else 0


# --------------------------------------------------------------------------- проверки


class Smoke:
    def __init__(self, insecure: bool) -> None:
        self.insecure = insecure
        self.http = Client(insecure)
        self.user_tokens: dict[str, Any] = {}

    def need_user(self) -> dict[str, Any]:
        if not self.user_tokens:
            raise Skip("нет сессии демо-пользователя (T4 не прошёл)")
        return self.user_tokens

    def t2_healthz(self) -> str:
        resp = self.http.request(f"{PUBLIC_URL}/healthz")
        expect(resp.status == 200, f"статус {resp.status}")
        return "200"

    def t3_discovery(self) -> str:
        resp = self.http.request(f"{ISSUER}/.well-known/openid-configuration")
        expect(resp.status == 200, f"статус {resp.status}")
        conf = resp.json()
        expect(conf["issuer"] == ISSUER, f"issuer {conf['issuer']!r} != {ISSUER!r}")
        expect(conf["jwks_uri"] == f"{OIDC}/certs", f"jwks_uri {conf['jwks_uri']!r}")
        expect("S256" in conf.get("code_challenge_methods_supported", []), "нет PKCE S256")
        return conf["issuer"]

    def t_internal_url(self) -> str:
        conf = json.loads(gateway_wget("http://keycloak:8080/auth/realms/rav5/.well-known/openid-configuration"))
        expect(conf["issuer"] == ISSUER, f"issuer изнутри {conf['issuer']!r}")
        expect(conf["jwks_uri"] == f"{INTERNAL_OIDC}/certs", f"jwks_uri {conf['jwks_uri']!r}")
        keys = json.loads(gateway_wget(conf["jwks_uri"]))["keys"]
        expect(any(k.get("alg") == "RS256" and k.get("use") == "sig" for k in keys), "нет ключа RS256")
        return f"issuer публичный, JWKS по {INTERNAL_OIDC}/certs, ключ RS256"

    def t_postgres(self) -> str:
        role = ENV["KC_DB_USERNAME"]
        owner = psql("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'keycloak'")
        expect(owner == role, f"владелец БД keycloak: {owner!r}")
        expect(psql(f"SELECT rolsuper FROM pg_roles WHERE rolname = '{role}'") == "f",
               "роль Keycloak — суперпользователь")
        expect(psql("SELECT has_database_privilege('public', 'keycloak', 'CONNECT')") == "f",
               "к БД keycloak может подключиться любая роль")
        tables = int(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
                          db="keycloak") or 0)
        expect(tables > MIN_KEYCLOAK_TABLES, f"схема Keycloak не создана: {tables} таблиц")
        return f"владелец {owner}, не суперпользователь, CONNECT для PUBLIC отозван; схема Keycloak — {tables} таблиц"

    def t4_login(self) -> str:
        browser = Browser(self.insecure)
        page = browser.open_form()
        expect('lang="ru"' in page, "страница входа не на русском")
        tokens = browser.exchange(browser.submit(page, {"username": DEMO_USER,
                                                        "password": ENV["DEMO_USER_PASSWORD"]}))
        userinfo = self.http.request(f"{OIDC}/userinfo", token=tokens["access_token"])
        expect(userinfo.status == 200 and userinfo.json().get("email") == DEMO_USER,
               f"userinfo: {userinfo.status}")
        self.user_tokens = tokens

        wrong = Browser(self.insecure)
        resp = wrong.post_form(wrong.open_form(), {"username": DEMO_USER, "password": "wrong-password"})
        expect(resp.status == 200 and "location" not in resp.headers, f"неверный пароль: {resp.status}")
        return "страница ru, PKCE S256, code во фрагменте, userinfo 200; неверный пароль отклонён"

    def t7_token_claims(self) -> str:
        tokens = self.need_user()
        access = jwt_claims(tokens["access_token"])
        expect(access["iss"] == ISSUER, f"iss {access['iss']!r}")
        expect(access.get("typ") == "Bearer" and access.get("azp") == "rav5-web", "typ/azp")
        expect({"rav5-api", "rav5-sim"} <= audiences(access), f"aud {sorted(audiences(access))}")
        expect("user" in realm_roles(access) and "admin" not in realm_roles(access),
               f"роли {sorted(realm_roles(access))}")
        expect(access["exp"] - access["iat"] == ACCESS_TOKEN_LIFESPAN, "access token должен жить 5 минут")
        id_token = jwt_claims(tokens["id_token"])
        expect(id_token.get("typ") == "ID" and "rav5-api" not in audiences(id_token),
               f"ID token: typ {id_token.get('typ')}, aud {sorted(audiences(id_token))}")
        return f"iss ok, aud {sorted(audiences(access))}, роль user, 5 мин; у ID token нет aud rav5-api"

    def t8_admin_role(self) -> str:
        tokens = Browser(self.insecure).login(DEMO_ADMIN, ENV["DEMO_ADMIN_PASSWORD"])
        roles = realm_roles(jwt_claims(tokens["access_token"]))
        expect({"user", "admin"} <= roles, f"роли администратора: {sorted(roles)}")
        return "admin@example.com: роли user + admin"

    def t5_registration(self) -> str:
        browser = Browser(self.insecure)
        email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"
        password = f"Pw-{secrets.token_hex(6)}"
        code = browser.submit(browser.open_form("registrations"), {
            "email": email, "firstName": "Смоук", "lastName": "Тест",
            "password": password, "password-confirm": password})
        roles = realm_roles(jwt_claims(browser.exchange(code)["access_token"]))
        expect("user" in roles and "admin" not in roles, f"роли нового пользователя: {sorted(roles)}")
        return f"{email}: роль user"

    def t14_service_token(self) -> str:
        form = {"grant_type": "client_credentials", "client_id": "rav5-api-internal",
                "client_secret": ENV["KC_API_INTERNAL_SECRET"]}
        external = self.http.request(f"{OIDC}/token", data=form)
        expect(external.status == 200, f"через шлюз: {external.status} {external.body[:200]}")
        internal = json.loads(gateway_wget(f"{INTERNAL_OIDC}/token", form))
        for label, token in (("через шлюз", external.json()["access_token"]),
                             ("внутренний адрес", internal["access_token"])):
            claims = jwt_claims(token)
            expect(claims["iss"] == ISSUER, f"{label}: iss {claims['iss']!r}")
            expect({"rav5-sim", "rav5-economics"} <= audiences(claims), f"{label}: aud {audiences(claims)}")
            expect("service" in realm_roles(claims), f"{label}: роли {realm_roles(claims)}")
        bad = self.http.request(f"{OIDC}/token", data={**form, "client_secret": "wrong"})
        expect(bad.status == 401, f"неверный секрет: {bad.status}")
        return "iss публичный в обоих случаях, роль service; неверный секрет — 401"

    def t17_closed_paths(self) -> str:
        reg = self.http.request(f"{ISSUER}/clients-registrations/default", data={}, method="POST")
        expect(reg.status == 404, f"clients-registrations: {reg.status}")
        health = self.http.request(f"{PUBLIC_URL}/auth/health/ready")
        expect(health.status == 404, f"management-эндпоинт снаружи: {health.status}")
        other = self.http.request(f"{PUBLIC_URL}/anything")
        expect(other.status == 404, f"путь вне /auth: {other.status}")
        cidr = ENV.get("ADMIN_ALLOW_CIDR", "0.0.0.0/0")
        if cidr in ("0.0.0.0/0", ""):
            return "DCR 404, health 404, вне /auth 404; админка открыта (local), 403 — в stand"
        admin = self.http.request(f"{PUBLIC_URL}/auth/admin/")
        master = self.http.request(f"{PUBLIC_URL}/auth/realms/master/")
        expect(admin.status == 403 and master.status == 403, f"allowlist: {admin.status}, {master.status}")
        return "DCR 404, health 404, вне /auth 404; /auth/admin/ и master — 403"

    def t21_password_hashes(self) -> str:
        row = psql("SELECT c.secret_data || '|' || c.credential_data FROM credential c "
                   f"JOIN user_entity u ON u.id = c.user_id WHERE u.username = '{DEMO_USER}' "
                   "AND c.type = 'password'", db="keycloak")
        expect(row, "нет записи пароля")
        expect(ENV["DEMO_USER_PASSWORD"] not in row, "пароль хранится в открытом виде")
        algorithm = json.loads(row.split("|", 1)[1]).get("algorithm", "?")
        expect(algorithm.startswith(("pbkdf2", "argon2")), f"алгоритм {algorithm}")
        return f"хэш, алгоритм {algorithm}"

    def t20_logout(self) -> str:
        tokens = self.need_user()
        logout = self.http.request(f"{OIDC}/logout", data={
            "client_id": "rav5-web", "refresh_token": tokens["refresh_token"]})
        expect(logout.status == 204, f"logout: {logout.status} {logout.body[:200]}")
        refresh = self.http.request(f"{OIDC}/token", data={
            "grant_type": "refresh_token", "client_id": "rav5-web", "refresh_token": tokens["refresh_token"]})
        expect(refresh.status == 400 and "invalid_grant" in refresh.body,
               f"refresh после выхода: {refresh.status}")
        return "refresh после выхода — invalid_grant; access token действует до exp (≤ 5 мин)"

    def t22_stand(self) -> str:
        if not IS_STAND:
            raise Skip("только профиль stand")
        plain = self.http.request(PUBLIC_URL.replace("https://", "http://", 1) + "/auth/")
        expect(plain.status == 301 and plain.headers.get("location", "").startswith("https://"),
               f"HTTP: {plain.status} {plain.headers.get('location')}")
        secure = self.http.request(f"{ISSUER}/.well-known/openid-configuration")
        hsts = secure.headers.get("strict-transport-security", "")
        expect("max-age=" in hsts, f"HSTS: {hsts!r}")
        return f"301 -> https, HSTS {hsts}"

    def t18_restart(self) -> str:
        tokens = Browser(self.insecure).login(DEMO_USER, ENV["DEMO_USER_PASSWORD"])
        gateway_before = started_at("gateway")
        proc = compose("restart", "keycloak", timeout=180)
        expect(proc.returncode == 0, f"restart keycloak: {proc.stderr}")
        wait_healthy("keycloak", 480)
        expect(started_at("gateway") == gateway_before, "шлюз перезапускался")
        discovery = self.http.request(f"{ISSUER}/.well-known/openid-configuration")
        expect(discovery.status == 200, f"шлюз после перезапуска Keycloak: {discovery.status}")
        after = self.http.request(f"{OIDC}/userinfo", token=tokens["access_token"])
        expect(after.status == 200, f"токен, выданный до перезапуска: {after.status}")
        refreshed = self.http.request(f"{OIDC}/token", data={
            "grant_type": "refresh_token", "client_id": "rav5-web", "refresh_token": tokens["refresh_token"]})
        expect(refreshed.status == 200, f"refresh после перезапуска: {refreshed.status}")
        return "шлюз не перезапускался; токен и сессия пережили перезапуск Keycloak"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--restart", action="store_true", help="перезапустить Keycloak и проверить сессии")
    parser.add_argument("--insecure", action="store_true", help="не проверять TLS-сертификат (stand)")
    args = parser.parse_args()

    print(f"RAV5 Keycloak smoke: {PUBLIC_URL} ({'stand' if IS_STAND else 'local'})\n")
    runner = Runner()
    s = Smoke(args.insecure)
    runner.check("T2", "GET /healthz через шлюз", s.t2_healthz)
    runner.check("T3", "discovery: issuer, jwks_uri, PKCE", s.t3_discovery)
    runner.check("INT", "внутренний адрес Keycloak, iss публичный", s.t_internal_url)
    runner.check("PG", "Postgres: БД keycloak и её роль", s.t_postgres)
    runner.check("T4", "вход демо-пользователем (PKCE, страница на русском)", s.t4_login)
    runner.check("T7", "состав токенов пользователя", s.t7_token_claims)
    runner.check("T8", "роль admin у администратора платформы", s.t8_admin_role)
    runner.check("T5", "регистрация нового пользователя", s.t5_registration)
    runner.check("T14", "сервисный токен client credentials", s.t14_service_token)
    runner.check("T17", "закрытые пути: DCR, health, админка", s.t17_closed_paths)
    runner.check("T21", "пароли в БД — хэши", s.t21_password_hashes)
    runner.check("T20", "выход из системы", s.t20_logout)
    runner.check("T22", "stand: редирект на https и HSTS", s.t22_stand)
    if args.restart:
        runner.check("T18", "перезапуск Keycloak", s.t18_restart)
    return runner.summary()


if __name__ == "__main__":
    sys.exit(main())
