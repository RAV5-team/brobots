"""Общие данные и фикстуры тестов шага «Симуляция».

Тесты с меткой db работают с настоящим PostgreSQL из TEST_DATABASE_URL (имя
базы обязано содержать «test»: таблицы очищаются перед каждым тестом). Без
адреса такие тесты пропускаются; с SIM_REQUIRE_DB=1 — падают.
"""

from __future__ import annotations

import os
from typing import Any
from urllib import parse

from alembic import command
from alembic import config as alembic_config
import pytest

from adapters.postgres import pool as pg_pool
from adapters.postgres import repository
from app import config
from simcore import verify

# Денежные ключи: в контракте их нет — ни в запросе, ни в ответе.
MONEY_KEYS = frozenset(
    {
        "economics",
        "economics_basis",
        "economics_preview",
        "norms_version",
        "charger_break_even_robots",
        "price_rub",
        "capex_total",
        "payback_years",
    }
)


def all_keys(node: object) -> set[str]:
    """Собирает ключи всех словарей во вложенной структуре."""
    if isinstance(node, dict):
        keys = set(node)
        for value in node.values():
            keys |= all_keys(value)
        return keys
    if isinstance(node, list):
        keys = set()
        for value in node:
            keys |= all_keys(value)
        return keys
    return set()


# Маленькая задача: 8 ч в сутки, 190 автоматизируемых рейсов, парк с запасом —
# прогон занимает секунды.
CALC = dict(
    peak_trips_h=35.625,
    avg_trips_h=23.75,
    route_len_m=100.0,
    cycle_s=342.0,
    eff_prod=8.0,
    n_util=0.8,
    n_kv=0.6,
    n_avail=0.95,
    n_reserve=0.15,
)


def request_body(**over: Any) -> dict:
    """Запрос шага «Симуляция» для теста.

    Ключи верхнего уровня можно переопределить.
    """
    cfg = dict(
        configuration_id="cfg-test",
        robot_count=6,
        charger_count=2,
        robot=dict(
            name="Тестовый робот",
            v_max=1.5,
            autonomy_h=10,
            charge_time_min=90,
            t_load_s=60,
            t_unload_s=60,
            width_mm=1000,
        ),
        calc=dict(CALC),
    )
    body = dict(
        configuration=cfg,
        location=dict(
            active_area_m2=4000,
            aisle_main_m=3.5,
            aisle_rack_m=2.8,
            speed_limit_m_s=1.5,
        ),
        task=dict(
            in_per_day=100,
            out_per_day=100,
            manual_share=0.05,
            peak_k=1.5,
            shift_start_h=8,
            shifts=1,
            shift_h=8,
        ),
    )
    body.update(over)
    return body


def scenario(**groups: Any) -> dict:
    """Сценарий шага симуляции: по умолчанию с разрешённым уменьшением парка."""
    sp = dict(
        verification=dict(
            fleet_policy="add_and_reduce",
            design_volume="current",
            tolerance=0.10,
        )
    )
    for group, value in groups.items():
        if isinstance(value, dict):
            sp.setdefault(group, {}).update(value)
        else:
            sp[group] = value
    return dict(name="Тестовый сценарий", simulation_params=sp)


@pytest.fixture(scope="session")
def verified() -> dict:
    """Один прогон продуктового пути на всю сессию тестов.

    Прогон стоит секунды, поэтому переиспользуется всеми тестами.
    """
    return verify.run_verification(
        request_body(), scenario(), with_trace=False, simulation_id="0" * 32
    ).run


def _test_database_url() -> str:
    """Адрес тестовой базы; пропуск теста, если базы нет."""
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url:
        if os.environ.get("SIM_REQUIRE_DB") == "1":
            pytest.fail("SIM_REQUIRE_DB=1, но TEST_DATABASE_URL не задан")
        pytest.skip("нужен PostgreSQL: задайте TEST_DATABASE_URL")
    name = parse.urlsplit(url).path.lstrip("/")
    if "test" not in name:
        pytest.fail(f"база {name!r} — не тестовая: в имени нет «test»")
    return url


def settings(**over: Any) -> config.Settings:
    """Настройки сервиса для тестов: быстрые таймауты, без воркеров."""
    values = {
        "database_url": _test_database_url(),
        "workers": 0,
        "poll_interval_s": 0.05,
        "heartbeat_s": 0.2,
        "stale_after_s": 1.0,
        "db_pool_timeout_s": 2.0,
    }
    values.update(over)
    return config.Settings(**values)


@pytest.fixture(name="migrated_url", scope="session")
def _migrated_url_fixture() -> str:
    """Тестовая база со схемой последней ревизии."""
    url = _test_database_url()
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = url
    try:
        command.upgrade(alembic_config.Config("alembic.ini"), "head")
    finally:
        if previous is None:
            del os.environ["DATABASE_URL"]
        else:
            os.environ["DATABASE_URL"] = previous
    return url


@pytest.fixture(name="pool", scope="session")
def _pool_fixture(migrated_url: str):
    """Пул соединений к тестовой базе на всю сессию."""
    del migrated_url  # нужна только схема
    cfg = settings()
    pool = pg_pool.make_pool(
        cfg.database_url,
        cfg.db_pool_min,
        cfg.db_pool_max,
        cfg.db_pool_timeout_s,
    )
    pg_pool.open_pool(pool, wait_timeout_s=10)
    yield pool
    pool.close()


@pytest.fixture(name="repo")
def _repo_fixture(pool) -> repository.PostgresJobRepository:
    """Хранилище с пустыми таблицами."""
    with pool.connection() as conn:
        conn.execute("TRUNCATE run_traces, runs, jobs")
    return repository.PostgresJobRepository(pool)
