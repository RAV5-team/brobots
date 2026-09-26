"""Контракт очереди заданий: одинаков у PostgreSQL и у тестового двойника.

Один набор проверок идёт по обеим реализациям, поэтому двойник, на котором
проверяются сценарии, не расходится с настоящим хранилищем.
"""

from __future__ import annotations

import fakes
import pytest

from application import models

_FIRST, _SECOND = "a" * 32, "b" * 32


@pytest.fixture(
    name="store",
    params=["fake", pytest.param("postgres", marks=pytest.mark.db)],
)
def _store_fixture(request):
    if request.param == "fake":
        return fakes.FakeJobStore()
    return request.getfixturevalue("repo")


def _queue(store, job_id: str = _FIRST) -> str:
    store.create_job(job_id, {"task": {}}, [{"name": "S"}], "sim-test")
    return job_id


def _run(simulation_id: str = "c" * 32, index: int = 0) -> models.FinishedRun:
    result = {
        "simulation_id": simulation_id,
        "configuration_id": None,
        "scenario": {"name": "S"},
        "status": "confirmed",
        "simulation_version": "sim-test",
    }
    return models.FinishedRun(
        simulation_id=simulation_id,
        scenario_index=index,
        result=result,
        traces=models.PackedTraces(gzip_json=b"\x1f\x8b", raw_bytes=2),
    )


def test_new_job_is_queued_with_empty_log(store):
    _queue(store)

    job = store.get_job(_FIRST)

    assert (job.status, list(job.log), job.workers) == ("queued", [], None)
    assert (job.simulation_ids, job.runs) == ((), ())


def test_unknown_ids_are_not_found(store):
    assert store.get_job(_FIRST) is None
    assert store.get_run(_FIRST) is None
    assert store.get_traces_gz(_FIRST) is None


def test_claim_takes_the_oldest_job_exactly_once(store):
    _queue(store, _FIRST)
    _queue(store, _SECOND)

    a = store.claim_next_job("w1")
    b = store.claim_next_job("w2")

    assert (a.job_id, b.job_id) == (_FIRST, _SECOND)
    assert a.lease == 1
    assert dict(a.request) == {"task": {}}
    assert list(a.scenarios) == [{"name": "S"}]
    assert store.claim_next_job("w3") is None


def test_heartbeat_appends_log_and_sets_workers(store):
    _queue(store)
    job = store.claim_next_job("w")

    assert store.heartbeat(_FIRST, job.lease, ["шаг 1", "шаг 2"], workers=2)
    assert store.heartbeat(_FIRST, job.lease, ["шаг 3"])

    view = store.get_job(_FIRST)
    assert view.status == "running"
    assert list(view.log) == ["шаг 1", "шаг 2", "шаг 3"]
    assert view.workers == 2


def test_finish_stores_runs_and_traces(store):
    _queue(store)
    job = store.claim_next_job("w")
    run = _run()

    assert store.finish_job(_FIRST, job.lease, [run], ["готово"])

    view = store.get_job(_FIRST)
    assert view.status == "done"
    assert view.simulation_ids == (run.simulation_id,)
    assert [dict(r) for r in view.runs] == [run.result]
    assert list(view.log) == ["готово"]
    assert dict(store.get_run(run.simulation_id)) == run.result
    assert store.get_traces_gz(run.simulation_id) == run.traces.gzip_json


def test_fail_keeps_field_errors(store):
    _queue(store)
    job = store.claim_next_job("w")
    field_errors = [{"field": "task.shifts", "message": "вне диапазона"}]

    assert store.fail_job(_FIRST, job.lease, "Ошибка входа", field_errors, "…")

    view = store.get_job(_FIRST)
    assert (view.status, view.error) == ("error", "Ошибка входа")
    assert [dict(e) for e in view.errors] == field_errors


