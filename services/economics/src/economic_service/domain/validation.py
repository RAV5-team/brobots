"""Validation helpers for economic domain inputs."""

from __future__ import annotations

from decimal import Decimal

from economic_service.domain.errors import (
    CurrencyMismatchError,
    InvalidInputError,
    UnsupportedCurrencyError,
)
from economic_service.domain.models import (
    CALCULATION_CURRENCY,
    EvaluationRequest,
    Money,
    NormSet,
    RankingCriterion,
    RobotCandidate,
    TaskEconomicsInput,
)


def validate_calculation_money(money: Money, field_name: str) -> None:
    """Ensures that a v1 monetary value uses the canonical currency."""

    if money.currency != CALCULATION_CURRENCY:
        raise UnsupportedCurrencyError(
            f"{field_name} must use {CALCULATION_CURRENCY} in model v1; "
            f"got {money.currency}."
        )


def validate_same_currency(money_values: tuple[Money, ...]) -> None:
    """Ensures that a set of monetary values uses one currency."""

    currencies = {money.currency for money in money_values}
    if len(currencies) > 1:
        raise CurrencyMismatchError(
            "All monetary values in one evaluation must use one currency."
        )


def validate_fraction(value: Decimal, field_name: str) -> None:
    """Ensures that a decimal value is a closed fraction from zero to one."""

    if value < 0 or value > 1:
        raise InvalidInputError(f"{field_name} must be between 0 and 1.")


def validate_task(task: TaskEconomicsInput) -> None:
    """Validates task prerequisites required by the calculation engine."""

    if not task.project_id or not task.task_id:
        raise InvalidInputError("Task identifiers are required.")
    if task.operations_per_day < 0:
        raise InvalidInputError("operations_per_day must not be negative.")
    if task.peak_factor < 0:
        raise InvalidInputError("peak_factor must not be negative.")
    if task.operating_hours_per_day <= 0:
        raise InvalidInputError("operating_hours_per_day must be positive.")
    if task.one_way_route_m < 0:
        raise InvalidInputError("one_way_route_m must not be negative.")
    if task.site_speed_limit_mps <= 0:
        raise InvalidInputError("site_speed_limit_mps must be positive.")
    if task.load_unit_mass_kg < 0:
        raise InvalidInputError("load_unit_mass_kg must not be negative.")
    if task.available_charging_power_kw < 0:
        raise InvalidInputError(
            "available_charging_power_kw must not be negative."
        )
    if task.lift_trip_share < 0 or task.lift_trip_share > 1:
        raise InvalidInputError("lift_trip_share must be between 0 and 1.")
    if task.one_way_lift_seconds < 0:
        raise InvalidInputError("one_way_lift_seconds must not be negative.")
    if task.target_fte < 0:
        raise InvalidInputError("target_fte must not be negative.")
    if task.fleet_operators_per_shift < 0 or task.shifts_per_day <= 0:
        raise InvalidInputError("Fleet staffing and shifts are invalid.")
    if task.horizon_years < 5:
        raise InvalidInputError("horizon_years must be at least five.")

    validate_fraction(task.automatable_share, "automatable_share")
    validate_fraction(task.staff_time_loss_share, "staff_time_loss_share")
    validate_fraction(task.annual_staff_turnover, "annual_staff_turnover")
    for handling_method, replacement_share in task.replacement_by_handling:
        if not handling_method:
            raise InvalidInputError("Handling method names must not be empty.")
        validate_fraction(
            replacement_share,
            f"replacement_by_handling[{handling_method}]",
        )

    monetary_values: tuple[Money, ...] = (
        task.target_annual_payroll,
        task.baseline_annual_payroll,
        task.fleet_operator_monthly_salary,
        task.target_monthly_salary,
        task.annual_other_benefits,
    )
    if task.budget is not None:
        monetary_values += (task.budget,)
    if task.integration_cost is not None:
        monetary_values += (task.integration_cost,)
    if task.annual_consumables_per_robot is not None:
        monetary_values += (task.annual_consumables_per_robot,)
    validate_same_currency(monetary_values)
    for field_name, money in (
        ("target_annual_payroll", task.target_annual_payroll),
        ("baseline_annual_payroll", task.baseline_annual_payroll),
        ("fleet_operator_monthly_salary", task.fleet_operator_monthly_salary),
        ("target_monthly_salary", task.target_monthly_salary),
        ("annual_other_benefits", task.annual_other_benefits),
    ):
        validate_calculation_money(money, field_name)
    if task.budget is not None:
        validate_calculation_money(task.budget, "budget")
    if task.integration_cost is not None:
        validate_calculation_money(task.integration_cost, "integration_cost")
    if task.annual_consumables_per_robot is not None:
        validate_calculation_money(
            task.annual_consumables_per_robot,
            "annual_consumables_per_robot",
        )


