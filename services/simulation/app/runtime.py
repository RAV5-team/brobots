"""Корень сборки: настройки, база, проверка схемы и связывание слоёв.

Только здесь известны конкретные адаптеры: PostgreSQL, дочерние процессы,
потоки воркеров. Коды выхода: 2 — неверные настройки, 1 — база недоступна,
3 — схема базы не той ревизии (нужно `alembic upgrade head`).
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
import uuid

import psycopg_pool

from adapters.auth import jwks
from adapters.postgres import pool as pg_pool
from adapters.postgres import repository
from adapters.processes import child
from adapters.processes import runner
from adapters.web import server as web_server
from adapters.worker import loop
from app import config
from application import errors
from application import models
from application import ports
from application import preview
from application import process_job
from application import submit

_log = logging.getLogger(__name__)

EXIT_CONFIG = 2
EXIT_DATABASE = 1
EXIT_SCHEMA = 3


def start() -> tuple[
    config.Settings,
    psycopg_pool.ConnectionPool,
    repository.PostgresJobRepository,
]:
    """Читает настройки, подключается к базе и проверяет ревизию схемы.

    Returns:
        (настройки, открытый пул, хранилище заданий).

    Raises:
        SystemExit: Настройки неверны, база недоступна или схема устарела.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        settings = config.Settings.from_env(os.environ)
    except config.ConfigError as e:
        _log.error("настройки: %s", e)
        sys.exit(EXIT_CONFIG)
    for handler in logging.getLogger().handlers:
        handler.addFilter(settings.secret_filter())
    pool = pg_pool.make_pool(
        settings.database_url,
        settings.db_pool_min,
        settings.db_pool_max,
        settings.db_pool_timeout_s,
    )
    try:
        pg_pool.open_pool(pool, settings.db_connect_wait_s)
        revision = repository.schema_revision(pool)
    except errors.StorageUnavailableError as e:
        _log.error(
            "база %s недоступна: %s",
            settings.masked_database_url(),
            e.__cause__,
        )
        pool.close()
        sys.exit(EXIT_DATABASE)
    if revision != repository.EXPECTED_REVISION:
        _log.error(
            "схема базы: ревизия %s, нужна %s — alembic upgrade head",
            revision,
            repository.EXPECTED_REVISION,
        )
        pool.close()
        sys.exit(EXIT_SCHEMA)
    return settings, pool, repository.PostgresJobRepository(pool)


def new_id() -> str:
    """Номер задания или прогона: uuid4 в hex."""
    return uuid.uuid4().hex


def token_verifier(
    settings: config.Settings,
) -> jwks.JwksTokenVerifier | None:
    """Проверка токенов Keycloak по настройкам OIDC_*.

    Returns:
        Проверка; None — dev-режим без Keycloak.

    Raises:
        SystemExit: OIDC_* не заданы (код EXIT_CONFIG).
    """
    try:
        settings.require_oidc()
    except config.ConfigError as e:
        _log.error("настройки: %s", e)
        sys.exit(EXIT_CONFIG)
    if not settings.oidc_enabled:  # TODO(dev-auth): только dev-режим
        return None
    return jwks.JwksTokenVerifier.from_url(
        settings.oidc_issuer, settings.oidc_audience, settings.oidc_jwks_url
    )


def dev_principal(settings: config.Settings) -> models.Principal | None:
    """Пользователь dev-режима; None — режим выключен.

    TODO(dev-auth): удалить вместе с dev-режимом.
    """
    if not settings.auth_dev_mode:
        return None
    _log.warning(
        "AUTH DEV MODE: запросы без токена идут от %s (роли %s)"
        " — не включайте вне локальной разработки",
        settings.auth_dev_sub,
        ",".join(settings.auth_dev_roles),
    )
    return models.Principal(
        sub=settings.auth_dev_sub,
        email=None,
        roles=frozenset(settings.auth_dev_roles),
        azp="dev",
    )


def http_services(
    repo: repository.PostgresJobRepository,
    verifier: ports.TokenVerifier | None,
    internal_caller_azp: str = "rav5-api-internal",
    dev: models.Principal | None = None,
) -> web_server.Services:
    """Сценарии и порты для HTTP API поверх хранилища."""
    return web_server.Services(
        submit=submit.SubmitVerification(repo, new_id),
        preview=preview.preview_demand,
        reader=repo,
        health=repo,
        verifier=verifier,
        internal_caller_azp=internal_caller_azp,
        dev_principal=dev,
    )


def job_executor(
    repo: repository.PostgresJobRepository,
    settings: config.Settings,
    worker_id: str,
    target: child.Target = child.run_scenario,
) -> process_job.JobExecutor:
    """Исполнитель заданий: очередь в PostgreSQL, расчёт в процессах.

    Args:
        repo: Хранилище заданий.
        settings: Настройки: интервал подтверждений.
        worker_id: Имя воркера для диагностики.
        target: Расчёт сценария в дочернем процессе.
    """
    return process_job.JobExecutor(
        repo,
        runner.ProcessScenarioRunner(target),
        worker_id,
        new_id=new_id,
        clock=time.monotonic,
        heartbeat_s=settings.heartbeat_s,
        max_parallel=os.cpu_count() or 1,
    )


def worker_loop(
    repo: repository.PostgresJobRepository,
    settings: config.Settings,
    worker_id: str,
    target: child.Target = child.run_scenario,
) -> loop.WorkerLoop:
    """Цикл воркера поверх исполнителя заданий."""
    return loop.WorkerLoop(
        job_executor(repo, settings, worker_id, target),
        poll_interval_s=settings.poll_interval_s,
        retry_s=settings.heartbeat_s,
        stale_after_s=settings.stale_after_s,
    )


def start_workers(
    repo: repository.PostgresJobRepository,
    settings: config.Settings,
    stop: threading.Event,
    count: int,
) -> list[tuple[threading.Thread, loop.WorkerLoop]]:
    """Запускает count воркеров потоками текущего процесса."""
    return loop.start_threads(
        lambda wid: worker_loop(repo, settings, wid), stop, count
    )