def test_stale_job_is_requeued_and_old_owner_is_fenced(store):
    _queue(store)
    old = store.claim_next_job("w1")

    assert store.requeue_stale(stale_after_s=0, max_attempts=2) == 1
    new = store.claim_next_job("w2")

    assert new.lease == old.lease + 1
    assert not store.heartbeat(_FIRST, old.lease, ["опоздал"])
    assert not store.finish_job(_FIRST, old.lease, [_run()])
    assert not store.fail_job(_FIRST, old.lease, "поздно", None, None)
    assert store.get_job(_FIRST).status == "running"
    assert store.heartbeat(_FIRST, new.lease, ["новый владелец"])


def test_stale_job_fails_after_max_attempts(store):
    _queue(store)
    store.claim_next_job("w1")
    store.requeue_stale(stale_after_s=0, max_attempts=2)
    store.claim_next_job("w2")

    assert store.requeue_stale(stale_after_s=0, max_attempts=2) == 1

    view = store.get_job(_FIRST)
    assert view.status == "error"
    assert "прерван" in view.error


def test_fresh_running_job_is_not_requeued(store):
    _queue(store)
    store.claim_next_job("w")

    assert store.requeue_stale(stale_after_s=60, max_attempts=2) == 0


def test_release_returns_job_without_spending_an_attempt(store):
    _queue(store)
    job = store.claim_next_job("w")

    assert store.release_job(_FIRST, job.lease)
    assert store.get_job(_FIRST).status == "queued"
    store.claim_next_job("w")
    store.requeue_stale(stale_after_s=0, max_attempts=2)

    # попытка потрачена одна — задание снова в очереди, а не в ошибке
    assert store.get_job(_FIRST).status == "queued"


def test_released_owner_is_fenced_after_reclaim(store):
    _queue(store)
    old = store.claim_next_job("w1")
    store.release_job(_FIRST, old.lease)
    new = store.claim_next_job("w2")

    assert new.lease != old.lease
    assert not store.heartbeat(_FIRST, old.lease, ["опоздал"])
    assert not store.release_job(_FIRST, old.lease)
    assert store.get_job(_FIRST).status == "running"


def test_finished_job_accepts_no_more_writes(store):
    _queue(store)
    job = store.claim_next_job("w")
    store.finish_job(_FIRST, job.lease, [_run()])

    assert not store.heartbeat(_FIRST, job.lease, ["после конца"])
    assert not store.fail_job(_FIRST, job.lease, "поздно", None, None)
    assert store.get_job(_FIRST).status == "done"


# --- владение: одинаково у двойника и PostgreSQL ----------------------------
def _finished(store, job_id: str, owner_sub: str | None) -> str:
    """Завершённое задание владельца с одним прогоном; номер прогона."""
    store.create_job(
        job_id, {"task": {}}, [{"name": "S"}], "sim-test", owner_sub=owner_sub
    )
    job = store.claim_next_job("w")
    run = _run(simulation_id=job_id[:31] + "f")
    assert store.finish_job(job_id, job.lease, [run])
    return run.simulation_id


@pytest.mark.parametrize(
    "viewer, visible",
    [("alice", True), ("bob", False), (None, False)],
    ids=["owner", "other user", "guest"],
)
def test_owned_job_and_its_run_are_visible_only_to_the_owner(
    store, viewer, visible
):
    sim_id = _finished(store, _FIRST, owner_sub="alice")

    found = [
        store.get_job(_FIRST, viewer=viewer),
        store.get_run(sim_id, viewer=viewer),
        store.get_traces_gz(sim_id, viewer=viewer),
    ]

    assert all(x is not None for x in found) if visible else found == [None] * 3


@pytest.mark.parametrize("viewer", ["alice", None], ids=["user", "guest"])
def test_guest_job_is_visible_to_anyone_with_its_id(store, viewer):
    sim_id = _finished(store, _FIRST, owner_sub=None)

    assert store.get_job(_FIRST, viewer=viewer) is not None
    assert store.get_run(sim_id, viewer=viewer) is not None
    assert store.get_traces_gz(sim_id, viewer=viewer) is not None
