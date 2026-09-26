"""HTTP API и экран шага 3 «Симуляция» (входящий веб-адаптер, FastAPI).

Вход — конфигурация, выбранная на шаге «Подбор», и 1–2 сценария проверки.
Задание ставится в очередь в PostgreSQL; его считает воркер (в этом процессе
при SIM_WORKERS > 0 или отдельно: python -m app.worker). Выход — прогон на
каждый сценарий: вердикт, KPI, почасовая загрузка, изменение парка и
предлагаемые поправки. Денег сервис не принимает и не считает.

    GET  /api/health
        доступность базы
    GET  /api/meta
        поля сценария, демо-вход из подбора, версия
    GET  /api/openapi.json
        OpenAPI 3.1 сервиса (то же, что docs/openapi.json)
    GET  /api/simulations/schema
        JSON Schema запроса (simulation_params — параметры шага)
    POST /api/simulations/preview
        потребность по часам и сверка со следом расчёта (мгновенно)
    POST /api/simulations
        постановка в очередь → 202 {job_id}
    GET  /api/simulations/jobs/{job_id}
        ход и результаты
    GET  /api/simulations/{simulation_id}
        один прогон
    GET  /api/simulations/{simulation_id}/traces
        записи прогона для 2D-сравнения (JSON, gzip)

Контракт ведётся вручную в adapters.web.openapi: автоматическая схема FastAPI
отключена, чтобы docs/openapi.json оставался единственным описанием API.
Обработчики с вызовами хранилища — синхронные: FastAPI выполняет их в пуле
потоков, и блокирующий psycopg не останавливает цикл событий.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
import dataclasses
import gzip
import json
import logging
import os
import pathlib
import re
from typing import Annotated, Any

import fastapi
from fastapi import responses
from starlette import exceptions as starlette_exceptions
from starlette import types as starlette_types

from adapters import json_codec
from adapters.web import demo_input
from adapters.web import form_spec
from adapters.web import openapi
from adapters.web import presenters
from adapters.web import request_schema
from application import errors
from application import ports
from simcore import inputs
from simcore import version

_JSON = "application/json; charset=utf-8"
_INDEX = pathlib.Path(__file__).with_name("static") / "index.html"
# Номера заданий и прогонов — uuid4 в hex.
_ID = re.compile(r"^[0-9a-f]{32}$")
# Больше — 413: тело запроса хранится бессрочно.
MAX_BODY_BYTES = 1_000_000
# Тело до этого размера дочитывается перед ответом 413; больше — обрыв.
_DRAIN_LIMIT_BYTES = 16_000_000
# Тексты ответов Starlette на неизвестный путь и метод — в формате сервиса.
_STATUS_TEXT = {404: "not found", 405: "method not allowed"}

_log = logging.getLogger(__name__)


@dataclasses.dataclass(frozen=True)
class Services:
    """Сценарии и порты, которые обслуживает HTTP API.

    Attributes:
        submit: Ставит проверку в очередь, возвращает номер задания.
        preview: Потребность по часам без имитации.
        reader: Чтение заданий и прогонов.
        health: Готовность хранилища.
    """

    submit: Callable[[Mapping[str, Any]], str]
    preview: Callable[[Mapping[str, Any]], dict]
    reader: ports.ResultReader
    health: ports.StorageHealth


class ApiError(Exception):
    """Ответ об ошибке в формате сервиса: {"error", "errors"?}.

    Attributes:
        status: HTTP-код ответа.
        message: Текст ошибки.
        problems: Ошибки по полям или None.
    """

    def __init__(
        self,
        status: int,
        message: str,
        problems: Sequence[Mapping[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.problems = problems


class JsonResponse(responses.Response):
    """JSON-ответ сервиса: без NaN и с UTF-8 без экранирования."""

    media_type = _JSON

    def render(self, content: Any) -> bytes:
        return json_codec.dumps(json_codec.json_safe(content)).encode("utf-8")


def _quality(params: str) -> float:
    """Вес q из параметров кодировки; без q — 1, неразборчивый — 0."""
    for param in params.split(";"):
        key, _, value = param.partition("=")
        if key.strip().lower() == "q":
            try:
                return float(value.strip())
            except ValueError:
                return 0.0
    return 1.0


def accepts_gzip(header: str | None) -> bool:
    """Принимает ли клиент gzip по заголовку Accept-Encoding (RFC 9110).

    Явный gzip важнее «*»; вес q=0 означает отказ.
    """
    weights = {}
    for part in (header or "").split(","):
        name, _, params = part.strip().partition(";")
        weights[name.strip().lower()] = _quality(params)
    weight = weights.get("gzip", weights.get("*", 0.0))
    return weight > 0


def _declared_size(request: fastapi.Request) -> int | None:
    """Content-Length запроса; None — не указан (chunked)."""
    header = request.headers.get("content-length")
    if header is None:
        return None
    try:
        size = int(header)
    except ValueError as e:
        raise ApiError(400, "Некорректный Content-Length") from e
    if size < 0:
        raise ApiError(400, "Некорректный Content-Length")
    return size


async def _read_limited(request: fastapi.Request) -> bytes:
    """Тело не больше MAX_BODY_BYTES; больше — 413.

    Лишнее тело до _DRAIN_LIMIT_BYTES дочитывается, чтобы клиент, ещё
    отправляющий запрос, увидел ответ, а не обрыв соединения.
    """
    declared = _declared_size(request)
    too_big = declared is not None and declared > MAX_BODY_BYTES
    if declared is not None and declared > _DRAIN_LIMIT_BYTES:
        raise ApiError(413, f"Тело больше {MAX_BODY_BYTES} байт.")
    chunks: list[bytes] = []
    received = 0
    async for chunk in request.stream():
        received += len(chunk)
        too_big = too_big or received > MAX_BODY_BYTES
        if received > _DRAIN_LIMIT_BYTES:
            break
        if not too_big:
            chunks.append(chunk)
    if too_big:
        raise ApiError(413, f"Тело больше {MAX_BODY_BYTES} байт.")
    return b"".join(chunks)


async def json_object(request: fastapi.Request) -> dict:
    """Зависимость: тело запроса — JSON-объект; пустое тело — {}.

    Raises:
        ApiError: 400 — не JSON, 413 — слишком большое, 422 — не объект.
    """
    raw = await _read_limited(request)
    try:
        data = json.loads(raw or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ApiError(400, "Некорректный JSON") from e
    if not isinstance(data, dict):
        problems = [{"field": "body", "message": "должно быть объектом"}]
        raise ApiError(422, "Тело запроса — JSON-объект.", problems)
    return data


Body = Annotated[dict, fastapi.Depends(json_object)]


def _services(request: fastapi.Request) -> Services:
    """Зависимость: сценарии и порты приложения."""
    return request.app.state.services


Deps = Annotated[Services, fastapi.Depends(_services)]


def _meta() -> dict:
    """Справочники для формы, примеры сценариев и демо-вход из подбора."""
    return {
        "simulation_version": version.SIM_VERSION,
        "cpu": os.cpu_count() or 1,
        "simulation_params_spec": form_spec.params_spec(),
        "demo": {
            "configurations": demo_input.demo_configurations(),
            "location": demo_input.location(),
            "task": demo_input.task(),
        },
    }


def _require_id(value: str, message: str) -> None:
    if not _ID.match(value):
        raise ApiError(404, message)


def _add_pages(app: fastapi.FastAPI) -> None:
    """Страница шага, готовность и справочники."""

    @app.get("/", response_class=responses.HTMLResponse)
    @app.get("/index.html", response_class=responses.HTMLResponse)
    def index() -> responses.HTMLResponse:
        return responses.HTMLResponse(_INDEX.read_bytes())

    @app.get("/api/health")
    def health(services: Deps) -> JsonResponse:
        if services.health.is_ready():
            return JsonResponse({"status": "ok"})
        return JsonResponse({"status": "unavailable"}, 503)

    @app.get("/api/meta")
    def meta() -> JsonResponse:
        return JsonResponse(_meta())

    @app.get("/api/openapi.json")
    def spec() -> JsonResponse:
        return JsonResponse(openapi.spec())

    @app.get("/api/simulations/schema")
    def schema() -> JsonResponse:
        return JsonResponse(request_schema.request_schema())


def _add_simulations(app: fastapi.FastAPI) -> None:
    """Предпросмотр, постановка в очередь, задания и прогоны.

    Точные пути объявлены раньше шаблонных: /api/simulations/{simulation_id}
    иначе перехватил бы schema и jobs.
    """

    @app.post("/api/simulations/preview")
    def preview(services: Deps, data: Body) -> JsonResponse:
        """Потребность по часам и сверка со следом расчёта — без имитации."""
        try:
            return JsonResponse(services.preview(data))
        except inputs.RequestError as e:
            raise ApiError(422, str(e), e.errors) from e

    @app.post("/api/simulations")
    def start(services: Deps, data: Body) -> JsonResponse:
        """Проверяет вход и ставит задание в очередь; ответ 202 с job_id."""
        try:
            job_id = services.submit(data)
        except errors.InvalidSubmissionError as e:
            raise ApiError(422, str(e), e.errors) from e
        return JsonResponse(
            {
                "job_id": job_id,
                "status_url": f"/api/simulations/jobs/{job_id}",
            },
            202,
        )

    @app.get("/api/simulations/jobs")
    def no_job() -> JsonResponse:
        """Без номера задания — то же, что неизвестное задание."""
        raise ApiError(404, "Задание не найдено.")

    @app.get("/api/simulations/jobs/{job_id}")
    def get_job(services: Deps, job_id: str) -> JsonResponse:
        """Ход задания и, когда готово, его прогоны."""
        _require_id(job_id, "Задание не найдено.")
        job = services.reader.get_job(job_id)
        if job is None:
            raise ApiError(404, "Задание не найдено.")
        return JsonResponse(presenters.job_body(job))

    @app.get("/api/simulations/{simulation_id}")
    def get_run(services: Deps, simulation_id: str) -> JsonResponse:
        """Прогон целиком."""
        _require_id(simulation_id, "not found")
        run = services.reader.get_run(simulation_id)
        if run is None:
            raise ApiError(404, "Прогон не найден.")
        return JsonResponse(run)

    @app.get("/api/simulations/{simulation_id}/traces")
    def get_traces(
        services: Deps, simulation_id: str, request: fastapi.Request
    ) -> responses.Response:
        """2D-трассы прогона: gzip, если клиент его принимает."""
        _require_id(simulation_id, "not found")
        traces_gz = services.reader.get_traces_gz(simulation_id)
        if traces_gz is None:
            raise ApiError(404, "Прогон не найден.")
        headers = {"Vary": "Accept-Encoding"}
        if accepts_gzip(request.headers.get("accept-encoding")):
            headers["Content-Encoding"] = "gzip"
            return responses.Response(traces_gz, 200, headers, _JSON)
        return responses.Response(
            gzip.decompress(traces_gz), 200, headers, _JSON
        )


def _add_error_handlers(app: fastapi.FastAPI) -> None:
    """Ошибки — в формате {"error", "errors"?}; база недоступна — 503."""

    @app.exception_handler(ApiError)
    async def api_error(_: fastapi.Request, exc: ApiError) -> JsonResponse:
        return JsonResponse(
            presenters.error_body(exc.message, exc.problems), exc.status
        )

    @app.exception_handler(errors.StorageUnavailableError)
    async def storage_unavailable(
        _: fastapi.Request, exc: errors.StorageUnavailableError
    ) -> JsonResponse:
        _log.error("хранилище недоступно", exc_info=exc)
        return JsonResponse(
            presenters.error_body("Хранилище недоступно, повторите позже."),
            503,
        )

    @app.exception_handler(starlette_exceptions.HTTPException)
    async def http_error(
        _: fastapi.Request, exc: starlette_exceptions.HTTPException
    ) -> JsonResponse:
        message = _STATUS_TEXT.get(exc.status_code, str(exc.detail))
        return JsonResponse(
            presenters.error_body(message), exc.status_code, exc.headers
        )


def _no_store(app: fastapi.FastAPI) -> None:
    """Ответы API не кешируются: задания и прогоны меняются."""

    @app.middleware("http")
    async def no_store(
        request: fastapi.Request,
        call_next: Callable[[fastapi.Request], Awaitable[responses.Response]],
    ) -> responses.Response:
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response


def create_app(
    services: Services,
    lifespan: starlette_types.Lifespan[fastapi.FastAPI] | None = None,
) -> fastapi.FastAPI:
    """ASGI-приложение сервиса симуляции.

    Args:
        services: Сценарии и порты для обработчиков.
        lifespan: Запуск и остановка фоновых задач (воркеров) корнем сборки.
    """
    app = fastapi.FastAPI(
        title="RAV5 simulation",
        version=version.SIM_VERSION,
        openapi_url=None,
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.services = services
    _add_error_handlers(app)
    _no_store(app)
    _add_pages(app)
    _add_simulations(app)
    return app
