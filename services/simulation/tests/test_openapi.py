"""OpenAPI сервиса: файл в docs/ совпадает с кодом и с реальными ответами."""

from __future__ import annotations

import json
import math
import pathlib
import re

import jsonschema
import openapi_spec_validator
import pytest

from adapters.web import demo_input
from adapters.web import openapi
from simcore import inputs
from simcore import version

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_SPEC = openapi.spec()


def _component(name: str) -> jsonschema.Draft202012Validator:
    """Валидатор схемы из components с разрешением $ref."""
    schema = {
        "$ref": f"#/components/schemas/{name}",
        "components": _SPEC["components"],
    }
    return jsonschema.Draft202012Validator(schema)


def _as_json(value):
    """Значение так, как его отдаёт сервер: NaN → null, без ключей «_»."""
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {
            k: _as_json(v) for k, v in value.items() if not k.startswith("_")
        }
    if isinstance(value, list):
        return [_as_json(v) for v in value]
    return value


def test_docs_openapi_matches_code():
    documented = json.loads(
        (_ROOT / "docs" / "openapi.json").read_text(encoding="utf-8")
    )
    assert documented == _SPEC


def test_spec_is_valid_openapi():
    openapi_spec_validator.validate(_SPEC)


def test_simulation_run_matches_schema(verified):
    errors = list(_component("SimulationRun").iter_errors(_as_json(verified)))

    assert not errors, [f"{list(e.path)}: {e.message}" for e in errors[:5]]


def test_run_schema_lists_every_response_field(verified):
    documented = set(
        _SPEC["components"]["schemas"]["SimulationRun"]["required"]
    )

    assert documented == {k for k in verified if not k.startswith("_")}


def _pick(value, schema: dict):
    """Оставляет только поля схемы — как экран перед отправкой запроса."""
    props = schema.get("properties")
    if props is None or not isinstance(value, dict):
        return value
    return {k: _pick(v, props[k]) for k, v in value.items() if k in props}


@pytest.mark.parametrize(
    "config",
    demo_input.demo_configurations(),
    ids=lambda c: c["configuration_id"],
)
def test_demo_input_filtered_by_schema_is_a_valid_request(config):
    """Демо-вход, отфильтрованный по схеме, как на экране, — валидный запрос."""
    schema = _SPEC["components"]["schemas"]["SimulationRequest"]
    request = _pick(
        {
            "configuration": config,
            "location": demo_input.location(),
            "task": demo_input.task(),
            "scenarios": [{"name": "Как в расчёте", "simulation_params": {}}],
        },
        schema,
    )

    assert not list(_component("SimulationRequest").iter_errors(request))
    inputs.build(
        {k: v for k, v in request.items() if k != "scenarios"},
        request["scenarios"][0],
    )


def test_server_docstring_lists_the_documented_routes():
    doc = (_ROOT / "adapters" / "web" / "server.py").read_text(encoding="utf-8")
    listed = set(re.findall(r"^\s+(?:GET|POST)\s+(/\S+)", doc, re.M))

    assert listed | {"/"} == set(_SPEC["paths"])


@pytest.mark.parametrize(
    "path, method",
    [
        ("/api/simulations/preview", "post"),
        ("/api/simulations", "post"),
    ],
)
def test_posts_document_input_errors(path, method):
    assert {"400", "422"} <= set(_SPEC["paths"][path][method]["responses"])


def test_version_matches_service():
    assert _SPEC["info"]["version"] == version.SIM_VERSION


def test_job_status_includes_queued():
    job = _SPEC["components"]["schemas"]["Job"]

    assert job["properties"]["status"]["enum"][0] == "queued"


@pytest.mark.parametrize(
    "path, method",
    [
        ("/api/simulations", "post"),
        ("/api/simulations/jobs/{job_id}", "get"),
        ("/api/simulations/{simulation_id}", "get"),
        ("/api/simulations/{simulation_id}/traces", "get"),
    ],
)
def test_storage_routes_document_503(path, method):
    assert "503" in _SPEC["paths"][path][method]["responses"]
