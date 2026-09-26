"""Пул соединений к базе сервиса.

JSON в запросах сериализуется json_codec.dumps: NaN и бесконечности в jsonb не
пройдут, а ошибка будет понятной.
"""

from __future__ import annotations

import psycopg
from psycopg.types import json as pg_json
import psycopg_pool

from adapters import json_codec
from application import errors

_STATEMENT_TIMEOUT_MS = 15_000
_CONNECT_TIMEOUT_S = 5


def _configure(conn: psycopg.Connection) -> None:
    """Настраивает новое соединение: сериализация JSON без NaN."""
    pg_json.set_json_dumps(json_codec.dumps, context=conn)


def make_pool(
    database_url: str, min_size: int, max_size: int, timeout_s: float
) -> psycopg_pool.ConnectionPool:
    """Создаёт закрытый пул соединений; открыть — open_pool.

    Args:
        database_url: Адрес базы.
        min_size: Соединений минимум.
        max_size: Соединений максимум.
        timeout_s: Ожидание свободного соединения, с.

    Returns:
        Пул с ограничением числа соединений и таймаутом запроса.
    """
    return psycopg_pool.ConnectionPool(
        database_url,
        min_size=min_size,
        max_size=max_size,
        timeout=timeout_s,
        open=False,
        configure=_configure,
        kwargs={
            "application_name": "simulation",
            "connect_timeout": _CONNECT_TIMEOUT_S,
            "options": f"-c statement_timeout={_STATEMENT_TIMEOUT_MS}",
        },
    )


def open_pool(pool: psycopg_pool.ConnectionPool, wait_timeout_s: float) -> None:
    """Открывает пул и ждёт первого соединения.

    Raises:
        errors.StorageUnavailableError: База не ответила за wait_timeout_s.
    """
    try:
        pool.open(wait=True, timeout=wait_timeout_s)
    except (psycopg.OperationalError, psycopg_pool.PoolTimeout) as e:
        raise errors.StorageUnavailableError("база недоступна") from e
