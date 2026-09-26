"""Проверка access token Keycloak realm rav5 по публичным ключам (JWKS).

Проверка локальная: Keycloak не вызывается на каждый запрос, и при его
кратком сбое уже выданные токены продолжают работать. Правила —
docs/keycloak/middleware.md, раздел 3.
"""

from __future__ import annotations

from collections.abc import Callable
import logging
import threading
import time
from typing import Any, Protocol

import jwt

from application import errors
from application import models

LEEWAY_SECONDS = 30
# Не чаще раза в 30 с перезагружаем JWKS по неизвестному kid: иначе запросы со
# случайным kid превращаются в DoS на Keycloak.
MIN_REFRESH_SECONDS = 30.0

_log = logging.getLogger(__name__)


class SigningKeys(Protocol):
    """Источник ключей подписи: PyJWKClient или двойник в тестах."""

    def get_signing_keys(self, refresh: bool = False) -> list[jwt.PyJWK]:
        """Ключи use=sig; refresh=True — загрузить заново."""


class JwksTokenVerifier:
    """Проверка токенов: подпись RS256, iss, aud, exp, sub, typ.

    Синхронная: при промахе кэша ключей делает HTTP-запрос, поэтому в
    async-коде вызывается через пул потоков.
    """

    def __init__(
        self,
        issuer: str,
        audience: str,
        keys: SigningKeys,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        """Проверяет токены издателя issuer для аудитории audience."""
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
        """Проверка по JWKS Keycloak по внутреннему адресу (без discovery)."""
        return cls(issuer, audience, jwt.PyJWKClient(jwks_url, timeout=10))

    def is_ready(self) -> bool:
        """Ключи загружены хотя бы раз — сервис можно считать готовым."""
        return self._ready.is_set()

    def preload(self) -> None:
        """Загружает JWKS; ошибка — jwt.PyJWKClientError."""
        self._keys.get_signing_keys(refresh=True)
        self._ready.set()

    def preload_until_ready(
        self, stop: threading.Event, retry_s: float = 2.0
    ) -> None:
        """Повторяет preload до успеха или stop: Keycloak стартует дольше."""
        while not stop.is_set():
            try:
                self.preload()
                return
            except jwt.PyJWKClientError as e:
                _log.warning("ключи Keycloak ещё не загружены: %s", e)
            stop.wait(retry_s)

    def _find(self, kid: str, refresh: bool) -> jwt.PyJWK | None:
        keys = self._keys.get_signing_keys(refresh=refresh)
        self._ready.set()
        return next((k for k in keys if k.key_id == kid), None)

    def _key_for(self, kid: str) -> Any:
        key = self._find(kid, refresh=False)
        if key is None:  # ротация ключей: перезагрузка не чаще раза в 30 с
            with self._lock:
                if self._clock() - self._last_refresh >= MIN_REFRESH_SECONDS:
                    self._last_refresh = self._clock()
                    key = self._find(kid, refresh=True)
        if key is None:
            raise errors.InvalidTokenError("неизвестный kid")
        return key.key

    def verify(self, token: str) -> models.Principal:
        """Проверяет access token и возвращает вызывающего.

        Raises:
            errors.InvalidTokenError: Токен не принят.
        """
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if header.get("alg") != "RS256" or not isinstance(kid, str):
                raise errors.InvalidTokenError("недопустимый заголовок")
            claims = jwt.decode(
                token,
                self._key_for(kid),
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as e:
            raise errors.InvalidTokenError(str(e)) from e
        # ID token и refresh token подписаны тем же ключом, но доступа не дают.
        if claims.get("typ") != "Bearer" or not claims["sub"]:
            raise errors.InvalidTokenError("не access token")
        realm_access = claims.get("realm_access") or {}
        return models.Principal(
            sub=claims["sub"],
            email=claims.get("email"),
            roles=frozenset(realm_access.get("roles") or []),
            azp=claims.get("azp"),
        )
