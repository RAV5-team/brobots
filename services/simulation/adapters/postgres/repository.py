"""Репозиторий заданий — весь SQL сервиса.

Очередь заданий живёт в таблице jobs: воркер забирает задание через
FOR UPDATE SKIP LOCKED, поэтому экземпляров сервиса может быть несколько.
Токен владения (lease) растёт при каждом захвате и никогда не уменьшается:
после возврата задания в очередь старый воркер уже не может ни писать журнал,
ни сохранить результат. Счётчик попыток (attempts) — отдельный: он ограничивает
повторы после сбоев и не тратится, когда воркер отпускает задание при
остановке.

Удаления нет: строки помечаются deleted_at и перестают быть видны. Задание,
помеченное удалённым, скрывает свои прогоны и трассы.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
import contextlib
from typing import Any

import psycopg
from psycopg.types import json as pg_json
import psycopg_pool

from application import errors
from application import models

# Ревизия Alembic, под которую написан этот код.
EXPECTED_REVISION = "0002"
# Задание видно viewer: без владельца — всем, с владельцем — только ему.
# viewer = NULL (гость) даёт NULL в сравнении, то есть «не видно».
_VISIBLE = "(j.owner_sub IS NULL OR j.owner_sub = %(viewer)s)"

_INTERRUPTED = "Задание прервано: сервис перезапускался во время расчёта."
_REQUEUED = "Воркер перестал отвечать — задание возвращено в очередь."


@contextlib.contextmanager
def _connection(
    pool: psycopg_pool.ConnectionPool,
) -> Iterator[psycopg.Connection]:
    """Соединение из пула; потеря связи — StorageUnavailableError.

    Raises:
        errors.StorageUnavailableError: Базы нет, соединение оборвалось, пул
            исчерпан или запрос превысил statement_timeout.
    """
    try:
        with pool.connection() as conn:
            yield conn
    except (psycopg.OperationalError, psycopg_pool.PoolTimeout) as e:
        raise errors.StorageUnavailableError("хранилище недоступно") from e


def schema_revision(pool: psycopg_pool.ConnectionPool) -> str | None:
    """Текущая ревизия схемы базы; None — миграции не применялись.

    Raises:
        errors.StorageUnavailableError: База недоступна.
    """
    with _connection(pool) as conn:
        exists = conn.execute(
            "SELECT to_regclass('alembic_version') IS NOT NULL"
        ).fetchone()
        if not exists or not exists[0]:
            return None
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
    return row[0] if row else None


class PostgresJobRepository:
    """Задания, прогоны и трассы в PostgreSQL.

    Реализует порты JobSubmission, JobQueue, ResultReader и StorageHealth.
    Потеря связи с базой в любом методе — errors.StorageUnavailableError.
    """

    def __init__(self, pool: psycopg_pool.ConnectionPool) -> None:
        """Запоминает пул соединений; каждый метод берёт своё соединение."""
        self._pool = pool

    def is_ready(self) -> bool:
        """True — база доступна и схема ревизии EXPECTED_REVISION."""
        try:
            return schema_revision(self._pool) == EXPECTED_REVISION
        except errors.StorageUnavailableError:
            return False

    def create_job(
        self,
        job_id: str,
        request: Mapping[str, Any],
        scenarios: Sequence[Mapping[str, Any]],
        simulation_version: str,
        *,
        owner_sub: str | None = None,
    ) -> None:
        """Ставит задание в очередь (статус queued); owner_sub — владелец."""
        with _connection(self._pool) as conn:
            conn.execute(
                "INSERT INTO jobs"
                " (job_id, simulation_version, request, scenarios, owner_sub)"
                " VALUES (%s, %s, %s, %s, %s)",
                (
                    job_id,
                    simulation_version,
                    pg_json.Jsonb(dict(request)),
                    pg_json.Jsonb(list(scenarios)),
                    owner_sub,
                ),
            )

    def claim_next_job(self, worker_id: str) -> models.ClaimedJob | None:
        """Забирает самое старое задание из очереди.

        Args:
            worker_id: Кто забирает — для диагностики.

        Returns:
            Задание со статусом running; None, если очередь пуста.
        """
        with _connection(self._pool) as conn:
            row = conn.execute(
                """
                UPDATE jobs j SET status = 'running', attempts = j.attempts + 1,
                       lease = j.lease + 1, worker_id = %s, started_at = now(),
                       heartbeat_at = now()
                 WHERE j.job_id = (SELECT job_id FROM jobs
                                    WHERE status = 'queued'
                                      AND deleted_at IS NULL
                                    ORDER BY created_at, job_id
                                    FOR UPDATE SKIP LOCKED LIMIT 1)
                RETURNING j.job_id, j.lease, j.request, j.scenarios
                """,
                (worker_id,),
            ).fetchone()
        if row is None:
            return None
        return models.ClaimedJob(
            job_id=row[0], lease=row[1], request=row[2], scenarios=row[3]
        )

    def heartbeat(
        self,
        job_id: str,
        lease: int,
        lines: Sequence[str] = (),
        workers: int | None = None,
    ) -> bool:
        """Подтверждает, что воркер жив, и дописывает журнал.

        Returns:
            False — задание больше не принадлежит этому захвату.
        """
        with _connection(self._pool) as conn:
            cur = conn.execute(
                """
                UPDATE jobs SET heartbeat_at = now(), log = log || %s,
                       workers = coalesce(%s, workers)
                 WHERE job_id = %s AND lease = %s AND status = 'running'
                   AND deleted_at IS NULL
                """,
                (pg_json.Jsonb(list(lines)), workers, job_id, lease),
            )
            return cur.rowcount == 1

    def finish_job(
        self,
        job_id: str,
        lease: int,
        runs: Sequence[models.FinishedRun],
        lines: Sequence[str] = (),
    ) -> bool:
        """Сохраняет прогоны и трассы и завершает задание — одной транзакцией.

        Returns:
            False — задание больше не принадлежит этому захвату; ничего не
            сохранено.
        """
        with _connection(self._pool) as conn, conn.transaction():
            owned = conn.execute(
                "SELECT 1 FROM jobs WHERE job_id = %s AND lease = %s"
                " AND status = 'running' AND deleted_at IS NULL FOR UPDATE",
                (job_id, lease),
            ).fetchone()
            if owned is None:
                return False
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO runs (simulation_id, job_id, scenario_index,
                                      scenario_name, configuration_id, status,
                                      simulation_version, result)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [_run_row(job_id, r) for r in runs],
                )
                cur.executemany(
                    "INSERT INTO run_traces"
                    " (simulation_id, traces_gz, raw_bytes)"
                    " VALUES (%s, %s, %s)",
                    [
                        (
                            r.simulation_id,
                            r.traces.gzip_json,
                            r.traces.raw_bytes,
                        )
                        for r in runs
                    ],
                )
            conn.execute(
                "UPDATE jobs SET status = 'done', finished_at = now(),"
                " heartbeat_at = now(), log = log || %s"
                " WHERE job_id = %s AND lease = %s",
                (pg_json.Jsonb(list(lines)), job_id, lease),
            )
        return True

    def fail_job(
        self,
        job_id: str,
        lease: int,
        error: str,
        field_errors: Sequence[Mapping[str, str]] | None,
        detail: str | None,
    ) -> bool:
        """Завершает задание ошибкой.

        Args:
            job_id: Номер задания.
            lease: Токен владения.
            error: Текст ошибки для клиента.
            field_errors: Ошибки входа по полям; None — ошибка не во входе.
            detail: Трассировка стека — только в базе, не в API.

        Returns:
            False — задание больше не принадлежит этому захвату.
        """
        with _connection(self._pool) as conn:
            cur = conn.execute(
                """
                UPDATE jobs SET status = 'error', finished_at = now(),
                       error = %s, errors = %s, error_detail = %s
                 WHERE job_id = %s AND lease = %s AND status = 'running'
                   AND deleted_at IS NULL
                """,
                (
                    error,
                    (
                        None
                        if field_errors is None
                        else pg_json.Jsonb([dict(e) for e in field_errors])
                    ),
                    detail,
                    job_id,
                    lease,
                ),
            )
            return cur.rowcount == 1

    def release_job(self, job_id: str, lease: int) -> bool:
        """Возвращает задание в очередь при остановке, не тратя попытку.

        Returns:
            False — задание больше не принадлежит этому захвату.
        """
        with _connection(self._pool) as conn:
            cur = conn.execute(
                """
                UPDATE jobs SET status = 'queued', attempts = attempts - 1,
                       worker_id = NULL, started_at = NULL, heartbeat_at = NULL
                 WHERE job_id = %s AND lease = %s AND status = 'running'
                   AND deleted_at IS NULL
                """,
                (job_id, lease),
            )
            return cur.rowcount == 1

    def requeue_stale(self, stale_after_s: float, max_attempts: int) -> int:
        """Возвращает в очередь задания, чей воркер перестал отвечать.

        Задание, исчерпавшее попытки, завершается ошибкой.

        Args:
            stale_after_s: Сколько секунд без подтверждения считать зависанием.
            max_attempts: Сколько попыток даётся заданию.

        Returns:
            Сколько заданий обработано.
        """
        with _connection(self._pool) as conn:
            cur = conn.execute(
                """
                WITH stale AS (
                    SELECT job_id FROM jobs
                     WHERE status = 'running' AND deleted_at IS NULL
                       AND heartbeat_at <= now() - make_interval(secs => %(s)s)
                     FOR UPDATE SKIP LOCKED)
                UPDATE jobs j SET
                    status = CASE WHEN j.attempts >= %(max)s
                                  THEN 'error' ELSE 'queued' END,
                    error = CASE WHEN j.attempts >= %(max)s THEN %(msg)s END,
                    finished_at = CASE WHEN j.attempts >= %(max)s
                                       THEN now() END,
                    heartbeat_at = NULL, worker_id = NULL,
                    log = j.log || jsonb_build_array(
                        CASE WHEN j.attempts >= %(max)s
                             THEN %(msg)s ELSE %(line)s END)
                  FROM stale WHERE j.job_id = stale.job_id
                """,
                {
                    "s": stale_after_s,
                    "max": max_attempts,
                    "msg": _INTERRUPTED,
                    "line": _REQUEUED,
                },
            )
            return cur.rowcount

    def get_job(
        self, job_id: str, *, viewer: str | None = None
    ) -> models.JobSnapshot | None:
        """Задание; None — нет, помечено удалённым или чужое.

        elapsed_s считается по часам базы: от создания до завершения или до
        текущего момента.
        """
        with _connection(self._pool) as conn:
            row = conn.execute(
                f"""
                SELECT job_id, status, log, workers, error, errors,
                       extract(epoch FROM coalesce(finished_at, now())
                                          - created_at)::float8
                  FROM jobs j
                 WHERE job_id = %(job_id)s AND deleted_at IS NULL
                   AND {_VISIBLE}
                """,
                {"job_id": job_id, "viewer": viewer},
            ).fetchone()
            if row is None:
                return None
            runs = []
            if row[1] == "done":
                runs = conn.execute(
                    "SELECT simulation_id, result FROM runs"
                    " WHERE job_id = %s AND deleted_at IS NULL"
                    " ORDER BY scenario_index",
                    (job_id,),
                ).fetchall()
        return models.JobSnapshot(
            job_id=row[0],
            status=row[1],
            log=row[2],
            workers=row[3],
            error=row[4],
            errors=row[5],
            elapsed_s=row[6],
            simulation_ids=tuple(r[0] for r in runs),
            runs=tuple(r[1] for r in runs),
        )

    def get_run(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> Mapping[str, Any] | None:
        """Прогон; None — нет, он или его задание удалены, или он чужой."""
        with _connection(self._pool) as conn:
            row = conn.execute(
                f"""
                SELECT r.result FROM runs r JOIN jobs j USING (job_id)
                 WHERE r.simulation_id = %(simulation_id)s
                   AND r.deleted_at IS NULL AND j.deleted_at IS NULL
                   AND {_VISIBLE}
                """,
                {"simulation_id": simulation_id, "viewer": viewer},
            ).fetchone()
        return row[0] if row else None

    def get_traces_gz(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> bytes | None:
        """Трассы прогона в gzip; None — нет, скрыты или чужие."""
        with _connection(self._pool) as conn:
            row = conn.execute(
                f"""
                SELECT t.traces_gz FROM run_traces t
                  JOIN runs r USING (simulation_id) JOIN jobs j USING (job_id)
                 WHERE t.simulation_id = %(simulation_id)s
                   AND t.deleted_at IS NULL
                   AND r.deleted_at IS NULL AND j.deleted_at IS NULL
                   AND {_VISIBLE}
                """,
                {"simulation_id": simulation_id, "viewer": viewer},
            ).fetchone()
        return bytes(row[0]) if row else None


def _run_row(job_id: str, run: models.FinishedRun) -> tuple:
    """Строка таблицы runs из посчитанного прогона."""
    result = run.result
    return (
        run.simulation_id,
        job_id,
        run.scenario_index,
        result["scenario"]["name"],
        result.get("configuration_id"),
        result["status"],
        result["simulation_version"],
        pg_json.Jsonb(dict(result)),
    )
