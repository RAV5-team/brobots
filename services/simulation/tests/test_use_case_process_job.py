"""Сценарий «выполнить задание»: захват, подтверждения, итог, ограждение."""

from __future__ import annotations

import logging

import fakes

from application import errors
from application import process_job
from simcore import inputs

_HEARTBEAT_S = 10.0


class _Harness:
    """Очередь-двойник, часы и исполнитель с заданным расчётом."""

    def __init__(self, runner: fakes.ScriptedRunner, max_parallel: int = 4):
        self.clock = fakes.ManualClock()
        self.store = fakes.FakeJobStore(self.clock)
        self.runner = runner
        self.executor = process_job.JobExecutor(
            self.store,
            runner,
            "test-worker",
            new_id=fakes.SequentialIds(),
            clock=self.clock,
            heartbeat_s=_HEARTBEAT_S,
            max_parallel=max_parallel,
        )

    def queue(self, n_scenarios: int = 1) -> str:
        job_id = "f" * 32
        scenarios = [{"name": f"S{i}"} for i in range(n_scenarios)]
        self.store.create_job(job_id, {"task": {}}, scenarios, "sim-test")
        return job_id


def test_empty_queue_returns_false():
    h = _Harness(fakes.ScriptedRunner())

    assert not h.executor.run_once()
    assert not h.runner.calls


def test_success_stores_runs_in_scenario_order_with_fresh_ids():
    h = _Harness(fakes.ScriptedRunner(trailing=["готово"]), max_parallel=1)
    job_id = h.queue(n_scenarios=2)

    assert h.executor.run_once()

    request, tasks, parallelism = h.runner.calls[0]
    assert request == {"task": {}}
    assert [t.scenario["name"] for t in tasks] == ["S0", "S1"]
    assert parallelism == 1
    job = h.store.get_job(job_id)
    assert job.status == "done"
    assert job.workers == 1
    assert job.simulation_ids == (f"{1:032x}", f"{2:032x}")
    assert [r["scenario"]["name"] for r in job.runs] == ["S0", "S1"]
    assert job.log == ("готово",)


def test_parallelism_is_capped_by_scenario_count():
    h = _Harness(fakes.ScriptedRunner(), max_parallel=8)
    h.queue(n_scenarios=2)

    h.executor.run_once()

    assert h.runner.calls[0][2] == 2


def test_lost_ownership_before_start_skips_the_calculation():
    h = _Harness(fakes.ScriptedRunner())
    h.queue()
    h.store.heartbeat = lambda *args, **kwargs: False

    assert h.executor.run_once()

    assert not h.runner.calls


def test_request_error_fails_the_job_with_field_errors():
    bad = [{"field": "task.shifts", "message": "не число"}]
    h = _Harness(fakes.ScriptedRunner(error=inputs.RequestError(bad)))
    job_id = h.queue()

    h.executor.run_once()

    job = h.store.get_job(job_id)
    assert job.status == "error"
    assert list(job.errors) == bad
    assert h.store.detail(job_id) is None


def test_scenario_failure_fails_the_job_with_detail(caplog):
    failure = errors.ScenarioFailedError("RuntimeError: упал", "стек")
    h = _Harness(fakes.ScriptedRunner(error=failure))
    job_id = h.queue()

    with caplog.at_level(logging.ERROR):
        h.executor.run_once()

    job = h.store.get_job(job_id)
    assert job.status == "error"
    assert job.error == "RuntimeError: упал"
    assert job.errors is None
    assert h.store.detail(job_id) == "стек"
    assert "упал" in caplog.text


def test_new_lines_are_sent_at_once():
    h = _Harness(fakes.ScriptedRunner(ticks=[["шаг 1"], ["шаг 2"]]))
    job_id = h.queue()
    sent = []
    beat = h.store.heartbeat
    h.store.heartbeat = lambda *a, **kw: sent.append(a[2:]) or beat(*a, **kw)

    h.executor.run_once()

    assert sent == [(), (["шаг 1"],), (["шаг 2"],)]
    assert h.store.get_job(job_id).log == ("шаг 1", "шаг 2")


