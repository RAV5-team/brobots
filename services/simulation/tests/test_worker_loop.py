"""Цикл воркера: сбой хранилища не убивает воркер, остановка — по сигналу."""

from __future__ import annotations

import threading

import fakes

from adapters.worker import loop
from application import errors
from application import process_job


class _FlakyExecutor(process_job.JobExecutor):
    """Исполнитель, у которого первый захват падает из-за хранилища."""

    def __init__(self, stop: threading.Event) -> None:
        super().__init__(
            fakes.FakeJobStore(),
            fakes.ScriptedRunner(),
            "w",
            new_id=fakes.SequentialIds(),
            clock=fakes.ManualClock(),
            heartbeat_s=1.0,
            max_parallel=1,
        )
        self._stop = stop
        self.claims = 0
        self.sweeps = 0
        self.released = False

    def run_once(self) -> bool:
        self.claims += 1
        if self.claims == 1:
            raise errors.StorageUnavailableError("база перезапускается")
        self._stop.set()
        return False

    def requeue_stale(self, stale_after_s: float) -> int:
        self.sweeps += 1
        return 0

    def release_current(self) -> None:
        self.released = True


def test_storage_outage_does_not_kill_the_worker():
    stop = threading.Event()
    executor = _FlakyExecutor(stop)
    worker = loop.WorkerLoop(
        executor, poll_interval_s=0.01, retry_s=0.01, stale_after_s=100
    )

    worker.run(stop)

    assert executor.claims == 2
    assert executor.sweeps == 1


def test_threads_start_with_distinct_ids_and_stop_on_signal():
    stop = threading.Event()
    made: list[str] = []
    executors: list[_FlakyExecutor] = []

    def make_loop(worker_id: str) -> loop.WorkerLoop:
        made.append(worker_id)
        executors.append(_FlakyExecutor(threading.Event()))
        return loop.WorkerLoop(
            executors[-1], poll_interval_s=0.01, retry_s=0.01, stale_after_s=1
        )

    started = loop.start_threads(make_loop, stop, 2)
    loop.stop_threads(started, stop)
    for thread, _ in started:
        thread.join(timeout=5)

    assert len(set(made)) == 2
    assert all(not t.is_alive() for t, _ in started)
    assert all(e.released for e in executors)
