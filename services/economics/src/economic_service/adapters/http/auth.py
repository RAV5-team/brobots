"""Service-token access to the economics API (docs/keycloak/middleware.md).

Economics is called only by the api orchestrator with its own client-credentials
token: realm role ``service`` and ``azp`` equal to INTERNAL_CALLER_AZP. A user
token, a foreign service token, no token or a bad token get 401. Tokens are
verified locally by the Keycloak public keys (JWKS), as in services/simulation.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

import jwt
from fastapi import Request
from starlette.concurrency import run_in_threadpool

LOGGER = logging.getLogger(__name__)
LEEWAY_SECONDS = 30
# A JWKS reload on an unknown kid happens at most every 30 s: random kids must
# not turn into a DoS on Keycloak.
MIN_REFRESH_SECONDS = 30.0
SERVICE_ROLE = "service"
_UNAUTHORIZED = (
    "Сервис расчёта принимает только вызовы оркестратора api с его "
    "сервисным токеном."
)


class InvalidTokenError(Exception):
    """The token is not accepted."""


class ServiceAuthError(Exception):
    """A 401 answer in the {"code", "message"} form of the platform."""

    status = 401
    code = "unauthorized"
    message = _UNAUTHORIZED


@dataclass(frozen=True, slots=True)
class Caller:
    """The verified caller of a request."""

    sub: str
    azp: str | None
    roles: frozenset[str]


class TokenVerifier(Protocol):
    """Port of the token check: the JWKS verifier or a test double."""

    def verify(self, token: str) -> Caller:
        """Returns the caller or raises InvalidTokenError."""

    def is_ready(self) -> bool:
        """The keys are loaded at least once."""


class SigningKeys(Protocol):
    """Source of the signing keys: PyJWKClient or a test double."""

    def get_signing_keys(self, refresh: bool = False) -> list[jwt.PyJWK]:
        """Keys with use=sig; refresh=True reloads them."""


class JwksTokenVerifier:
    """Checks RS256 signature, iss, aud, exp, sub and typ of access tokens."""

    def __init__(
        self,
        issuer: str,
        audience: str,
        keys: SigningKeys,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._issuer = issuer
        self._audience = audience
        self._keys = keys
        self._clock = clock
        self._lock = threading.Lock()
        self._last_refresh = float("-inf")
        self._ready = threading.Event()

    @classmethod
    def from_url(
        cls, issuer: str, audience: str, jwks_url: str
    ) -> JwksTokenVerifier:
        """Verifier by the internal JWKS address of Keycloak (no discovery)."""

        return cls(issuer, audience, jwt.PyJWKClient(jwks_url, timeout=10))

    def is_ready(self) -> bool:
        return self._ready.is_set()

    def preload_until_ready(
        self, stop: threading.Event, retry_s: float = 2.0
    ) -> None:
        """Loads the JWKS until it succeeds: Keycloak starts longer."""

        while not stop.is_set():
            try:
                self._keys.get_signing_keys(refresh=True)
                self._ready.set()
                return
            except jwt.PyJWKClientError as error:
                LOGGER.warning("Keycloak keys are not loaded yet: %s", error)
            stop.wait(retry_s)

    def _find(self, kid: str, refresh: bool) -> jwt.PyJWK | None:
        keys = self._keys.get_signing_keys(refresh=refresh)
        self._ready.set()
        return next((key for key in keys if key.key_id == kid), None)

    def _key_for(self, kid: str) -> Any:
        key = self._find(kid, refresh=False)
        if key is None:  # key rotation: reload at most every 30 s
            with self._lock:
                if self._clock() - self._last_refresh >= MIN_REFRESH_SECONDS:
                    self._last_refresh = self._clock()
                    key = self._find(kid, refresh=True)
        if key is None:
            raise InvalidTokenError("unknown kid")
        return key.key

    def verify(self, token: str) -> Caller:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if header.get("alg") != "RS256" or not isinstance(kid, str):
                raise InvalidTokenError("unsupported header")
            claims = jwt.decode(
                token,
                self._key_for(kid),
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as error:
            raise InvalidTokenError(str(error)) from error
        # ID and refresh tokens are signed with the same key but grant nothing.
        if claims.get("typ") != "Bearer" or not claims["sub"]:
            raise InvalidTokenError("not an access token")
        realm_access = claims.get("realm_access") or {}
        return Caller(
            sub=claims["sub"],
            azp=claims.get("azp"),
            roles=frozenset(realm_access.get("roles") or []),
        )


@dataclass(frozen=True, slots=True)
class ServiceAuth:
    """The access rule of the API: only the service token of the caller."""

    verifier: TokenVerifier
    caller_azp: str

    async def check(self, request: Request) -> Caller:
        header = request.headers.get("authorization") or ""
        scheme, _, token = header.partition(" ")
        token = token.strip()
        if scheme.lower() != "bearer" or not token:
            raise ServiceAuthError()
        try:
            caller = await run_in_threadpool(self.verifier.verify, token)
        except InvalidTokenError:
            raise ServiceAuthError() from None
        if SERVICE_ROLE not in caller.roles or caller.azp != self.caller_azp:
            raise ServiceAuthError()
        return caller


async def require_service(request: Request) -> Caller | None:
    """FastAPI dependency; None when the service runs without auth (dev)."""

    auth: ServiceAuth | None = request.app.state.service_auth
    if auth is None:
        return None
    return await auth.check(request)