def test_quiet_ticks_send_no_heartbeat_until_due():
    h = _Harness(
        fakes.ScriptedRunner(
            ticks=[[], [], []],
            before_tick=lambda i: h.clock.advance(
                _HEARTBEAT_S if i == 2 else 1
            ),
        )
    )
    h.queue()
    calls = []
    beat = h.store.heartbeat
    h.store.heartbeat = lambda *a, **kw: calls.append(a) or beat(*a, **kw)

    h.executor.run_once()

    # первое подтверждение — при захвате, второе — когда подошёл срок
    assert len(calls) == 2


def test_failed_heartbeat_aborts_without_saving():
    h = _Harness(fakes.ScriptedRunner(ticks=[["шаг"]]))
    job_id = h.queue()
    beats = iter([True, False])
    h.store.heartbeat = lambda *args, **kwargs: next(beats)

    h.executor.run_once()

    assert h.store.get_job(job_id).status == "running"
    assert not h.store.get_job(job_id).runs


def test_release_mid_run_requeues_and_saves_nothing():
    h = _Harness(
        fakes.ScriptedRunner(
            ticks=[["шаг"]],
            before_tick=lambda _: h.executor.release_current(),
        )
    )
    job_id = h.queue()

    h.executor.run_once()

    assert h.store.get_job(job_id).status == "queued"
    assert h.store.attempts(job_id) == 0


def test_release_when_idle_does_nothing():
    h = _Harness(fakes.ScriptedRunner())

    h.executor.release_current()

    assert not h.executor.run_once()


def test_storage_outage_on_release_is_logged_not_raised(caplog):
    def outage(*_):
        raise errors.StorageUnavailableError("нет базы")

    h = _Harness(
        fakes.ScriptedRunner(
            ticks=[["шаг"]],
            before_tick=lambda _: h.executor.release_current(),
        )
    )
    h.queue()
    h.store.release_job = outage

    with caplog.at_level(logging.WARNING):
        h.executor.run_once()

    assert "не отпущено" in caplog.text


def test_released_executor_claims_nothing_more():
    h = _Harness(fakes.ScriptedRunner())
    job_id = h.queue()
    h.executor.release_current()

    assert not h.executor.run_once()

    assert h.store.get_job(job_id).status == "queued"


def test_job_claimed_while_releasing_goes_back_to_the_queue():
    """Остановка пришла, пока исполнитель забирал задание: гонки нет."""
    h = _Harness(fakes.ScriptedRunner())
    job_id = h.queue()
    claim = h.store.claim_next_job

    def claim_during_release(worker_id):
        job = claim(worker_id)
        h.executor.release_current()  # _current ещё не выставлен
        return job

    h.store.claim_next_job = claim_during_release

    assert h.executor.run_once()

    assert not h.runner.calls
    assert h.store.get_job(job_id).status == "queued"
    assert h.store.attempts(job_id) == 0


def test_requeue_stale_uses_the_attempt_limit():
    h = _Harness(fakes.ScriptedRunner())
    job_id = h.queue()
    h.store.claim_next_job("dead-worker")
    h.clock.advance(100)

    assert h.executor.requeue_stale(stale_after_s=50) == 1

    assert h.store.get_job(job_id).status == "queued"
    assert process_job.MAX_ATTEMPTS == 2


def test_requeue_stale_fails_a_job_out_of_attempts():
    h = _Harness(fakes.ScriptedRunner())
    job_id = h.queue()
    for _ in range(process_job.MAX_ATTEMPTS):
        h.store.claim_next_job("dead-worker")
        h.clock.advance(100)
        h.executor.requeue_stale(stale_after_s=50)

    assert h.store.get_job(job_id).status == "error"
