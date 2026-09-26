"""Запуск HTTP-сервиса шага 3 «Симуляция».

    python -m app.server            → http://localhost:8765

Задание ставится в очередь в PostgreSQL; его считает воркер (в этом процессе
при SIM_WORKERS > 0 или отдельно: python -m app.worker). Маршруты — в
adapters.web.server, HTTP-сервер — uvicorn. SIGTERM и Ctrl+C обрабатывает
uvicorn: он завершает запросы и вызывает остановку lifespan, где воркеры
возвращают задания в очередь. Ключи Keycloak загружаются в фоне; до первой
загрузки /api/health отвечает 503.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
import contextlib
import logging
import threading

import fastapi
import uvicorn

from adapters.web import server as web_server
from adapters.worker import loop
from app import runtime
from simcore import version

_log = logging.getLogger(__name__)


def main() -> None:
    """Запускает сервис и встроенные воркеры до SIGTERM или Ctrl+C."""
    settings, pool, repo = runtime.start()
    try:
        verifier = runtime.token_verifier(settings)
    except SystemExit:
        pool.close()
        raise

    @contextlib.asynccontextmanager
    async def lifespan(app: fastapi.FastAPI) -> AsyncIterator[None]:
        del app  # воркерам приложение не нужно
        stop = threading.Event()
        keys = threading.Thread(
            target=verifier.preload_until_ready,
            args=(stop,),
            name="jwks-preload",
            daemon=True,
        )
        keys.start()
        started = runtime.start_workers(repo, settings, stop, settings.workers)
        _log.info(
            "Шаг «Симуляция»: http://localhost:%d (воркеров: %d, %s)",
            settings.port,
            settings.workers,
            version.SIM_VERSION,
        )
        try:
            yield
        finally:
            loop.stop_threads(started, stop)
            for thread, _ in started:
                thread.join()
            pool.close()

    services = runtime.http_services(
        repo, verifier, settings.internal_caller_azp
    )
    app = web_server.create_app(services, lifespan)
    try:
        # log_config=None: журнал uvicorn идёт через настройки runtime.start —
        # общий формат и фильтр секретов.
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=settings.port,
            log_config=None,
            ws="none",
        )
    finally:
        pool.close()


if __name__ == "__main__":
    main()
