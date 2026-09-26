"""OpenAPI 3.1 сервиса симуляции.

Спецификация строится из кода: схема запроса — из правил разбора ядра
(adapters.web.request_schema). docs/openapi.json
генерируется отсюда, тест следит, чтобы файл не расходился с кодом.
"""

from __future__ import annotations

from adapters.web import request_schema
from simcore import version

_JSON = "application/json"
_HTML = "text/html"
_NUM = {"type": "number"}
_INT = {"type": "integer"}
_STR = {"type": "string"}
_BOOL = {"type": "boolean"}
_ANY_OBJECT = {"type": "object"}


def _ref(name: str) -> dict:
    return {"$ref": f"#/components/schemas/{name}"}


def _arr(items: dict) -> dict:
    return {"type": "array", "items": items}


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _obj(props: dict, description: str | None = None) -> dict:
    """Объект, у которого все перечисленные поля обязательны."""
    schema: dict = {
        "type": "object",
        "required": list(props),
        "properties": props,
    }
    if description:
        schema["description"] = description
    return schema


def _without_meta(schema: dict) -> dict:
    """JSON Schema без $schema и $id — для вложения в components."""
    return {k: v for k, v in schema.items() if k not in ("$schema", "$id")}


def _request_schemas() -> dict:
    """Схемы запросов: запуск и предпросмотр."""
    request = _without_meta(request_schema.request_schema())
    scenario = request["properties"]["scenarios"]["items"]
    preview = {
        **request,
        "title": "Предпросмотр потребности одного сценария",
        "required": ["configuration", "task", "scenario"],
        "properties": {
            **{
                k: v
                for k, v in request["properties"].items()
                if k != "scenarios"
            },
            "scenario": scenario,
        },
    }
    return {
        "SimulationRequest": request,
        "PreviewRequest": preview,
    }


def _error_schemas() -> dict:
    return {
        "AuthError": _obj(
            {
                "code": {"enum": ["unauthorized", "forbidden"]},
                "message": {
                    **_STR,
                    "description": "Что случилось и как исправить, на русском.",
                },
            },
            "Отказ в доступе (docs/keycloak/middleware.md).",
        ),
        "FieldError": _obj({"field": _STR, "message": _STR}),
        "Error": {
            "type": "object",
            "required": ["error"],
            "properties": {
                "error": _STR,
                "errors": _arr(_ref("FieldError")),
            },
        },
    }


def _check_schemas() -> dict:
    """Проверки вердикта и пропускная способность в пик."""
    throughput = _obj(
        {
            "required_h": _NUM,
            "served_h": _NUM,
            "ratio": _NUM,
            "peak_hours": _INT,
        },
        "Вывезено против потребности в среднем по пиковым часам.",
    )
    check = _obj(
        {
            "code": {"enum": ["throughput", "wait", "completion", "battery"]},
            "name": _STR,
            "value": _NUM,
            "target": _NUM,
            "ok": _BOOL,
            "unit": _STR,
        }
    )
    checks = _obj(
        {
            "ok": _BOOL,
            "checks": _arr(_ref("Check")),
            "throughput": _ref("Throughput"),
            "layout_flag": _BOOL,
            "blocked_share": _NUM,
        }
    )
    return {"Throughput": throughput, "Check": check, "Checks": checks}


def _fleet_schemas() -> dict:
    """Изменение парка, уменьшение, рост и обоснование."""
    fleet = _obj({"robots": _INT, "chargers": _INT})
    curve_point = _obj(
        {
            "n": _INT,
            "c": _INT,
            "days": _INT,
            "on_time": _NUM,
            "on_time_min": _NUM,
            "throughput_ratio": _NUM,
            "util_peak": _NUM,
            "ok": _BOOL,
        }
    )
    station_row = _obj(
        {
            "c": _INT,
            "days": _INT,
            "on_time_min": _NUM,
            "charge_peak": _NUM,
            "depleted": _NUM,
            "ok": _BOOL,
        }
    )
    return {
        "Fleet": fleet,
        "FleetChange": _obj(
            {
                "robots": _INT,
                "chargers": _INT,
                "from_": _ref("Fleet"),
                "to": _ref("Fleet"),
            }
        ),
        "Reduction": _obj(
            {
                "target_volume": _NUM,
                "checked": _BOOL,
                "possible": _BOOL,
                "original_passes_growth": _BOOL,
            }
        ),
        "GrowthCheck": _obj(
            {
                "growth": _NUM,
                "ok": _BOOL,
                "on_time_min": _NUM,
                "days": _INT,
                "throughput_ratio": _NUM,
                "extra_robots": _nullable(_INT),
                "extra_chargers": _nullable(_INT),
            }
        ),
        "CurvePoint": curve_point,
        "StationRow": station_row,
        "Evidence": _obj(
            {
                "volume_k": _NUM,
                "curve": _arr(_ref("CurvePoint")),
                "stations": _arr(_ref("StationRow")),
            }
        ),
    }


