"""HTTP API и экран шага 3 «Симуляция» (входящий веб-адаптер).

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
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
import dataclasses
import gzip
from http import server as http_server
import json
import logging
import os
import pathlib
import re
from typing import Any
from urllib import parse

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
_HTML = "text/html; charset=utf-8"
_INDEX = pathlib.Path(__file__).with_name("static") / "index.html"
# Номера заданий и прогонов — uuid4 в hex.
_ID = re.compile(r"^[0-9a-f]{32}$")
# Больше — 413: тело запроса хранится бессрочно.
MAX_BODY_BYTES = 1_000_000
# Тело до этого размера дочитывается перед ответом 413; больше — обрыв.
_DRAIN_LIMIT_BYTES = 16_000_000

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


class HttpServer(http_server.ThreadingHTTPServer):
    """HTTP-сервер сервиса симуляции.

    Attributes:
        services: Сценарии и порты для обработчика.
    """

    daemon_threads = True

    def __init__(self, address: tuple[str, int], services: Services) -> None:
        """Слушает address; запросы обслуживает Handler."""
        super().__init__(address, Handler)
        self.services = services


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


class Handler(http_server.BaseHTTPRequestHandler):
    """HTTP-обработчик сервиса симуляции: страница шага и /api/*."""

    # pylint: disable=invalid-name
    # Имена do_GET/do_POST задаёт http.server.BaseHTTPRequestHandler:
    # диспетчеризация идёт по ним, переименование отключит обработку запросов.

    server: HttpServer
    # Таймаут чтения запроса, с: зависший клиент не держит поток вечно.
    timeout = 30

    def log_message(  # pylint: disable=redefined-builtin
        self, format: str, *args: Any
    ) -> None:
        """Отключает журнал запросов в stderr."""
        del format, args

    def _send(
        self, code: int, body: bytes, ctype: str, headers: dict | None = None
    ) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj: Any, code: int = 200) -> None:
        body = json_codec.dumps(json_codec.json_safe(obj)).encode("utf-8")
        self._send(code, body, _JSON)

    def _parts(self) -> list[str]:
        return [p for p in parse.urlparse(self.path).path.split("/") if p]

    def do_GET(self) -> None:
        """Отдаёт страницу шага, справочники, задания и прогоны."""
        self._guarded(self._route_get)

    def do_POST(self) -> None:
        """Принимает предпросмотр и постановку задания в очередь."""
        self._guarded(self._route_post)

    def _guarded(self, route: Callable[[], None]) -> None:
        """Выполняет маршрут; недоступная база — 503."""
        try:
            route()
        except errors.StorageUnavailableError:
            _log.exception("хранилище недоступно")
            self._json(
                presenters.error_body("Хранилище недоступно, повторите позже."),
                503,
            )

    def _route_get(self) -> None:
        parts = self._parts()
        if not parts or parts == ["index.html"]:
            return self._send(200, _INDEX.read_bytes(), _HTML)
        if parts == ["api", "health"]:
            return self._health()
        if parts == ["api", "meta"]:
            return self._json(self._meta())
        if parts == ["api", "simulations", "schema"]:
            return self._json(request_schema.request_schema())
        if parts == ["api", "openapi.json"]:
            return self._json(openapi.spec())
        if parts[:3] == ["api", "simulations", "jobs"] and len(parts) <= 4:
            return self._get_job(parts[3] if len(parts) == 4 else "")
        if parts[:2] == ["api", "simulations"] and len(parts) in (3, 4):
            view = parts[3] if len(parts) == 4 else ""
            return self._get_run(parts[2], view)
        return self._json(presenters.error_body("not found"), 404)

    def _route_post(self) -> None:
        parts = self._parts()
        data = self._body()
        if data is None:
            return None
        if parts == ["api", "simulations", "preview"]:
            return self._preview(data)
        if parts == ["api", "simulations"]:
            return self._start(data)
        return self._json(presenters.error_body("not found"), 404)

    def _body(self) -> dict | None:
        """Читает тело-объект; при ошибке отвечает и возвращает None."""
        try:
            size = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            size = -1
        if size < 0:
            self._json(
                presenters.error_body("Некорректный Content-Length"), 400
            )
            return None
        if size > MAX_BODY_BYTES:
            self.close_connection = True
            if size <= _DRAIN_LIMIT_BYTES:
                self.rfile.read(size)  # дочитать, чтобы клиент увидел ответ
            self._json(
                presenters.error_body(f"Тело больше {MAX_BODY_BYTES} байт."),
                413,
            )
            return None
        try:
            data = json.loads(self.rfile.read(size) or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(presenters.error_body("Некорректный JSON"), 400)
            return None
        if not isinstance(data, dict):
            problems = [{"field": "body", "message": "должно быть объектом"}]
            self._json(
                presenters.error_body("Тело запроса — JSON-объект.", problems),
                422,
            )
            return None
        return data

    def _health(self) -> None:
        """Доступность базы и ревизия схемы."""
        if self.server.services.health.is_ready():
            self._json({"status": "ok"})
        else:
            self._json({"status": "unavailable"}, 503)

    def _meta(self) -> dict:
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

    def _get_job(self, job_id: str) -> None:
        """Ход задания и, когда готово, его прогоны."""
        reader = self.server.services.reader
        job = reader.get_job(job_id) if _ID.match(job_id) else None
        if job is None:
            return self._json(presenters.error_body("Задание не найдено."), 404)
        return self._json(presenters.job_body(job))

    def _get_run(self, simulation_id: str, view: str) -> None:
        """Прогон целиком или его 2D-трассы (traces)."""
        if view not in ("", "traces") or not _ID.match(simulation_id):
            return self._json(presenters.error_body("not found"), 404)
        reader = self.server.services.reader
        if not view:
            run = reader.get_run(simulation_id)
            if run is None:
                return self._json(
                    presenters.error_body("Прогон не найден."), 404
                )
            return self._json(run)
        traces_gz = reader.get_traces_gz(simulation_id)
        if traces_gz is None:
            return self._json(presenters.error_body("Прогон не найден."), 404)
        if accepts_gzip(self.headers.get("Accept-Encoding")):
            headers = {"Content-Encoding": "gzip", "Vary": "Accept-Encoding"}
            return self._send(200, traces_gz, _JSON, headers)
        headers = {"Vary": "Accept-Encoding"}
        return self._send(200, gzip.decompress(traces_gz), _JSON, headers)

    def _preview(self, data: dict) -> None:
        """Потребность по часам и сверка со следом расчёта — без имитации."""
        try:
            preview = self.server.services.preview(data)
        except inputs.RequestError as e:
            return self._json(presenters.error_body(str(e), e.errors), 422)
        return self._json(preview)

    def _start(self, data: dict) -> None:
        """Проверяет вход и ставит задание в очередь; ответ 202 с job_id."""
        try:
            job_id = self.server.services.submit(data)
        except errors.InvalidSubmissionError as e:
            return self._json(presenters.error_body(str(e), e.errors), 422)
        return self._json(
            {
                "job_id": job_id,
                "status_url": f"/api/simulations/jobs/{job_id}",
            },
            202,
        )
