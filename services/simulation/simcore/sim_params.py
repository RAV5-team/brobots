"""Параметры шага «Симуляция» (simulation_params) и их разрешение.

Переменные, которые пользователь задаёт именно на этом шаге и которых
нет в подборе. Передаются в запросе на каждый сценарий:

    {"name": "…", "simulation_params": {
        "schedule":        {"shift_start_h", "shifts", "shift_h", "peak_k",
                            "peaks": [{"flow", "start_h", "dur_h"}]},
        "flows":           {"in_per_day", "out_per_day", "manual_share"},
        "service":         {"wait_limit_min", "on_time_target"},
        "growth":          0.2,
        "site_conditions": {"traffic", "abc", "mttr_h"},
        "verification":    {"tolerance", "fleet_policy", "design_volume"}
    }}

Любое поле можно опустить: тогда значение берётся из задачи (режим смен, объёмы,
коэффициент пика) или из значений по умолчанию. В ответе возвращается
resolved_params: итоговое значение и источник каждого поля — «user», «task» или
«default», чтобы вход симуляции был прослеживаемым.
"""

from __future__ import annotations

from typing import Any

# (группа, поле) → описание: тип, диапазон/варианты, значение по умолчанию,
# откуда брать, подпись
FIELDS: dict[tuple[str, str | None], dict] = {
    ("schedule", "shift_start_h"): dict(
        type="int",
        min=0,
        max=23,
        task="shift_start_h",
        default=7,
        label="Начало первой смены, ч",
    ),
    ("schedule", "shifts"): dict(
        type="int", min=1, max=3, task="shifts", default=2, label="Смен в сутки"
    ),
    ("schedule", "shift_h"): dict(
        type="int",
        min=1,
        max=24,
        task="shift_h",
        default=11,
        label="Длительность смены, ч",
    ),
    ("schedule", "peak_k"): dict(
        type="num",
        min=1,
        max=5,
        task="peak_k",
        default=1.5,
        label="Коэффициент пика",
    ),
    ("schedule", "peaks"): dict(
        type="peaks",
        default=None,
        label="Пиковые часы по потокам (null — как в расчёте: совпадают)",
    ),
    ("flows", "in_per_day"): dict(
        type="num",
        min=0,
        max=100000,
        task="in_per_day",
        label="Приёмка, паллет в сутки",
    ),
    ("flows", "out_per_day"): dict(
        type="num",
        min=0,
        max=100000,
        task="out_per_day",
        label="Отгрузка, паллет в сутки",
    ),
    ("flows", "manual_share"): dict(
        type="num",
        min=0,
        max=0.9,
        task="manual_share",
        default=0.0,
        label="Остаётся вручную, доля",
    ),
    ("service", "wait_limit_min"): dict(
        type="num",
        min=1,
        max=240,
        default=15,
        label="Паллета ждёт робота не дольше, мин",
    ),
    ("service", "on_time_target"): dict(
        type="num", min=0.5, max=1.0, default=0.95, label="Доля паллет в срок"
    ),
    ("growth", None): dict(
        type="num",
        min=0,
        max=1.0,
        default=0.2,
        label="Запас на рост объёма, доля",
    ),
    ("site_conditions", "traffic"): dict(
        type="enum",
        options=["none", "low", "mid", "high"],
        default="mid",
        label="Люди и погрузчики в проездах",
    ),
    ("site_conditions", "abc"): dict(
        type="enum",
        options=["none", "part", "full"],
        default="none",
        label="Ходовые паллеты у ворот",
    ),
    ("site_conditions", "mttr_h"): dict(
        type="num",
        min=0.1,
        max=72,
        default=2.0,
        label="Ремонт после поломки, ч",
    ),
    ("verification", "tolerance"): dict(
        type="num",
        min=0,
        max=0.5,
        default=0.10,
        label="Допуск расхождения с расчётом (норматив 34)",
    ),
    ("verification", "fleet_policy"): dict(
        type="enum",
        options=["add_only", "add_and_reduce"],
        default="add_and_reduce",
        label="Может ли симуляция предлагать уменьшение парка",
    ),
    ("verification", "design_volume"): dict(
        type="enum",
        options=["current", "growth"],
        default="current",
        label="Докупку считать на текущий объём или на рост",
    ),
}

# Ключи сценария; параметры задаются только в simulation_params.
_SCENARIO_KEYS = frozenset({"name", "simulation_params"})

# (группа, поле) → имя параметра в разобранном сценарии
FLAT: dict[tuple[str, str | None], str] = {
    ("schedule", "shift_start_h"): "shift_start_h",
    ("schedule", "shifts"): "shifts",
    ("schedule", "shift_h"): "shift_h",
    ("schedule", "peak_k"): "peak_k",
    ("schedule", "peaks"): "peaks",
    ("flows", "in_per_day"): "in_per_day",
    ("flows", "out_per_day"): "out_per_day",
    ("flows", "manual_share"): "manual_share",
    ("service", "wait_limit_min"): "wait_limit_min",
    ("service", "on_time_target"): "on_time_target",
    ("growth", None): "growth",
    ("site_conditions", "traffic"): "traffic",
    ("site_conditions", "abc"): "abc",
    ("site_conditions", "mttr_h"): "mttr_h",
    ("verification", "tolerance"): "tolerance",
    ("verification", "fleet_policy"): "fleet_policy",
    ("verification", "design_volume"): "design_volume",
}