def _kpi_schemas() -> dict:
    """KPI и почасовые строки прогона."""
    shares = {"type": "object", "additionalProperties": _NUM}
    before = {
        "on_time": _NUM,
        "on_time_min": _NUM,
        "util_peak": _NUM,
        "util_day": _NUM,
        "charge_peak": _NUM,
        "queue_peak": _NUM,
        "depleted": _NUM,
        "throughput": _ref("Throughput"),
        "fleet_shares": shares,
    }
    after = {
        **before,
        "completion": _NUM,
        "blocked_share": _NUM,
        "breakdowns": _NUM,
        "charger_util": _NUM,
    }
    hour = {
        "clock": _INT,
        "demand": _NUM,
        "done": _NUM,
        "on_time": _nullable(_NUM),
        "wait_mean_min": _nullable(_NUM),
        **{
            k: _NUM
            for k in (
                "work",
                "charge",
                "wait_charger",
                "down",
                "idle",
                "util",
                "backlog_max",
                "chargers_busy",
            )
        },
    }
    return {
        "Kpis": _obj(after, "KPI рекомендуемого состава на текущем объёме."),
        "KpisBefore": _obj(before, "KPI исходного состава."),
        "HourlyRow": _obj(hour),
    }


def _adjustment_schemas() -> dict:
    """Поправки для следующих шагов и итоговые параметры сценария."""
    item = _obj(
        {
            "code": _STR,
            "group": {"enum": ["fleet", "coefficient"]},
            "label": _STR,
            "base": _nullable(_NUM),
            "simulated": _nullable(_NUM),
            "unit": _STR,
            "apply": {"enum": ["override", "calibration"]},
            "note": _STR,
            "delta_rel": _nullable(_NUM),
            "significant": _BOOL,
            "source": {"const": "simulation"},
            "default_selected": _BOOL,
        }
    )
    item_set = _obj(
        {"items": _arr(_ref("Adjustment"))},
        "Предлагаемые поправки; какие из них принять, решает пользователь.",
    )
    resolved = _obj(
        {
            "value": {},
            "source": {"enum": ["user", "task", "default"]},
            "label": _STR,
        }
    )
    return {
        "Adjustment": item,
        "AdjustedInputSet": item_set,
        "ResolvedParam": resolved,
    }


def _run_schema() -> dict:
    """SimulationRun — итог проверки одного сценария."""
    status = {
        "enum": [
            "confirmed",
            "can_reduce",
            "needs_additions",
            "layout_bottleneck",
            "not_achievable",
        ]
    }
    verdict = _obj(
        {
            "title": _STR,
            "lines": _arr(_STR),
            "justification": _arr(_STR),
            "risks": _arr(_STR),
        }
    )
    demand = _obj(
        {
            "hours": _arr(_INT),
            "rate_in": _arr(_NUM),
            "rate_out": _arr(_NUM),
            "peak_in": _arr(_BOOL),
            "peak_out": _arr(_BOOL),
            "calc_peak_trips_h": _NUM,
        }
    )
    timing = _obj(
        {"total_s": _NUM, "runs": _INT, "per_run_s": _NUM, "configs": _INT}
    )
    resolved = {
        "type": "object",
        "description": "Значение и источник каждого параметра по группам.",
        "additionalProperties": {
            "anyOf": [
                _ref("ResolvedParam"),
                {
                    "type": "object",
                    "additionalProperties": _ref("ResolvedParam"),
                },
            ]
        },
    }
    return _obj(
        {
            "simulation_id": _STR,
            "configuration_id": _nullable(_STR),
            "simulation_version": {"const": version.SIM_VERSION},
            "scenario": _obj({"name": _STR}),
            "resolved_params": resolved,
            "status": status,
            "label": _nullable(_STR),
            "tolerance": _NUM,
            "fleet_policy": {"enum": ["add_only", "add_and_reduce"]},
            "design_volume": {"enum": ["current", "growth"]},
            "verdict": verdict,
            "checks_before": _ref("Checks"),
            "checks_after": _ref("Checks"),
            "fleet_change": _ref("FleetChange"),
            "diagnosis": _arr(_STR),
            "reduction": _nullable(_ref("Reduction")),
            "growth_check": _nullable(_ref("GrowthCheck")),
            "evidence": _ref("Evidence"),
            "kpis": _ref("Kpis"),
            "kpis_before": _ref("KpisBefore"),
            "hourly_before": _arr(_ref("HourlyRow")),
            "hourly_after": _arr(_ref("HourlyRow")),
            "demand": demand,
            "adjusted_input_set": _ref("AdjustedInputSet"),
            "warnings": _arr(_STR),
            "timing": timing,
        },
        "Итог проверки одного сценария. Денежных полей нет.",
    )


