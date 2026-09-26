"""Миграции Alembic: ревизия кода, откат и совпадение схемы с контрактом."""

from __future__ import annotations

import os
import re

from alembic import command
from alembic import config as alembic_config
from alembic import script
import pytest

from adapters.postgres import repository
from adapters.web import openapi

pytestmark = pytest.mark.db


def _alembic() -> alembic_config.Config:
    return alembic_config.Config("alembic.ini")


def test_code_expects_the_latest_revision():
    head = script.ScriptDirectory.from_config(_alembic()).get_current_head()

    assert repository.EXPECTED_REVISION == head


def test_downgrade_and_upgrade_again(migrated_url, pool, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", migrated_url)

    command.downgrade(_alembic(), "base")
    command.upgrade(_alembic(), "head")

    assert repository.schema_revision(pool) == repository.EXPECTED_REVISION


def test_run_statuses_match_the_contract(pool):
    with pool.connection() as conn:
        check = conn.execute(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint"
            " WHERE conrelid = 'runs'::regclass AND contype = 'c'"
            " AND pg_get_constraintdef(oid) LIKE '%%confirmed%%'"
        ).fetchone()[0]
    allowed = set(re.findall(r"'(\w+)'", check))
    run_schema = openapi.spec()["components"]["schemas"]["SimulationRun"]

    assert allowed == set(run_schema["properties"]["status"]["enum"])


def test_traces_are_not_recompressed(pool):
    with pool.connection() as conn:
        storage = conn.execute(
            "SELECT attstorage FROM pg_attribute"
            " WHERE attrelid = 'run_traces'::regclass AND attname = 'traces_gz'"
        ).fetchone()[0]

    assert storage == "e"


def test_database_url_is_required_for_migrations(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        command.upgrade(_alembic(), "head", sql=True)
    assert "DATABASE_URL" not in os.environ
