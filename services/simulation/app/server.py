"""Запуск HTTP-сервиса шага 3 «Симуляция».

    python -m app.server            → http://localhost:8765

Задание ставится в очередь в PostgreSQL; его считает воркер (в этом процессе
при SIM_WORKERS > 0 или отдельно: python -m app.worker). Маршруты — в
adapters.web.server.
"""

from __future__ import annotations

import logging
import signal
import threading
from typing import Any

from adapters.web import server as web_server
from adapters.worker import loop
from app import runtime
from simcore import version

_log = logging.getLogger(__name__)


def main() -> None:
    """Запускает сервис и встроенные воркеры до SIGTERM или Ctrl+C."""
    settings, pool, repo = runtime.start()
    stop = threading.Event()
    started = runtime.start_workers(repo, settings, stop, settings.workers)
    srv = web_server.HttpServer(
        ("0.0.0.0", settings.port), runtime.http_services(repo)
    )

    def shutdown(*_: Any) -> None:
        loop.stop_threads(started, stop)
        threading.Thread(target=srv.shutdown).start()

    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, shutdown)
    _log.info(
        "Шаг «Симуляция»: http://localhost:%d (воркеров: %d, %s)",
        settings.port,
        settings.workers,
        version.SIM_VERSION,
    )
    try:
        srv.serve_forever()
    finally:
        srv.server_close()
        for thread, _ in started:
            thread.join()
        pool.close()


if __name__ == "__main__":
    main()
