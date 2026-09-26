"""Потоки воркеров: крутят исполнитель заданий, пока сервис работает.

Раз в половину SIM_STALE_AFTER_S цикл возвращает в очередь задания воркеров,
переставших отвечать. Сбой хранилища не останавливает воркер: он пишет в
журнал и повторяет после паузы.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
import logging
import os
import threading
import time
import uuid

from application import errors
from application import process_job

_log = logging.getLogger(__name__)


class WorkerLoop:
    """Цикл одного воркера: очередь → расчёт → сохранение."""

    def __init__(
        self,
        executor: process_job.JobExecutor,
        *,
        poll_interval_s: float,
        retry_s: float,
        stale_after_s: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        """Готовит цикл.

        Args:
            executor: Исполнитель заданий.
            poll_interval_s: Пауза при пустой очереди, с.
            retry_s: Пауза после сбоя хранилища, с.
            stale_after_s: Сколько секунд без подтверждения считать
                зависанием.
            clock: Монотонные часы, с.
        """
        self._executor = executor
        self._poll_interval_s = poll_interval_s
        self._retry_s = retry_s
        self._stale_after_s = stale_after_s
        self._clock = clock

    def run(self, stop: threading.Event) -> None:
        """Выполняет задания, пока не выставлен stop."""
        next_sweep = 0.0
        while not stop.is_set():
            try:
                if self._clock() >= next_sweep:
                    self._executor.requeue_stale(self._stale_after_s)
                    next_sweep = self._clock() + self._stale_after_s / 2
                if not self._executor.run_once():
                    stop.wait(self._poll_interval_s)
            except errors.StorageUnavailableError:
                _log.warning(
                    "хранилище недоступно, повтор через паузу", exc_info=True
                )
                stop.wait(self._retry_s)

    def release(self) -> None:
        """Прерывает текущий расчёт и возвращает задание в очередь."""
        self._executor.release_current()


def worker_id(index: int) -> str:
    """Имя воркера для диагностики: хост, процесс, номер, случайный хвост."""
    return f"{os.uname().nodename}:{os.getpid()}:{index}:{uuid.uuid4().hex[:6]}"


def start_threads(
    make_loop: Callable[[str], WorkerLoop],
    stop: threading.Event,
    count: int,
) -> list[tuple[threading.Thread, WorkerLoop]]:
    """Запускает воркеры потоками текущего процесса.

    Args:
        make_loop: Собирает цикл воркера по его имени.
        stop: Сигнал остановки.
        count: Сколько воркеров.

    Returns:
        Потоки и их циклы (для остановки).
    """
    started = []
    for i in range(count):
        loop = make_loop(worker_id(i))
        thread = threading.Thread(
            target=loop.run, args=(stop,), name=f"worker-{i}"
        )
        thread.start()
        started.append((thread, loop))
    return started


def stop_threads(
    started: Sequence[tuple[threading.Thread, WorkerLoop]],
    stop: threading.Event,
) -> None:
    """Останавливает воркеры: расчёты прерываются, задания — в очередь."""
    stop.set()
    for _, loop in started:
        loop.release()
