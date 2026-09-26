"""Окружение Alembic: адрес базы из DATABASE_URL, миграции — чистым SQL.

Метаданных SQLAlchemy нет: ревизии пишутся вручную через op.execute.
Параллельные запуски `alembic upgrade` сериализуются рекомендательной
блокировкой.
"""

from __future__ import annotations

import os

from alembic import context
import sqlalchemy

# Ключ рекомендательной блокировки миграций сервиса симуляции.
_MIGRATION_LOCK_KEY = 710300001


def _url() -> str:
    """Адрес базы для SQLAlchemy с драйвером psycopg 3."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Не задан DATABASE_URL — адрес базы сервиса.")
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def _run_offline() -> None:
    """Печатает SQL миграций без подключения (alembic upgrade --sql)."""
    context.configure(url=_url(), literal_binds=True, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()


def _run_online() -> None:
    """Применяет миграции к базе под рекомендательной блокировкой."""
    engine = sqlalchemy.create_engine(_url(), poolclass=sqlalchemy.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            connection.execute(
                sqlalchemy.text("SELECT pg_advisory_xact_lock(:key)"),
                {"key": _MIGRATION_LOCK_KEY},
            )
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    _run_offline()
else:
    _run_online()
