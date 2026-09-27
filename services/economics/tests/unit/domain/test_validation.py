"""Tests for domain input validation."""

from dataclasses import replace
from decimal import Decimal

import pytest

import economic_service.domain.errors as domain_errors
import economic_service.domain.models as domain_models
import economic_service.domain.validation as domain_validation

SOURCE = domain_models.SourceRef(
    source="test",
    origin=domain_models.InputOrigin.USER,
    confirmation=domain_models.ConfirmationStatus.CONFIRMED,
)


def _task(horizon_years: int = 5) -> domain_models.TaskEconomicsInput:
    """Builds a valid task fixture for validation tests."""

    return domain_models.TaskEconomicsInput(
        project_id="project-1",
        task_id="task-1",
        operations_per_day=Decimal("100"),
        peak_factor=Decimal("1.5"),
        automatable_share=Decimal("0.9"),
        operating_hours_per_day=Decimal("16"),
        one_way_route_m=Decimal("100"),
        site_speed_limit_mps=Decimal("1.5"),
        load_unit_mass_kg=Decimal("800"),
        load_is_divisible=False,
        available_charging_power_kw=Decimal("100"),
        target_fte=Decimal("10"),
        target_annual_payroll=domain_models.Money(Decimal("100000")),
        baseline_annual_payroll=domain_models.Money(Decimal("100000")),
        fleet_operators_per_shift=Decimal("1"),
        shifts_per_day=Decimal("2"),
        staff_time_loss_share=Decimal("0.25"),
        fleet_operator_monthly_salary=domain_models.Money(Decimal("5000")),
        target_monthly_salary=domain_models.Money(Decimal("5000")),
        annual_staff_turnover=Decimal("0.1"),
        annual_other_benefits=domain_models.Money(Decimal("0")),
        replacement_by_handling=(("forks", Decimal("0.8")),),
        horizon_years=horizon_years,
        budget=domain_models.Money(Decimal("1000000")),
        source=SOURCE,
    )


def test_validate_task_accepts_valid_input() -> None:
    """A complete five-year RUB task passes validation."""

    domain_validation.validate_task(_task())


def test_validate_task_rejects_short_horizon() -> None:
    """The economic methodology requires at least five years."""

    with pytest.raises(domain_errors.InvalidInputError):
        domain_validation.validate_task(_task(horizon_years=4))


def test_validate_calculation_money_rejects_other_currency() -> None:
    """V1 calculation inputs must use RUB."""

    with pytest.raises(domain_errors.UnsupportedCurrencyError):
        domain_validation.validate_calculation_money(
            domain_models.Money(Decimal("1"), "EUR"),
            "price",
        )


def test_validate_task_rejects_mixed_currency_optional_cost() -> None:
    """Optional economic inputs must remain in the RUB evaluation currency."""

    task = replace(
        _task(),
        integration_cost=domain_models.Money(Decimal("1"), "EUR"),
    )

    with pytest.raises(domain_errors.CurrencyMismatchError):
        domain_validation.validate_task(task)
