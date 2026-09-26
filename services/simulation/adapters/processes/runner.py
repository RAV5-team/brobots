"""Расчёт сценариев задания в дочерних процессах (порт ScenarioRunner).

Каждый сценарий считается в своём процессе (spawn: соединения к базе туда не
попадают). Итоги приходят через очередь в виде данных. Если tick просит
прервать расчёт или расчёт упал, работающие процессы завершаются.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from multiprocessing import queues as mp_queues
import multiprocessing as mp
import queue
import time
from typing import Any

from adapters.processes import child
from application import errors
from application import models
from simcore import inputs

# Как часто проверять дочерние процессы и забирать их сообщения, с.
_DRAIN_S = 0.2
# Сколько ждать завершения дочернего процесса после terminate(), с.
_TERMINATE_WAIT_S = 5.0


class ProcessScenarioRunner:
    """Считает сценарии задания в дочерних процессах."""

    def __init__(self, target: child.Target = child.run_scenario) -> None:
        """Готовит расчёт.

        Args:
            target: Расчёт сценария в дочернем процессе; должен
                импортироваться по имени модуля (запуск spawn).
        """
        self._target = target

    def run(
        self,
        request: Mapping[str, Any],
        tasks: Sequence[models.ScenarioTask],
        parallelism: int,
        tick: Callable[[Sequence[str]], bool],
    ) -> models.RunnerOutcome | None:
        """Считает сценарии, не больше parallelism процессов сразу.

        Returns:
            Итоги по сценариям; None — tick попросил прервать расчёт.

        Raises:
            inputs.RequestError: Во входе сценария есть ошибки.
            errors.ScenarioFailedError: Расчёт упал или процесс завершился
                без итога.
        """
        ctx = mp.get_context("spawn")
        progress, results = ctx.Queue(), ctx.Queue()
        pending = list(enumerate(tasks))
        running: dict[int, mp.process.BaseProcess] = {}
        done: dict[int, child.Result] = {}
        try:
            while len(done) < len(tasks):
                while pending and len(running) < parallelism:
                    index, task = pending.pop(0)
                    proc = ctx.Process(
                        target=child.child_main,
                        args=(
                            self._target,
                            index,
                            task.simulation_id,
                            dict(request),
                            dict(task.scenario),
                            progress,
                            results,
                        ),
                        daemon=True,
                    )
                    proc.start()
                    running[index] = proc
                time.sleep(_DRAIN_S)
                _collect(results, running, done)
                if not tick(_drain(progress)):
                    return None
            return models.RunnerOutcome(
                outputs=tuple(_output(done[i]) for i in range(len(tasks))),
                trailing_lines=tuple(_drain(progress)),
            )
        finally:
            _terminate(list(running.values()))
            for q in (progress, results):
                q.cancel_join_thread()
                q.close()


def _output(result: child.Result) -> models.ScenarioOutput:
    """Итог сценария из данных, пришедших от дочернего процесса."""
    run, traces_gz, raw_bytes = result
    return models.ScenarioOutput(
        run=run,
        traces=models.PackedTraces(gzip_json=traces_gz, raw_bytes=raw_bytes),
    )


def _collect(
    results: mp_queues.Queue,
    running: dict[int, mp.process.BaseProcess],
    done: dict[int, child.Result],
) -> None:
    """Забирает итоги завершившихся сценариев.

    Raises:
        inputs.RequestError: Во входе сценария есть ошибки.
        errors.ScenarioFailedError: Расчёт упал или процесс завершился без
            итога.
    """
    for index, kind, payload in _drain(results):
        running.pop(index).join()
        if kind == "request_error":
            raise inputs.RequestError(payload)
        if kind == "error":
            raise errors.ScenarioFailedError(*payload)
        done[index] = payload
    crashed = [i for i, p in running.items() if not p.is_alive()]
    if crashed and results.empty():
        reports = [
            f"сценарий {i + 1} (код {running.pop(i).exitcode})" for i in crashed
        ]
        raise errors.ScenarioFailedError(
            f"Процесс расчёта завершился аварийно: {", ".join(reports)}.",
            None,
        )


def _terminate(procs: Sequence[mp.process.BaseProcess]) -> None:
    """Завершает ещё работающие дочерние процессы."""
    for proc in procs:
        if proc.is_alive():
            proc.terminate()
    for proc in procs:
        proc.join(_TERMINATE_WAIT_S)
        if proc.is_alive():
            proc.kill()
            proc.join()


def _drain(source: queue.Queue | mp_queues.Queue) -> list:
    """Забирает все сообщения, накопившиеся в очереди."""
    items = []
    while True:
        try:
            items.append(source.get_nowait())
        except queue.Empty:
            return items