def _error(path: str, message: str) -> dict:
    return {"field": path, "message": message}


def _check_number(spec: dict, v: Any, path: str, errors: list[dict]) -> Any:
    """Приводит к int или float и проверяет диапазон."""
    try:
        v = int(v) if spec["type"] == "int" else float(v)
    except (TypeError, ValueError):
        errors.append(_error(path, "должно быть числом"))
        return None
    if v < spec["min"] or v > spec["max"]:
        errors.append(
            _error(path, f"вне диапазона {spec["min"]}…{spec["max"]}")
        )
    return v


def _check_peaks(v: Any, path: str, errors: list[dict]) -> list | None:
    """Проверяет список пиков {flow, start_h, dur_h}.

    None означает пики как в расчёте подбора.
    """
    if v is None:
        return None
    if not isinstance(v, list):
        errors.append(_error(path, "список {flow, start_h, dur_h} или null"))
        return None
    out = []
    for i, p in enumerate(v):
        try:
            flow, st, du = p["flow"], int(p["start_h"]), int(p["dur_h"])
        except (KeyError, TypeError, ValueError):
            errors.append(_error(f"{path}[{i}]", "нужны flow, start_h, dur_h"))
            continue
        if flow not in ("in", "out") or not 0 <= st <= 23 or not 1 <= du <= 24:
            errors.append(
                _error(
                    f"{path}[{i}]", "flow ∈ {in, out}, start_h 0…23, dur_h 1…24"
                )
            )
        out.append({"flow": flow, "start_h": st, "dur_h": du})
    return out


def _check(spec: dict, v: Any, path: str, errors: list[dict]) -> Any:
    """Проверяет значение по описанию поля; ошибки дописывает в errors."""
    if spec["type"] in ("num", "int"):
        return _check_number(spec, v, path, errors)
    if spec["type"] == "peaks":
        return _check_peaks(v, path, errors)
    if v not in spec["options"]:
        errors.append(_error(path, f"одно из {spec["options"]}"))
    return v


def _groups(sp: dict, errors: list[dict]) -> dict:
    """Проверяет группы simulation_params: известные имена, объекты."""
    known = {g for g, f in FIELDS if f is not None}
    allowed = {g for g, _ in FIELDS}
    groups = {}
    for g, value in sp.items():
        path = f"simulation_params.{g}"
        if g not in allowed:
            errors.append(
                _error(path, f"неизвестная группа; допустимо {sorted(allowed)}")
            )
        elif g in known and value is not None and not isinstance(value, dict):
            errors.append(_error(path, "должен быть объектом"))
        else:
            groups[g] = value
    return groups


def _pick(
    spec: dict, given: tuple[bool, Any], task: dict, path: str, errors: list
) -> tuple[Any, str]:
    """Выбирает значение поля: из сценария, из задачи или по умолчанию.

    Returns:
        (значение, источник: user, task, default или missing).
    """
    has, raw = given
    task_key = spec.get("task")
    if has and not (raw is None and spec["type"] != "peaks"):
        return _check(spec, raw, path, errors), "user"
    if task_key and task.get(task_key) is not None:
        return _check(spec, task[task_key], f"task.{task_key}", errors), "task"
    if "default" in spec:
        return spec["default"], "default"
    errors.append(_error(path, "не задано ни в сценарии, ни в задаче"))
    return None, "missing"


def resolve(scenario: dict, task: dict) -> tuple[dict, dict, list[dict]]:
    """Разбирает сценарий в значения параметров, resolved_params и ошибки.

    Значение берётся из сценария, иначе из задачи, иначе по умолчанию.
    Значения из сценария и из задачи проверяются по одним правилам.

    Args:
        scenario: Сценарий {name, simulation_params}.
        task: Задача проекта — источник значений по умолчанию.

    Returns:
        (параметры по именам FLAT, resolved_params, ошибки).
    """
    if not isinstance(scenario, dict):
        return {}, {}, [_error("scenario", "должен быть объектом")]
    sp = scenario.get("simulation_params") or {}
    if not isinstance(sp, dict):
        return {}, {}, [_error("simulation_params", "должен быть объектом")]
    errors = [
        _error(f"scenario.{k}", "параметры сценария — в simulation_params")
        for k in scenario
        if k not in _SCENARIO_KEYS
    ]
    groups = _groups(sp, errors)
    params = {"name": scenario.get("name", "Сценарий")}
    resolved: dict = {}
    for (g, f), spec in FIELDS.items():
        if f is None:
            given = (g in groups, groups.get(g))
            path = f"simulation_params.{g}"
        else:
            grp = groups.get(g) or {}
            given = (f in grp, grp.get(f))
            path = f"simulation_params.{g}.{f}"
        val, src = _pick(spec, given, task, path, errors)
        params[FLAT[(g, f)]] = val
        entry = {"value": val, "source": src, "label": spec["label"]}
        if f is None:
            resolved[g] = entry
        else:
            resolved.setdefault(g, {})[f] = entry
    return params, resolved, errors
