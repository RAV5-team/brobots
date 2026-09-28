"""Exports the OpenAPI contract of the service to packages/contracts.

Run from services/economics:

    python scripts/export_openapi.py

The API service consumes this contract; the OpenAPI contract test fails when
the committed file differs from the application.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

_CONTRACT_PATH = Path("packages", "contracts", "openapi", "economics.yaml")
CONTRACT = next(
    (
        parent / _CONTRACT_PATH
        for parent in Path(__file__).resolve().parents
        if (parent / "packages" / "contracts").is_dir()
    ),
    Path(__file__).resolve().parent / _CONTRACT_PATH,
)


def render_contract() -> str:
    """Renders the OpenAPI document of the application as YAML."""

    from economic_service.config import AppSettings
    from economic_service.http_app import create_app

    app = create_app(settings=AppSettings(database_url="sqlite://"))
    return yaml.safe_dump(
        app.openapi(), sort_keys=False, allow_unicode=True, width=100
    )


def main() -> int:
    """Writes the current OpenAPI document to the contract path."""

    CONTRACT.parent.mkdir(parents=True, exist_ok=True)
    CONTRACT.write_text(render_contract(), encoding="utf-8", newline="\n")
    print(f"written {CONTRACT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
