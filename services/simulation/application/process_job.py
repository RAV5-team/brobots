"""Сценарий «выполнить задание»: очередь → расчёт → сохранение.

Пока идёт расчёт, исполнитель дописывает журнал и подтверждает, что жив. Если
задание у него забрали (вернули в очередь как зависшее) или сервис
останавливается, расчёт прерывается, а результат не сохраняется. Итог —
прогоны и трассы — сохраняется одной записью.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
import logging
import threading

from application import errors
from application import models
from application import ports
from simcore import inputs

# Сколько попыток даётся заданию, если воркер падает во время расчёта.
MAX_ATTEMPTS = 2

_log = logging.getLogger(__name__)


class _Heartbeat:
    """Подтверждения одного захвата: журнал сразу, тишина — по сроку."""

    def __init__(
        self,
        jobs: ports.JobQueue,
        job: models.ClaimedJob,
        clock: Callable[[], float],
        interval_s: float,
        abort: threading.Event,
    ) -> None:
        self._jobs = jobs
        self._job = job
        self._clock = clock
        self._interval_s = interval_s
        self._abort = abort
        self._last = clock()

    def __call__(self, lines: Sequence[str]) -> bool:
        """Отправляет новые строки журнала или подтверждение по сроку.

        Returns:
            False — расчёт нужно прервать: сервис останавливается или
            задание больше не принадлежит этому захвату.
        """
        if self._abort.is_set():
            return False
        due = self._clock() - self._last >= self._interval_s
        if not lines and not due:
            return True
        if not self._jobs.heartbeat(
            self._job.job_id, self._job.lease, list(lines)
        ):
            return False
        self._last = self._clock()
        return True


class JobExecutor:
    """Выполняет задания из очереди по одному."""

    def __init__(
        self,
        jobs: ports.JobQueue,
        runner: ports.ScenarioRunner,
        worker_id: str,
        *,
        new_id: Callable[[], str],
        clock: Callable[[], float],
        heartbeat_s: float,
        max_parallel: int,
    ) -> None:
        """Готовит исполнитель.

        Args:
            jobs: Очередь заданий.
            runner: Расчёт сценариев.
            worker_id: Имя воркера для диагностики.
            new_id: Выдаёт номер прогона.
            clock: Монотонные часы, с.
            heartbeat_s: Как часто подтверждать, что воркер жив, с.
            max_parallel: Сколько сценариев считать одновременно не больше.
        """
        self._jobs = jobs
        self._runner = runner
        self._worker_id = worker_id
        self._new_id = new_id
        self._clock = clock
        self._heartbeat_s = heartbeat_s
        self._max_parallel = max_parallel
        self._current: models.ClaimedJob | None = None
        self._abort = threading.Event()

    def run_once(self) -> bool:
        """Забирает и выполняет одно задание.

        После release_current новых заданий не берёт; задание, захваченное
        одновременно с остановкой, сразу возвращает в очередь.

        Returns:
            False — очередь пуста или исполнитель остановлен.
        """
        if self._abort.is_set():
            return False
        job = self._jobs.claim_next_job(self._worker_id)
        if job is None:
            return False
        self._current = job
        try:
            # Флаг проверяется после записи _current, а release_current
            # ставит флаг до чтения _current: задание отпустит хотя бы один.
            if self._abort.is_set():
                self._release(job)
            else:
                self._execute(job)
        finally:
            self._current = None
        return True

    def requeue_stale(self, stale_after_s: float) -> int:
        """Возвращает в очередь задания замолчавших воркеров.

        Returns:
            Сколько заданий обработано.
        """
        return self._jobs.requeue_stale(stale_after_s, MAX_ATTEMPTS)

    def release_current(self) -> None:
        """Останавливает исполнитель: расчёт прерывается, задание — в очередь.

        Вызывается при остановке сервиса из другого потока; после вызова
        исполнитель заданий не берёт.
        """
        self._abort.set()
        job = self._current
        if job is not None:
            self._release(job)

    def _release(self, job: models.ClaimedJob) -> None:
        """Возвращает задание в очередь, не тратя попытку."""
        try:
            self._jobs.release_job(job.job_id, job.lease)
        except errors.StorageUnavailableError:
            _log.warning(
                "задание %s не отпущено: вернётся в очередь как зависшее",
                job.job_id,
            )

    def _execute(self, job: models.ClaimedJob) -> None:
        """Считает сценарии задания и сохраняет итог или ошибку."""
        parallel = min(len(job.scenarios), self._max_parallel)
        if not self._jobs.heartbeat(job.job_id, job.lease, workers=parallel):
            return
        tasks = [
            models.ScenarioTask(simulation_id=self._new_id(), scenario=s)
            for s in job.scenarios
        ]
        tick = _Heartbeat(
            self._jobs, job, self._clock, self._heartbeat_s, self._abort
        )
        try:
            outcome = self._runner.run(job.request, tasks, parallel, tick)
        except inputs.RequestError as e:
            self._jobs.fail_job(job.job_id, job.lease, str(e), e.errors, None)
            return
        except errors.ScenarioFailedError as e:
            _log.error("задание %s: %s", job.job_id, e)
            self._jobs.fail_job(job.job_id, job.lease, str(e), None, e.detail)
            return
        if outcome is None:
            _log.warning("задание %s: расчёт прерван", job.job_id)
            return
        runs = [
            models.FinishedRun(
                simulation_id=task.simulation_id,
                scenario_index=i,
                result=out.run,
                traces=out.traces,
            )
            for i, (task, out) in enumerate(
                zip(tasks, outcome.outputs, strict=True)
            )
        ]
        self._jobs.finish_job(
            job.job_id, job.lease, runs, outcome.trailing_lines
        )
