"""Хранилище в PostgreSQL: то, чего нет в общем контракте очереди.

Конкурентный захват, мягкое удаление, время по часам базы, скрытая
трассировка, ревизия схемы и перевод обрыва связи в StorageUnavailableError.
"""

from __future__ import annotations

import concurrent.futures
import time
import uuid

import conftest
import pytest

from adapters import json_codec
from adapters.postgres import pool as pg_pool
from adapters.postgres import repository
from application import errors
from application import models
from simcore import version

pytestmark = pytest.mark.db


# Владелец заданий: без владельца задание не видно никому.
_OWNER = "owner-sub"


def _new_job(repo: repository.PostgresJobRepository) -> str:
    job_id = uuid.uuid4().hex
    repo.create_job(
        job_id,
        conftest.request_body(),
        [conftest.scenario()],
        version.SIM_VERSION,
        owner_sub=_OWNER,
    )
    return job_id


def _finished_run(verified: dict, index: int = 0) -> models.FinishedRun:
    run = dict(verified, simulation_id=uuid.uuid4().hex)
    traces_gz, raw = json_codec.pack_traces(
        [{"name": "Из подбора", "frames": []}]
    )
    return models.FinishedRun(
        simulation_id=run["simulation_id"],
        scenario_index=index,
        result=json_codec.json_safe(run),
        traces=models.PackedTraces(gzip_json=traces_gz, raw_bytes=raw),
    )


def _soft_delete(pool, table: str, key: str, value: str) -> None:
    with pool.connection() as conn:
        conn.execute(
            f"UPDATE {table} SET deleted_at = now() WHERE {key} = %s", (value,)
        )


def test_concurrent_claims_get_distinct_jobs(repo):
    jobs = {_new_job(repo) for _ in range(8)}

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        claimed = list(ex.map(lambda i: repo.claim_next_job(f"w{i}"), range(8)))

    assert {c.job_id for c in claimed} == jobs


def test_claim_skips_soft_deleted_jobs(repo, pool):
    job_id = _new_job(repo)
    _soft_delete(pool, "jobs", "job_id", job_id)

    assert repo.claim_next_job("w") is None
    assert repo.get_job(job_id, viewer=_OWNER) is None


def test_finished_run_keeps_the_full_simulation_run(repo, verified):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")
    run = _finished_run(verified)

    assert repo.finish_job(job_id, job.lease, [run])

    assert repo.get_run(run.simulation_id, viewer=_OWNER) == run.result


def test_error_detail_is_stored_but_not_read_back(repo, pool):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")

    repo.fail_job(job_id, job.lease, "Ошибка", None, "Traceback…")

    assert not hasattr(repo.get_job(job_id, viewer=_OWNER), "error_detail")
    with pool.connection() as conn:
        detail = conn.execute(
            "SELECT error_detail FROM jobs WHERE job_id = %s", (job_id,)
        ).fetchone()[0]
    assert detail == "Traceback…"


def test_release_restores_the_attempt_counter(repo, pool):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")

    repo.release_job(job_id, job.lease)
    repo.claim_next_job("w")

    with pool.connection() as conn:
        attempts = conn.execute(
            "SELECT attempts FROM jobs WHERE job_id = %s", (job_id,)
        ).fetchone()[0]
    assert attempts == 1


def test_soft_deleted_run_and_traces_are_hidden(repo, pool, verified):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")
    run = _finished_run(verified)
    repo.finish_job(job_id, job.lease, [run])

    _soft_delete(pool, "runs", "simulation_id", run.simulation_id)

    assert repo.get_run(run.simulation_id, viewer=_OWNER) is None
    assert repo.get_traces_gz(run.simulation_id, viewer=_OWNER) is None
    assert repo.get_job(job_id, viewer=_OWNER).runs == ()


def test_soft_deleted_job_hides_its_runs(repo, pool, verified):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")
    run = _finished_run(verified)
    repo.finish_job(job_id, job.lease, [run])

    _soft_delete(pool, "jobs", "job_id", job_id)

    assert repo.get_run(run.simulation_id, viewer=_OWNER) is None
    assert repo.get_traces_gz(run.simulation_id, viewer=_OWNER) is None


def test_soft_deleted_job_accepts_no_writes(repo, pool):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")

    _soft_delete(pool, "jobs", "job_id", job_id)

    assert not repo.heartbeat(job_id, job.lease, ["шаг"])
    assert not repo.release_job(job_id, job.lease)
    assert not repo.fail_job(job_id, job.lease, "x", None, None)


def test_elapsed_grows_while_running_and_freezes_after_finish(repo, verified):
    job_id = _new_job(repo)
    job = repo.claim_next_job("w")
    first = repo.get_job(job_id, viewer=_OWNER).elapsed_s
    time.sleep(0.05)
    assert repo.get_job(job_id, viewer=_OWNER).elapsed_s > first

    repo.finish_job(job_id, job.lease, [_finished_run(verified)])
    done = repo.get_job(job_id, viewer=_OWNER).elapsed_s
    time.sleep(0.05)

    assert repo.get_job(job_id, viewer=_OWNER).elapsed_s == done


def test_schema_revision_and_readiness(pool, repo):
    assert repository.schema_revision(pool) == repository.EXPECTED_REVISION
    assert repo.is_ready()


@pytest.fixture(name="unreachable")
def _unreachable_fixture():
    """Хранилище, чья база не отвечает."""
    pool = pg_pool.make_pool(
        "postgresql://sim:sim@127.0.0.1:1/simulation_test", 0, 1, 0.3
    )
    pool.open(wait=False)
    yield repository.PostgresJobRepository(pool)
    pool.close()


_PORT_CALLS = {
    "create_job": lambda r: r.create_job("a" * 32, {}, [{}], "v"),
    "claim_next_job": lambda r: r.claim_next_job("w"),
    "heartbeat": lambda r: r.heartbeat("a" * 32, 1, ["x"]),
    "finish_job": lambda r: r.finish_job("a" * 32, 1, []),
    "fail_job": lambda r: r.fail_job("a" * 32, 1, "x", None, None),
    "release_job": lambda r: r.release_job("a" * 32, 1),
    "requeue_stale": lambda r: r.requeue_stale(1.0, 2),
    "get_job": lambda r: r.get_job("a" * 32),
    "get_run": lambda r: r.get_run("a" * 32),
    "get_traces_gz": lambda r: r.get_traces_gz("a" * 32),
}


@pytest.mark.parametrize("method", sorted(_PORT_CALLS))
def test_every_port_method_reports_an_unreachable_database(unreachable, method):
    with pytest.raises(errors.StorageUnavailableError):
        _PORT_CALLS[method](unreachable)


def test_unreachable_database_is_not_ready(unreachable):
    assert not unreachable.is_ready()


def test_open_pool_reports_an_unreachable_database():
    pool = pg_pool.make_pool(
        "postgresql://sim:sim@127.0.0.1:1/simulation_test", 1, 1, 0.3
    )
    try:
        with pytest.raises(errors.StorageUnavailableError):
            pg_pool.open_pool(pool, wait_timeout_s=0.3)
    finally:
        pool.close()
