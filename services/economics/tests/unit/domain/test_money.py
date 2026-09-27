"""Tests for domain money values."""

from decimal import Decimal

import pytest

from economic_service.domain.errors import InvalidInputError
from economic_service.domain.models import Money


def test_money_normalizes_currency_and_source_scale() -> None:
    """Scaled RUB input converts to base units without binary floats."""

    money = Money(Decimal("80"), "rub", scale=6)

    assert money.currency == "RUB"
    assert money.base_amount == Decimal("80000000")
    assert money.user_amount == Decimal("80000000.00")


def test_money_rejects_invalid_currency() -> None:
    """Currency values must be three-letter codes."""

    with pytest.raises(InvalidInputError):
        Money(Decimal("1"), "US")


def test_money_rejects_non_finite_amount() -> None:
    """NaN and infinity must not enter financial calculations."""

    with pytest.raises(InvalidInputError):
        Money(Decimal("NaN"))
