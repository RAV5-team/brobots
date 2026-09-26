"""Запуск воркеров отдельным процессом.

    python -m app.worker

Воркер забирает задание из очереди в PostgreSQL и считает его сценарии в
дочерних процессах; логика — в application.process_job и adapters.
"""

from __future__ import annotations

import logging
import signal
import threading

from adapters.worker import loop
from app import runtime

_log = logging.getLogger(__name__)


def main() -> None:
    """Запускает воркеры до SIGTERM или Ctrl+C."""
    settings, pool, repo = runtime.start()
    stop = threading.Event()
    started = runtime.start_workers(
        repo, settings, stop, max(1, settings.workers)
    )
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: loop.stop_threads(started, stop))
    _log.info("воркеров: %d", len(started))
    try:
        for thread, _ in started:
            thread.join()
    finally:
        pool.close()


if __name__ == "__main__":
    main()
