"""Воркер поверх PostgreSQL: сквозной путь от очереди до сохранённых прогонов.

Исполнитель собирается так же, как в сервисе (runtime.job_executor): очередь
в базе, расчёт в дочерних процессах.
"""

from __future__ import annotations

import gzip
import json
import os
import threading
import time
import uuid

import conftest
import crash_target
import pytest

from app import runtime
from simcore import version

pytestmark = pytest.mark.db


def _queue(repo, scenarios: list[dict], request: dict | None = None) -> str:
    job_id = uuid.uuid4().hex
    repo.create_job(
        job_id,
        request or conftest.request_body(),
        scenarios,
        version.SIM_VERSION,
    )
    return job_id


def _worker(repo, **kwargs):
    return runtime.job_executor(
        repo, conftest.settings(), "test-worker", **kwargs
    )


def test_empty_queue_returns_false(repo):
    assert not _worker(repo).run_once()


def test_job_is_computed_and_stored(repo):
    job_id = _queue(repo, [conftest.scenario()])

    assert _worker(repo).run_once()

    job = repo.get_job(job_id)
    assert job.status == "done", job.error
    assert len(job.runs) == 1
    assert job.log, "журнал хода расчёта пуст"
    sim_id = job.simulation_ids[0]
    assert repo.get_run(sim_id)["simulation_id"] == sim_id
    traces = json.loads(gzip.decompress(repo.get_traces_gz(sim_id)))
    assert isinstance(traces, list) and traces


def test_two_scenarios_keep_their_order(repo):
    first = dict(conftest.scenario(), name="Первый")
    second = dict(conftest.scenario(growth=0.3), name="Второй")
    job_id = _queue(repo, [first, second])

    _worker(repo).run_once()

    job = repo.get_job(job_id)
    assert job.status == "done", job.error
    assert [r["scenario"]["name"] for r in job.runs] == ["Первый", "Второй"]
    assert job.workers == min(2, os.cpu_count() or 1)


def test_invalid_input_ends_with_field_errors(repo):
    request = conftest.request_body()
    request["task"]["shifts"] = 9
    job_id = _queue(repo, [conftest.scenario()], request)

    _worker(repo).run_once()

    job = repo.get_job(job_id)
    assert job.status == "error"
    assert any(e["field"] == "task.shifts" for e in job.errors)


def test_crash_in_child_ends_with_error_and_hidden_detail(repo, pool):
    job_id = _queue(repo, [conftest.scenario()])

    _worker(repo, target=crash_target.explode).run_once()

    job = repo.get_job(job_id)
    assert job.status == "error"
    assert "расчёт упал" in job.error
    assert job.errors is None
    with pool.connection() as conn:
        detail = conn.execute(
            "SELECT error_detail FROM jobs WHERE job_id = %s", (job_id,)
        ).fetchone()[0]
    assert "RuntimeError" in detail


def test_process_dying_without_result_ends_with_error(repo):
    job_id = _queue(repo, [conftest.scenario()])

    _worker(repo, target=crash_target.die).run_once()

    job = repo.get_job(job_id)
    assert job.status == "error"
    assert "аварийно" in job.error
    assert "код 3" in job.error


def test_release_stops_the_computation_quickly(repo):
    """Остановка сервиса прерывает расчёт, а не ждёт его конца."""
    job_id = _queue(repo, [conftest.scenario()])
    w = _worker(repo, target=crash_target.slow)
    thread = threading.Thread(target=w.run_once)
    thread.start()
    deadline = time.monotonic() + 30
    while not repo.get_job(job_id).log:
        assert time.monotonic() < deadline, "расчёт не начался"
        time.sleep(0.1)

    started = time.monotonic()
    w.release_current()
    thread.join(timeout=15)

    assert not thread.is_alive()
    assert time.monotonic() - started < 10
    assert repo.get_job(job_id).status == "queued"


def test_lost_ownership_discards_the_result(repo, monkeypatch):
    job_id = _queue(repo, [conftest.scenario()])
    monkeypatch.setattr(repo, "heartbeat", lambda *a, **k: False)

    _worker(repo).run_once()

    assert repo.get_job(job_id).status == "running"
