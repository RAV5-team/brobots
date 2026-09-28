"""Keeps the committed OpenAPI contract in sync with the application."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "export_openapi.py"


def _exporter():
    spec = importlib.util.spec_from_file_location("export_openapi", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_contract_matches_application() -> None:
    exporter = _exporter()
    if not exporter.CONTRACT.exists():
        # The Docker test stage has no packages/; CI checks the file there.
        pytest.skip("packages/contracts is not available")
    committed = exporter.CONTRACT.read_text(encoding="utf-8")

    assert committed.replace("\r\n", "\n") == exporter.render_contract(), (
        "packages/contracts/openapi/economics.yaml is stale: run "
        "`python scripts/export_openapi.py` in services/economics"
    )