def validate_norms(norms: NormSet) -> None:
    """Validates the versioned norms required by the economic model."""

    fractions = (
        ("productive_time_share", norms.productive_time_share),
        ("technical_availability", norms.technical_availability),
        ("fleet_reserve_share", norms.fleet_reserve_share),
        ("operating_speed_factor", norms.operating_speed_factor),
        ("fms_upfront_share", norms.fms_upfront_share),
        ("delivery_share", norms.delivery_share),
        ("commissioning_share", norms.commissioning_share),
        ("capex_contingency_share", norms.capex_contingency_share),
        ("annual_service_share", norms.annual_service_share),
        ("annual_license_share", norms.annual_license_share),
        ("annual_repair_share", norms.annual_repair_share),
        ("battery_replacement_share", norms.battery_replacement_share),
        ("discount_rate", norms.discount_rate),
        ("loan_share", norms.loan_share),
        ("loan_interest_rate", norms.loan_interest_rate),
        ("monthly_raas_share", norms.monthly_raas_share),
        ("raas_setup_share", norms.raas_setup_share),
        ("site_preparation_share", norms.site_preparation_share),
    )
    for field_name, value in fractions:
        validate_fraction(value, field_name)

    positive_values = (
        ("payroll_multiplier", norms.payroll_multiplier),
        ("operating_speed_factor", norms.operating_speed_factor),
        ("robots_per_charger", norms.robots_per_charger),
        ("charger_power_kw", norms.charger_power_kw),
        ("battery_life_years", norms.battery_life_years),
        ("equipment_life_years", norms.equipment_life_years),
        ("loan_term_years", norms.loan_term_years),
        ("good_payback_years", norms.good_payback_years),
        ("medium_payback_years", norms.medium_payback_years),
    )
    for field_name, value in positive_values:
        if value <= 0:
            raise InvalidInputError(f"{field_name} must be positive.")

    for field_name, money in (
        ("charger_installed_price", norms.charger_installed_price),
        ("training_cost", norms.training_cost),
        ("electricity_price", norms.electricity_price),
        ("annual_connectivity_cost", norms.annual_connectivity_cost),
    ):
        validate_calculation_money(money, field_name)


def validate_candidate(candidate: RobotCandidate) -> None:
    """Validates supplied catalog values without rejecting missing evidence."""

    if candidate.price is not None:
        validate_calculation_money(candidate.price, "candidate.price")
        if candidate.price.base_amount <= 0:
            raise InvalidInputError("candidate.price must be positive.")
    for field_name, value in (
        ("payload_kg", candidate.payload_kg),
        ("average_power_kw", candidate.average_power_kw),
    ):
        if value is not None and value < 0:
            raise InvalidInputError(
                f"candidate.{field_name} must not be negative."
            )
    if candidate.max_speed_mps is not None and candidate.max_speed_mps <= 0:
        raise InvalidInputError("candidate.max_speed_mps must be positive.")
    for field_name, value in (
        ("loading_seconds", candidate.loading_seconds),
        ("unloading_seconds", candidate.unloading_seconds),
    ):
        if value is not None and value < 0:
            raise InvalidInputError(
                f"candidate.{field_name} must not be negative."
            )
    for field_name, sourced_value, unit, minimum, maximum in (
        (
            "maturity_trl",
            candidate.maturity_trl,
            "TRL",
            Decimal("1"),
            Decimal("9"),
        ),
        (
            "catalog_completeness_percent",
            candidate.catalog_completeness_percent,
            "%",
            Decimal("0"),
            Decimal("100"),
        ),
    ):
        if sourced_value is None:
            continue
        value = sourced_value.value
        if not isinstance(value, Decimal) or not value.is_finite():
            raise InvalidInputError(
                f"candidate.{field_name} must be a finite Decimal."
            )
        if sourced_value.unit != unit:
            raise InvalidInputError(
                f"candidate.{field_name} must use {unit} units."
            )
        if value < minimum or value > maximum:
            raise InvalidInputError(
                f"candidate.{field_name} must be between "
                f"{minimum} and {maximum}."
            )


def validate_ranking_weights(
    weights: tuple[tuple[str, Decimal], ...] | None,
) -> None:
    """Validates a complete per-evaluation override of ranking weights."""

    if weights is None:
        return
    expected_codes = {criterion.value for criterion in RankingCriterion}
    supplied_codes = [code for code, _ in weights]
    if len(supplied_codes) != len(set(supplied_codes)):
        raise InvalidInputError("Ranking weight criteria must be unique.")
    if set(supplied_codes) != expected_codes:
        raise InvalidInputError(
            "Ranking weights must include exactly the eight supported "
            "criteria."
        )
    total = Decimal("0")
    for code, weight in weights:
        if not isinstance(weight, Decimal) or not weight.is_finite():
            raise InvalidInputError(
                f"Ranking weight for {code} must be a finite Decimal."
            )
        if weight < 0:
            raise InvalidInputError(
                f"Ranking weight for {code} must not be negative."
            )
        total += weight
    if total != Decimal("100"):
        raise InvalidInputError("Ranking weights must sum exactly to 100.")


def validate_evaluation_request(request: EvaluationRequest) -> None:
    """Validates the cross-object invariants of an evaluation request."""

    if not request.evaluation_id or not request.project_id:
        raise InvalidInputError(
            "Evaluation and project identifiers are required."
        )
    if not request.model_version:
        raise InvalidInputError("model_version is required.")
    if request.calculation_currency != CALCULATION_CURRENCY:
        raise UnsupportedCurrencyError(
            "model v1 calculation_currency must be "
            f"{CALCULATION_CURRENCY}; got {request.calculation_currency}."
        )
    validate_task(request.task)
    validate_norms(request.norms)
    validate_ranking_weights(request.ranking_weights)
    if not request.candidates:
        raise InvalidInputError("At least one candidate is required.")
    if not request.scenarios:
        raise InvalidInputError(
            "At least one acquisition scenario is required."
        )
    candidate_ids = [candidate.candidate_id for candidate in request.candidates]
    if len(candidate_ids) != len(set(candidate_ids)):
        raise InvalidInputError("Candidate identifiers must be unique.")

    for candidate in request.candidates:
        validate_candidate(candidate)
    for scenario in request.scenarios:
        if scenario.price_factor <= 0:
            raise InvalidInputError("price_factor must be positive.")
        if scenario.volume_factor <= 0:
            raise InvalidInputError("volume_factor must be positive.")
        if scenario.labor_factor <= 0:
            raise InvalidInputError("labor_factor must be positive.")
