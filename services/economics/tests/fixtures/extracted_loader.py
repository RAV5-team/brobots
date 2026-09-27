"""Explicit adapters for the extracted Russian source fixtures."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from economic_service.domain.models import Money

EXTRACTED_DATA_DIR = Path(__file__).parent / "extracted"


def load_catalog_products() -> tuple[dict[str, Any], ...]:
    """Loads catalog rows without inventing missing technical fields."""

    payload = _load_json("catalog_products.json")
    return tuple(payload["records"])


def load_facility_scenario(name: str) -> tuple[dict[str, Any], ...]:
    """Loads the named facility scenario parameter rows."""

    payload = _load_json("facility_scenarios.json")
    return tuple(payload["scenarios"][name])


def money_from_rub_millions(amount: int | str | Decimal) -> Money:
    """Maps a source value labelled ``млн руб.`` to base RUB units."""

    return Money(Decimal(str(amount)), "RUB", scale=6)


def _load_json(filename: str) -> dict[str, Any]:
    return json.loads(
        (EXTRACTED_DATA_DIR / filename).read_text(encoding="utf-8")
    )
