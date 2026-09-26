"""Запуск сервиса: коды выхода и расчёт сценария для воркера."""

from __future__ import annotations

import gzip
import json
import queue

from alembic import command
from alembic import config as alembic_config
import conftest
import pytest

from adapters import json_codec
from adapters.processes import child
from app import runtime


def test_bad_settings_exit_with_code_2(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(SystemExit) as e:
        runtime.start()

    assert e.value.code == runtime.EXIT_CONFIG


def test_unreachable_database_exits_with_code_1(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://sim:sim@127.0.0.1:1/x")
    monkeypatch.setenv("SIM_DB_CONNECT_WAIT_S", "0.5")

    with pytest.raises(SystemExit) as e:
        runtime.start()

    assert e.value.code == runtime.EXIT_DATABASE


@pytest.mark.db
def test_outdated_schema_exits_with_code_3(migrated_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", migrated_url)
    cfg = alembic_config.Config("alembic.ini")
    command.downgrade(cfg, "base")
    try:
        with pytest.raises(SystemExit) as e:
            runtime.start()
    finally:
        command.upgrade(cfg, "head")

    assert e.value.code == runtime.EXIT_SCHEMA


@pytest.mark.db
def test_migrated_database_starts(migrated_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", migrated_url)

    settings, pool, repo = runtime.start()
    try:
        assert repo.is_ready()
        assert settings.database_url == migrated_url
    finally:
        pool.close()


def test_scenario_result_is_ready_to_store():
    """То, что считает дочерний процесс воркера, — в текущем процессе."""
    progress: queue.Queue = queue.Queue()

    run, traces_gz, raw_bytes = child.run_scenario(
        conftest.request_body(), conftest.scenario(), "0" * 32, progress
    )

    assert json_codec.dumps(run)  # без NaN — годится для jsonb
    traces = json.loads(gzip.decompress(traces_gz))
    assert traces[0]["name"].startswith("Из подбора")
    assert raw_bytes > len(traces_gz)
    assert not progress.empty()


def test_server_without_oidc_settings_exits_with_code_2():
    with pytest.raises(SystemExit) as e:
        runtime.token_verifier(conftest.config.Settings(database_url="x"))

    assert e.value.code == runtime.EXIT_CONFIG


def test_token_verifier_is_built_from_settings():
    settings = conftest.config.Settings(
        database_url="x",
        oidc_issuer="http://localhost/auth/realms/rav5",
        oidc_jwks_url="http://127.0.0.1:1/certs",
        oidc_audience="rav5-sim",
    )

    assert not runtime.token_verifier(settings).is_ready()