def _service_schemas() -> dict:
    """Ответы сервиса: предпросмотр, задание, справочники."""
    preview = _obj(
        {
            "hours": _arr(_INT),
            "rate_in": _arr(_NUM),
            "rate_out": _arr(_NUM),
            "peak_in": _arr(_BOOL),
            "peak_out": _arr(_BOOL),
            "calc_peak_trips_h": _NUM,
            "scenario_peak_trips_h": _NUM,
            "warnings": _arr(_STR),
        }
    )
    job = {
        "type": "object",
        "required": ["job_id", "status", "log", "elapsed"],
        "additionalProperties": False,
        "properties": {
            "job_id": _STR,
            "status": {"enum": ["queued", "running", "done", "error"]},
            "log": _arr(_STR),
            "workers": _INT,
            "elapsed": _NUM,
            "simulation_ids": _arr(_STR),
            "runs": _arr(_ref("SimulationRun")),
            "error": _STR,
            "errors": _arr(_ref("FieldError")),
        },
    }
    meta = _obj(
        {
            "simulation_version": _STR,
            "cpu": _INT,
            "simulation_params_spec": _arr(_ANY_OBJECT),
            "demo": _obj(
                {
                    "configurations": _arr(_ANY_OBJECT),
                    "location": _ANY_OBJECT,
                    "task": _ANY_OBJECT,
                }
            ),
        }
    )
    return {
        "Preview": preview,
        "JobAccepted": _obj({"job_id": _STR, "status_url": _STR}),
        "Health": _obj({"status": {"enum": ["ok", "unavailable"]}}),
        "Job": job,
        "Meta": meta,
    }


def _json(schema: dict, description: str) -> dict:
    return {"description": description, "content": {_JSON: {"schema": schema}}}


def _error(description: str) -> dict:
    return _json(_ref("Error"), description)


_UNAVAILABLE = "Хранилище недоступно, повторите позже."


def _get(
    summary: str, ok: dict, *, not_found: bool = False, storage: bool = False
) -> dict:
    responses = {"200": ok}
    if not_found:
        responses["404"] = _error("Не найдено.")
    if storage:
        responses["503"] = _error(_UNAVAILABLE)
    return {"get": {"summary": summary, "responses": responses}}


def _post(
    summary: str, body: str, responses: dict, *, storage: bool = False
) -> dict:
    responses = {
        **responses,
        "400": _error("Тело запроса — не JSON."),
        "413": _error("Тело запроса больше 1 МБ."),
    }
    if storage:
        responses["503"] = _error(_UNAVAILABLE)
    return {
        "post": {
            "summary": summary,
            "requestBody": {
                "required": True,
                "content": {_JSON: {"schema": _ref(body)}},
            },
            "responses": responses,
        }
    }


def _run_id() -> dict:
    return {
        "name": "simulation_id",
        "in": "path",
        "required": True,
        "schema": _STR,
    }


def _run_paths() -> dict:
    """Маршруты одного прогона: сам прогон и его 2D-трассы."""
    run = _get(
        "Прогон целиком",
        _json(_ref("SimulationRun"), "Прогон."),
        not_found=True,
        storage=True,
    )
    traces = _get(
        "Трассы прогона для 2D-плеера",
        _json(
            _arr(_ANY_OBJECT),
            "Трассы: «из подбора» и итоговый состав. Сжаты gzip "
            "(Content-Encoding), если клиент передал Accept-Encoding: gzip.",
        ),
        not_found=True,
        storage=True,
    )
    base = "/api/simulations/{simulation_id}"
    paths = {
        base: run,
        f"{base}/traces": traces,
    }
    for item in paths.values():
        for operation in item.values():
            operation["parameters"] = [_run_id()]
    return paths


