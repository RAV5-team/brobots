"""JSON Schema запроса: строится из правил разбора ядра.

Правила полей — в simcore.inputs (числовые блоки) и simcore.sim_params
(параметры шага); здесь они описываются как контракт HTTP API.
"""

from __future__ import annotations

from typing import Any

from simcore import inputs
from simcore import sim_params

_PEAKS_SCHEMA = {
    "oneOf": [
        {"type": "null"},
        {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["flow", "start_h", "dur_h"],
                "additionalProperties": False,
                "properties": {
                    "flow": {"enum": ["in", "out"]},
                    "start_h": {"type": "integer", "minimum": 0, "maximum": 23},
                    "dur_h": {"type": "integer", "minimum": 1, "maximum": 24},
                },
            },
        },
    ],
}


def _prop_schema(spec: dict) -> dict:
    """JSON Schema одного поля simulation_params."""
    label = spec["label"]
    if spec.get("task"):
        label += f" (по умолчанию — из задачи: {spec["task"]})"
    if spec["type"] in ("int", "num"):
        prop = {
            "type": "integer" if spec["type"] == "int" else "number",
            "minimum": spec["min"],
            "maximum": spec["max"],
            "description": label,
        }
    elif spec["type"] == "enum":
        prop = {"enum": spec["options"], "description": label}
    else:
        prop = {"description": label, **_PEAKS_SCHEMA}
    if spec.get("default") is not None:
        prop["default"] = spec["default"]
    return prop


def params_schema() -> dict:
    """Возвращает JSON Schema (draft 2020-12) блока simulation_params."""
    props: dict[str, Any] = {}
    for (g, f), spec in sim_params.FIELDS.items():
        if f is None:
            props[g] = _prop_schema(spec)
            continue
        group = props.setdefault(
            g,
            {"type": "object", "additionalProperties": False, "properties": {}},
        )
        group["properties"][f] = _prop_schema(spec)
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "rav5/simulation_params",
        "title": "Параметры шага «Симуляция»",
        "type": "object",
        "additionalProperties": False,
        "properties": props,
    }


def _block_schema(
    rules: dict[str, inputs.NumberRule], description: str
) -> dict:
    """JSON Schema блока запроса по таблице правил."""
    props = {}
    for key, rule in rules.items():
        prop: dict = {"type": "number"}
        if rule.lo is not None:
            prop["minimum"] = rule.lo
        if rule.hi is not None:
            prop["maximum"] = rule.hi
        if rule.doc:
            prop["description"] = rule.doc
        props[key] = prop
    return {
        "type": "object",
        "description": description,
        "required": [k for k, r in rules.items() if r.required],
        "additionalProperties": False,
        "properties": props,
    }


def request_schema() -> dict:
    """Возвращает JSON Schema запроса POST /api/simulations целиком.

    Схема строится из тех же правил, по которым разбирается запрос. Поля вне
    контракта не допускаются.
    """
    configuration = _block_schema(
        inputs.FLEET,
        "Конфигурация, выбранная на шаге «Подбор», и след расчёта.",
    )
    configuration["required"].append("robot")
    robot = _block_schema(inputs.ROBOT, "Паспорт робота.")
    robot["properties"]["name"] = {"type": "string"}
    configuration["properties"].update(
        configuration_id={"type": "string"},
        robot=robot,
        calc=_block_schema(
            inputs.CALC,
            "След расчёта шага «Подбор». Значений по умолчанию нет: от "
            "этих полей зависят вердикт и поправки.",
        ),
    )
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "rav5/simulation_request",
        "title": "Запуск симуляции выбранной конфигурации",
        "type": "object",
        "required": ["configuration", "task", "scenarios"],
        "additionalProperties": False,
        "properties": {
            "configuration": configuration,
            "location": _block_schema(inputs.LOCATION, "Площадка."),
            "task": {
                "type": "object",
                "description": "Задача проекта: источник значений по "
                "умолчанию для simulation_params.schedule и flows.",
                "additionalProperties": False,
                "properties": {
                    k: {"type": "number"} for k in sorted(inputs.TASK_KEYS)
                },
            },
            "scenarios": {
                "type": "array",
                "minItems": 1,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "required": ["simulation_params"],
                    "additionalProperties": False,
                    "properties": {
                        "name": {"type": "string"},
                        "simulation_params": params_schema(),
                    },
                },
            },
        },
    }
