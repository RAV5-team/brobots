"""Настройки сервиса из переменных окружения.

DATABASE_URL обязателен: без базы сервис не работает. OIDC_* нужны серверу
(проверка токенов Keycloak), воркеру — нет. Остальное — с умолчаниями;
неверные значения останавливают запуск с понятным сообщением.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
import dataclasses
import logging
from urllib import parse


class ConfigError(ValueError):
    """Переменная окружения не задана или задана неверно."""


class SecretFilter(logging.Filter):
    """Вычищает секрет из записей журнала: текста, аргументов, трассировки.

    Ставится на обработчики журнала, поэтому действует на все записи, в
    том числе с exc_info, которые пишут текст исключения целиком.
    """

    def __init__(self, secret: str) -> None:
        """Запоминает секрет; пустой — фильтр ничего не меняет."""
        super().__init__()
        self._secret = secret
        self._formatter = logging.Formatter()

    def filter(self, record: logging.LogRecord) -> bool:
        """Подменяет текст записи и трассировку на версии без секрета."""
        if not self._secret:
            return True
        record.msg = record.getMessage().replace(self._secret, "***")
        record.args = None
        if record.exc_info and not record.exc_text:
            record.exc_text = self._formatter.formatException(record.exc_info)
        if record.exc_text:
            record.exc_text = record.exc_text.replace(self._secret, "***")
        return True


def _read(
    env: Mapping[str, str],
    name: str,
    cast: Callable[[str], float],
    default: float,
    minimum: float,
) -> float:
    """Читает число из окружения с проверкой нижней границы."""
    raw = env.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = cast(raw)
    except ValueError as e:
        raise ConfigError(f"{name}: ожидается число, получено {raw!r}") from e
    if value < minimum:
        raise ConfigError(f"{name}: не меньше {minimum}, получено {value}")
    return value


@dataclasses.dataclass(frozen=True)
class Settings:
    """Настройки сервиса.

    Attributes:
        database_url: Адрес базы (DATABASE_URL).
        port: Порт HTTP (PORT).
        db_pool_min: Соединений в пуле минимум (SIM_DB_POOL_MIN).
        db_pool_max: Соединений в пуле максимум (SIM_DB_POOL_MAX).
        db_pool_timeout_s: Ожидание свободного соединения, с; дольше —
            ответ 503 (SIM_DB_POOL_TIMEOUT_S).
        db_connect_wait_s: Ожидание базы при запуске, с
            (SIM_DB_CONNECT_WAIT_S).
        workers: Воркеров заданий в процессе сервера; 0 — только API
            (SIM_WORKERS).
        poll_interval_s: Пауза между проверками очереди, с
            (SIM_POLL_INTERVAL_S).
        heartbeat_s: Как часто воркер подтверждает, что жив, с
            (SIM_HEARTBEAT_S).
        stale_after_s: Через сколько без подтверждения задание возвращается
            в очередь, с (SIM_STALE_AFTER_S).
        oidc_issuer: Издатель токенов, сверяется с iss побайтно
            (OIDC_ISSUER).
        oidc_jwks_url: Внутренний адрес JWKS Keycloak (OIDC_JWKS_URL).
        oidc_audience: Аудитория сервиса в aud (OIDC_AUDIENCE).
        internal_caller_azp: Клиент, которому открыты внутренние пути
            (INTERNAL_CALLER_AZP).
    """

    database_url: str
    port: int = 8765
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_pool_timeout_s: float = 5.0
    db_connect_wait_s: float = 30.0
    workers: int = 1
    poll_interval_s: float = 1.0
    heartbeat_s: float = 5.0
    stale_after_s: float = 60.0
    oidc_issuer: str = ""
    oidc_jwks_url: str = ""
    oidc_audience: str = ""
    internal_caller_azp: str = "rav5-api-internal"

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> Settings:
        """Собирает настройки из окружения.

        Args:
            env: Переменные окружения (обычно os.environ).

        Returns:
            Настройки.

        Raises:
            ConfigError: Переменная не задана или задана неверно.
        """
        url = env.get("DATABASE_URL", "")
        if not url:
            raise ConfigError("DATABASE_URL: не задан адрес базы сервиса")
        settings = cls(
            database_url=url,
            port=int(_read(env, "PORT", int, 8765, 1)),
            db_pool_min=int(_read(env, "SIM_DB_POOL_MIN", int, 1, 0)),
            db_pool_max=int(_read(env, "SIM_DB_POOL_MAX", int, 10, 1)),
            db_pool_timeout_s=_read(
                env, "SIM_DB_POOL_TIMEOUT_S", float, 5, 0.1
            ),
            db_connect_wait_s=_read(env, "SIM_DB_CONNECT_WAIT_S", float, 30, 0),
            workers=int(_read(env, "SIM_WORKERS", int, 1, 0)),
            poll_interval_s=_read(env, "SIM_POLL_INTERVAL_S", float, 1, 0.05),
            heartbeat_s=_read(env, "SIM_HEARTBEAT_S", float, 5, 0.1),
            stale_after_s=_read(env, "SIM_STALE_AFTER_S", float, 60, 1),
            oidc_issuer=env.get("OIDC_ISSUER", ""),
            oidc_jwks_url=env.get("OIDC_JWKS_URL", ""),
            oidc_audience=env.get("OIDC_AUDIENCE", ""),
            internal_caller_azp=env.get(
                "INTERNAL_CALLER_AZP", "rav5-api-internal"
            ),
        )
        if settings.oidc_issuer.endswith("/"):
            raise ConfigError(
                "OIDC_ISSUER: без слэша в конце — iss сверяется побайтно"
            )
        if settings.stale_after_s <= 3 * settings.heartbeat_s:
            raise ConfigError(
                "SIM_STALE_AFTER_S: должен быть больше трёх SIM_HEARTBEAT_S"
            )
        if settings.db_pool_min > settings.db_pool_max:
            raise ConfigError("SIM_DB_POOL_MIN: больше SIM_DB_POOL_MAX")
        return settings

    def require_oidc(self) -> None:
        """Проверяет, что заданы настройки проверки токенов (для сервера).

        Raises:
            ConfigError: Не задана одна из OIDC_*.
        """
        for name, value in (
            ("OIDC_ISSUER", self.oidc_issuer),
            ("OIDC_JWKS_URL", self.oidc_jwks_url),
            ("OIDC_AUDIENCE", self.oidc_audience),
        ):
            if not value:
                raise ConfigError(
                    f"{name}: не задан — нужен для проверки токенов"
                )

    def secret_filter(self) -> SecretFilter:
        """Фильтр журнала, вычищающий пароль базы из всех записей."""
        return SecretFilter(parse.urlsplit(self.database_url).password or "")

    def masked_database_url(self) -> str:
        """Адрес базы без пароля — для журнала."""
        parts = parse.urlsplit(self.database_url)
        if parts.password is None:
            return self.database_url
        netloc = parts.netloc.replace(f":{parts.password}@", ":***@", 1)
        return parse.urlunsplit(parts._replace(netloc=netloc))