def _paths() -> dict:
    """Все маршруты сервиса."""
    job_id = {"name": "job_id", "in": "path", "required": True, "schema": _STR}
    job = _get(
        "Ход задания и, когда готово, его прогоны",
        _json(
            _ref("Job"),
            "Задание. Опрашивать, пока status — queued или running; elapsed "
            "считается от постановки в очередь.",
        ),
        not_found=True,
        storage=True,
    )
    job["get"]["parameters"] = [job_id]
    return {
        "/": _get(
            "Экран шага «Симуляция»",
            {
                "description": "HTML-страница.",
                "content": {_HTML: {"schema": _STR}},
            },
        ),
        "/api/health": {
            "get": {
                "summary": "Доступность базы и ревизия её схемы",
                "responses": {
                    "200": _json(_ref("Health"), "База доступна."),
                    "503": _json(_ref("Health"), "База недоступна."),
                },
            }
        },
        "/api/meta": _get(
            "Справочники формы, примеры сценариев, демо-вход из подбора",
            _json(_ref("Meta"), "Справочники."),
        ),
        "/api/openapi.json": _get(
            "Эта спецификация", _json(_ANY_OBJECT, "OpenAPI 3.1.")
        ),
        "/api/simulations/schema": _get(
            "JSON Schema запроса POST /api/simulations",
            _json(_ANY_OBJECT, "JSON Schema (draft 2020-12)."),
        ),
        "/api/simulations/preview": _post(
            "Потребность по часам и сверка со следом расчёта — без имитации",
            "PreviewRequest",
            {
                "200": _json(_ref("Preview"), "Потребность по часам."),
                "422": _error("Ошибки входа по полям."),
            },
        ),
        "/api/simulations": _post(
            "Постановка проверки 1–2 сценариев в очередь",
            "SimulationRequest",
            {
                "202": _json(
                    _ref("JobAccepted"), "Задание в очереди (status queued)."
                ),
                "422": _error("Ошибки входа по полям."),
            },
            storage=True,
        ),
        "/api/simulations/jobs/{job_id}": job,
        **_run_paths(),
    }


# Пути без проверки токена; остальные — гостю или пользователю.
_PUBLIC_PATHS = frozenset({"/", "/api/health"})
_BEARER = "bearerAuth"


def _with_access(paths: dict) -> dict:
    """Требования доступа: токен необязателен, присланный — проверяется."""
    for path, item in paths.items():
        if path in _PUBLIC_PATHS:
            continue
        for operation in item.values():
            operation["security"] = [{}, {_BEARER: []}]
            operation["responses"]["401"] = _json(
                _ref("AuthError"), "Присланный токен невалиден или просрочен."
            )
            operation["responses"]["403"] = _json(
                _ref("AuthError"), "Прислан сервисный токен."
            )
    return paths


def spec() -> dict:
    """Возвращает OpenAPI 3.1 сервиса симуляции."""
    schemas = {
        **_request_schemas(),
        **_error_schemas(),
        **_check_schemas(),
        **_fleet_schemas(),
        **_kpi_schemas(),
        **_adjustment_schemas(),
        "SimulationRun": _run_schema(),
        **_service_schemas(),
    }
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "RAV5 Simulation Service",
            "version": version.SIM_VERSION,
            "description": "Шаг «Симуляция»: проверяет конфигурацию из "
            "подбора на имитации рабочего дня и предлагает изменение парка "
            "и поправки для следующих шагов. Денег не принимает и не считает."
            "\n\nДоступ — access token Keycloak (realm rav5, aud rav5-sim) "
            "в заголовке Authorization: Bearer. Без токена — гость; "
            "присланный токен обязан быть валидным. Задание, поставленное "
            "пользователем, и его прогоны видит только он: для остальных — "
            "404, как у несуществующего. Задание гостя открыто любому, кто "
            "знает его номер.",
        },
        "paths": _with_access(_paths()),
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                _BEARER: {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Access token Keycloak realm rav5.",
                }
            },
        },
    }
