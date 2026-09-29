"""Доступ к HTTP API: зависимости FastAPI поверх порта проверки токенов.

Правила — docs/keycloak/middleware.md, раздел 3:

    гость           — запрос без Authorization; пути заданий ему закрыты (401);
    присланный токен обязан быть валидным (401) даже там, где пускают гостя;
    сервисный токен на пользовательских путях — 403;
    внутренние пути — только сервисный токен от INTERNAL_CALLER_AZP, любой
    другой — 401.

Ответ 401/403 — {"code", "message"}; у 401 — WWW-Authenticate.
"""

from __future__ import annotations

from typing import Annotated
import uuid

import fastapi
from fastapi import concurrency

from application import errors
from application import models
from application import ports

_UNAUTHORIZED = "Требуется вход в систему. Войдите заново и повторите действие."
_FORBIDDEN = "Недостаточно прав. Обратитесь к администратору платформы."


class AuthError(Exception):
    """Отказ в доступе: 401 или 403 в формате {"code", "message"}.

    Attributes:
        status: HTTP-код.
        code: Машинный код: unauthorized или forbidden.
        message: Текст на русском со способом исправления.
    """

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message

    def headers(self) -> dict[str, str] | None:
        """Заголовки ответа: у 401 — схема и причина по RFC 6750."""
        if self.status == 401:
            return {"WWW-Authenticate": 'Bearer error="invalid_token"'}
        return None


def unauthorized() -> AuthError:
    """401: токена нет там, где он нужен, или он не принят."""
    return AuthError(401, "unauthorized", _UNAUTHORIZED)


def forbidden() -> AuthError:
    """403: токен валиден, но прав нет."""
    return AuthError(403, "forbidden", _FORBIDDEN)


# TODO(dev-auth): удалить вместе с dev-режимом.
DEV_USER_HEADER = "x-dev-user"


def _verifier(request: fastapi.Request) -> ports.TokenVerifier | None:
    return request.app.state.services.verifier


def _dev_principal(request: fastapi.Request) -> models.Principal | None:
    """Пользователь dev-режима; X-Dev-User подменяет sub. None — режим выключен.

    TODO(dev-auth): удалить вместе с dev-режимом.
    """
    dev = request.app.state.services.dev_principal
    sub = (request.headers.get(DEV_USER_HEADER) or "").strip()
    if dev is None or not sub:
        return dev
    try:
        uuid.UUID(sub)
    except ValueError:
        raise unauthorized() from None
    return models.Principal(sub=sub, email=None, roles=dev.roles, azp=dev.azp)


async def _principal(request: fastapi.Request) -> models.Principal | None:
    """Вызывающий по заголовку Authorization; None — гость."""
    header = request.headers.get("authorization")
    if header is None:
        return _dev_principal(request)
    scheme, _, token = header.partition(" ")
    token = token.strip()
    verifier = _verifier(request)
    if scheme.lower() != "bearer" or not token or verifier is None:
        raise unauthorized()
    try:
        return await concurrency.run_in_threadpool(verifier.verify, token)
    except errors.InvalidTokenError:
        raise unauthorized() from None


async def optional_user(
    request: fastapi.Request,
) -> models.Principal | None:
    """Гость (None) или пользователь; сервисный токен — 403."""
    principal = await _principal(request)
    if principal is not None and principal.is_service:
        raise forbidden()
    return principal


async def require_user(request: fastapi.Request) -> models.Principal:
    """Пользователь; гость — 401, сервисный токен — 403.

    Задания пользователей видны только им, а гость проверяет демо-проект
    через api: api ставит его задание на внутренний путь от своего имени.
    """
    principal = await optional_user(request)
    if principal is None:
        raise unauthorized()
    return principal


async def require_service(request: fastapi.Request) -> models.Principal:
    """Внутренние пути: только сервисный токен от INTERNAL_CALLER_AZP."""
    principal = await _principal(request)
    caller = request.app.state.services.internal_caller_azp
    if principal is None or not principal.is_service or principal.azp != caller:
        raise unauthorized()
    return principal


OptionalUser = Annotated[
    models.Principal | None, fastapi.Depends(optional_user)
]
User = Annotated[models.Principal, fastapi.Depends(require_user)]
Service = Annotated[models.Principal, fastapi.Depends(require_service)]
