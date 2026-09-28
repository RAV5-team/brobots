"""Formula and status tests for the economic calculation engine."""

from dataclasses import replace
from decimal import Decimal

import pytest

from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.application.scoring import ScoringUseCase
from economic_service.domain.errors import (
    InvalidInputError,
    UnsupportedCurrencyError,
)
from economic_service.domain.models import (
    AcquisitionModel,
    CandidateStatus,
    ConfirmationStatus,
    EvaluationRequest,
    EvaluationStatus,
    InputOrigin,
    Money,
    NormSet,
    RobotCandidate,
    Scenario,
    SourcedValue,
    SourceRef,
    TaskEconomicsInput,
)

SOURCE = SourceRef(
    source="test-fixture",
    origin=InputOrigin.USER,
    confirmation=ConfirmationStatus.CONFIRMED,
    version="fixture-1",
)


def _money(value: str) -> Money:
    return Money(Decimal(value))


def _task() -> TaskEconomicsInput:
    return TaskEconomicsInput(
        project_id="project-1",
        task_id="task-1",
        operations_per_day=Decimal("100"),
        peak_factor=Decimal("2"),
        automatable_share=Decimal("1"),
        operating_hours_per_day=Decimal("10"),
        one_way_route_m=Decimal("100"),
        site_speed_limit_mps=Decimal("2"),
        load_unit_mass_kg=Decimal("100"),
        load_is_divisible=False,
        available_charging_power_kw=Decimal("5"),
        target_fte=Decimal("10"),
        target_annual_payroll=_money("100000"),
        baseline_annual_payroll=_money("120000"),
        fleet_operators_per_shift=Decimal("0.5"),
        shifts_per_day=Decimal("2"),
        staff_time_loss_share=Decimal("0.1"),
        fleet_operator_monthly_salary=_money("1000"),
        target_monthly_salary=_money("1000"),
        annual_staff_turnover=Decimal("0.1"),
        annual_other_benefits=_money("1000"),
        replacement_by_handling=(("forks", Decimal("0.5")),),
        horizon_years=5,
        budget=_money("100000"),
        source=SOURCE,
    )


def _candidate(
    price: Money | None = None,
    *,
    missing_price: bool = False,
) -> RobotCandidate:
    if price is None and not missing_price:
        price = _money("10000")
    return RobotCandidate(
        candidate_id="robot-1",
        robot_code="ROBOT-1",
        price=price,
        payload_kg=Decimal("100"),
        max_speed_mps=Decimal("2"),
        loading_seconds=Decimal("10"),
        unloading_seconds=Decimal("20"),
        average_power_kw=Decimal("1"),
        handling_method="forks",
        catalog_status="operation",
        confirmation=ConfirmationStatus.CONFIRMED,
        source=SOURCE,
        acquisition_models=(AcquisitionModel.PURCHASE,),
    )


def _norms() -> NormSet:
    return NormSet(
        payroll_multiplier=Decimal("1"),
        productive_time_share=Decimal("0.8"),
        technical_availability=Decimal("0.9"),
        fleet_reserve_share=Decimal("0.1"),
        operating_speed_factor=Decimal("1"),
        robots_per_charger=Decimal("2"),
        charger_installed_price=_money("1000"),
        charger_power_kw=Decimal("2.5"),
        fms_upfront_share=Decimal("0.1"),
        delivery_share=Decimal("0.05"),
        commissioning_share=Decimal("0.1"),
        training_cost=_money("500"),
        capex_contingency_share=Decimal("0.1"),
        annual_service_share=Decimal("0.05"),
        annual_license_share=Decimal("0.02"),
        annual_repair_share=Decimal("0.03"),
        electricity_price=_money("0.2"),
        battery_life_years=Decimal("4"),
        battery_replacement_share=Decimal("0.1"),
        annual_connectivity_cost=_money("100"),
        equipment_life_years=Decimal("10"),
        discount_rate=Decimal("0.1"),
        loan_share=Decimal("0.5"),
        loan_interest_rate=Decimal("0.1"),
        loan_term_years=Decimal("5"),
        monthly_raas_share=Decimal("0.02"),
        raas_setup_share=Decimal("0.1"),
        recruitment_months_salary=Decimal("1"),
        good_payback_years=Decimal("2"),
        medium_payback_years=Decimal("4"),
        site_preparation_share=Decimal("0.05"),
        source=SOURCE,
    )


def _request(
    candidate: RobotCandidate | None = None,
    acquisition_model: AcquisitionModel = AcquisitionModel.PURCHASE,
) -> EvaluationRequest:
    selected_candidate = (
        _candidate()
        if candidate is None
        else candidate
    )
    if candidate is None:
        selected_candidate = replace(
            selected_candidate,
            acquisition_models=(acquisition_model,),
        )
    return EvaluationRequest(
        evaluation_id="evaluation-1",
        project_id="project-1",
        model_version="economic-v1.2",
        task=_task(),
        candidates=(selected_candidate,),
        norms=_norms(),
        scenarios=(
            Scenario(
                acquisition_model=acquisition_model,
                price_factor=Decimal("1"),
                volume_factor=Decimal("1"),
                labor_factor=Decimal("1"),
                model_version="economic-v1.2",
            ),
        ),
    )


def _metric(result, code: str):
    return next(metric for metric in result.metrics if metric.code == code)


def test_purchase_calculation_records_traceable_formula_outputs() -> None:
    result = EconomicCalculationEngine().calculate(_request()).candidates[0]

    assert result.status is CandidateStatus.APPLICABLE
    assert _metric(
        result, "candidate.demand.peak_trips_per_hour"
    ).value == Decimal("20")
    assert _metric(
        result, "candidate.productivity.cycle_seconds"
    ).value == Decimal("130")
    assert _metric(result, "candidate.fleet.robot_count").value == Decimal("2")
    assert _metric(result, "candidate.fleet.charger_count").value == Decimal(
        "1"
    )
    assert _metric(result, "candidate.capex.equipment").value == Decimal(
        "20000"
    )
    assert _metric(result, "candidate.capex.charging").value == Decimal("1000")
    assert _metric(result, "candidate.capex.equipment").unit == "RUB"
    baseline_payroll = _metric(result, "candidate.opex.baseline_annual_opex")
    process_opex = _metric(result, "candidate.opex.annual_process_opex")
    assert baseline_payroll.value == Decimal("120000")
    assert process_opex.value != baseline_payroll.value
    assert _metric(result, "candidate.effects.net_annual_benefit").unit == (
        "RUB/year"
    )
    assert len(result.metrics) == len(result.traces)
    assert {metric.code for metric in result.metrics} == {
        trace.formula_id for trace in result.traces
    }
    assert all(trace.inputs for trace in result.traces)
    assert tuple(metric.code for metric in result.metrics) == tuple(
        trace.formula_id for trace in result.traces
    )
    assert all(
        (metric.code, metric.value, metric.unit)
        == (trace.formula_id, trace.result, trace.unit)
        for metric, trace in zip(result.metrics, result.traces, strict=True)
    )
    assert tuple(
        dict.fromkeys(metric.code.split(".")[1] for metric in result.metrics)
    ) == (
        "demand",
        "labor",
        "productivity",
        "fleet",
        "price",
        "capex",
        "opex",
        "effects",
        "returns",
        "budget",
        "interpretation",
    )
    trips_trace = next(
        trace
        for trace in result.traces
        if trace.formula_id == "candidate.demand.trips_per_operation"
    )
    assert trips_trace.inputs == (
        ("load_unit_mass_kg", Decimal("100")),
        ("payload_kg", Decimal("100")),
        ("load_is_divisible", False),
    )


def test_raas_excludes_purchase_only_costs_and_keeps_setup_cost() -> None:
    result = (
        EconomicCalculationEngine()
        .calculate(_request(acquisition_model=AcquisitionModel.RAAS))
        .candidates[0]
    )

    assert _metric(result, "candidate.price.is_purchase").value == Decimal("0")
    assert _metric(result, "candidate.capex.equipment").value == Decimal("0")
    assert _metric(result, "candidate.capex.charging").value == Decimal("0")
    assert _metric(result, "candidate.capex.commissioning").value == Decimal(
        "2000"
    )
    assert _metric(result, "candidate.opex.annual_raas_cost").value == Decimal(
        "4800"
    )
    assert _metric(
        result, "candidate.effects.annual_depreciation"
    ).value == Decimal("0")


def test_missing_price_is_unresolved_and_over_budget_is_not_excluded() -> None:
    request = _request(candidate=_candidate(missing_price=True))
    missing_price = EconomicCalculationEngine().calculate(request)

    assert missing_price.status is EvaluationStatus.PARTIAL
    assert (
        missing_price.candidates[0].status
        is CandidateStatus.UNRESOLVED_ECONOMICS
    )
    assert missing_price.candidates[0].metrics == ()

    over_budget = replace(
        request,
        candidates=(_candidate(price=_money("1000000")),),
    )
    result = EconomicCalculationEngine().calculate(over_budget)

    assert result.candidates[0].status is CandidateStatus.APPLICABLE
    assert (
        _metric(result.candidates[0], "candidate.budget.within_budget").value
        is False
    )


def test_missing_handling_makes_labor_economics_unresolved() -> None:
    candidate = replace(_candidate(), handling_method=None)
    result = EconomicCalculationEngine().calculate(
        _request(candidate=candidate)
    )

    assert result.status is EvaluationStatus.PARTIAL
    assert result.candidates[0].status is CandidateStatus.UNRESOLVED_ECONOMICS


def test_divisible_load_uses_payload_to_calculate_trip_count() -> None:
    task = replace(_task(), load_is_divisible=True)
    candidate = replace(_candidate(), payload_kg=Decimal("50"))
    result = EconomicCalculationEngine().calculate(
        replace(_request(candidate=candidate), task=task)
    )

    candidate_result = result.candidates[0]

    trips_per_operation = _metric(
        candidate_result,
        "candidate.demand.trips_per_operation",
    )
    assert trips_per_operation.value == Decimal("2")
    assert candidate_result.status is CandidateStatus.APPLICABLE


def test_missing_payload_keeps_divisible_load_economics_unresolved() -> None:
    task = replace(_task(), load_is_divisible=True)
    candidate = replace(_candidate(), payload_kg=None)
    result = EconomicCalculationEngine().calculate(
        replace(_request(candidate=candidate), task=task)
    )

    candidate_result = result.candidates[0]

    assert candidate_result.status is CandidateStatus.UNRESOLVED_ECONOMICS


def test_calculation_does_not_resolve_ranking_versions() -> None:
    request = replace(
        _request(),
        requested_ranking_version="ranking-v2",
    )

    calculated = EconomicCalculationEngine().calculate(request)
    assert calculated.candidates


def test_default_ranking_model_is_resolved_without_override() -> None:
    request = _request()
    calculated = EconomicCalculationEngine().calculate(request)
    result = ScoringUseCase.ranking_v1().score(request, calculated.candidates)

    assert result.model_version == "ranking-v1"


def test_candidate_scoring_inputs_accept_values_in_declared_ranges() -> None:
    candidate = replace(
        _candidate(),
        maturity_trl=SourcedValue(Decimal("7"), "TRL", SOURCE),
        catalog_completeness_percent=SourcedValue(Decimal("85"), "%", SOURCE),
    )

    request = _request(candidate)
    calculated = EconomicCalculationEngine().calculate(request)
    result = ScoringUseCase.ranking_v1().score(request, calculated.candidates)

    assert result.model_version == "ranking-v1"


@pytest.mark.parametrize(
    ("field_name", "value", "unit"),
    (
        ("maturity_trl", Decimal("0"), "TRL"),
        ("maturity_trl", Decimal("10"), "TRL"),
        ("maturity_trl", Decimal("7"), "%"),
        ("catalog_completeness_percent", Decimal("-1"), "%"),
        ("catalog_completeness_percent", Decimal("101"), "%"),
        ("catalog_completeness_percent", Decimal("50"), "fraction"),
    ),
)
def test_candidate_scoring_inputs_reject_invalid_units_or_ranges(
    field_name: str, value: Decimal, unit: str
) -> None:
    candidate = replace(
        _candidate(),
        **{
            field_name: SourcedValue(value, unit, SOURCE),
        },
    )

    with pytest.raises(InvalidInputError):
        EconomicCalculationEngine().calculate(_request(candidate))


def test_evaluation_accepts_complete_decimal_ranking_weight_override() -> None:
    weights = (
        ("payback", Decimal("30")),
        ("roi", Decimal("15")),
        ("annual_effect", Decimal("15")),
        ("budget_fit", Decimal("10")),
        ("tco_savings", Decimal("10")),
        ("maturity", Decimal("10")),
        ("data_quality", Decimal("5")),
        ("fleet_utilization", Decimal("5")),
    )
    request = replace(_request(), ranking_weights=weights)

    EconomicCalculationEngine().calculate(request)


@pytest.mark.parametrize(
    "weights",
    (
        (("payback", Decimal("100")),),
        (
            ("payback", Decimal("30")),
            ("roi", Decimal("15")),
            ("annual_effect", Decimal("15")),
            ("budget_fit", Decimal("10")),
            ("tco_savings", Decimal("10")),
            ("maturity", Decimal("10")),
            ("data_quality", Decimal("5")),
            ("fleet_utilization", Decimal("-1")),
        ),
        (
            ("payback", Decimal("30")),
            ("roi", Decimal("15")),
            ("annual_effect", Decimal("15")),
            ("budget_fit", Decimal("10")),
            ("tco_savings", Decimal("10")),
            ("maturity", Decimal("10")),
            ("data_quality", Decimal("5")),
            ("fleet_utilization", Decimal("NaN")),
        ),
        (
            ("payback", Decimal("30")),
            ("roi", Decimal("15")),
            ("annual_effect", Decimal("15")),
            ("budget_fit", Decimal("10")),
            ("tco_savings", Decimal("10")),
            ("maturity", Decimal("10")),
            ("data_quality", Decimal("5")),
            ("fleet_utilization", Decimal("4")),
        ),
        (
            ("payback", Decimal("30")),
            ("roi", Decimal("15")),
            ("annual_effect", Decimal("15")),
            ("budget_fit", Decimal("10")),
            ("tco_savings", Decimal("10")),
            ("maturity", Decimal("10")),
            ("data_quality", Decimal("5")),
            ("fleet_utilization", Decimal("5")),
            ("other", Decimal("0")),
        ),
    ),
)
def test_evaluation_rejects_incomplete_or_invalid_ranking_weights(
    weights: tuple[tuple[str, Decimal], ...],
) -> None:
    with pytest.raises(InvalidInputError):
        EconomicCalculationEngine().calculate(
            replace(_request(), ranking_weights=weights)
        )


def test_calculation_rejects_non_rub_calculation_currency() -> None:
    """The calculation currency is an explicit, versioned RUB contract."""

    request = replace(_request(), calculation_currency="USD")

    with pytest.raises(UnsupportedCurrencyError):
        EconomicCalculationEngine().calculate(request)


@pytest.mark.parametrize(
    "acquisition_models",
    [
        (),
        (AcquisitionModel.PURCHASE, AcquisitionModel.PURCHASE),
    ],
)
def test_evaluation_rejects_invalid_candidate_acquisition_offers(
    acquisition_models: tuple[AcquisitionModel, ...],
) -> None:
    candidate = replace(
        _candidate(), acquisition_models=acquisition_models
    )

    with pytest.raises(InvalidInputError):
        EconomicCalculationEngine().calculate(_request(candidate))


def test_calculation_only_expands_offered_purchase_and_raas_scenarios() -> None:
    purchase_candidate = replace(
        _candidate(),
        candidate_id="purchase-only",
        acquisition_models=(AcquisitionModel.PURCHASE,),
    )
    raas_candidate = replace(
        _candidate(),
        candidate_id="raas-only",
        acquisition_models=(AcquisitionModel.RAAS,),
    )
    request = replace(
        _request(purchase_candidate),
        candidates=(purchase_candidate, raas_candidate),
        scenarios=(
            _request(acquisition_model=AcquisitionModel.PURCHASE).scenarios[0],
            _request(acquisition_model=AcquisitionModel.RAAS).scenarios[0],
        ),
    )

    results = EconomicCalculationEngine().calculate(request).candidates

    assert [
        (item.candidate_id, item.acquisition_model) for item in results
    ] == [
        ("purchase-only", AcquisitionModel.PURCHASE),
        ("raas-only", AcquisitionModel.RAAS),
    ]


def test_calculation_omits_candidates_without_a_selected_scenario() -> None:
    purchase_candidate = replace(
        _candidate(),
        candidate_id="purchase-only",
        acquisition_models=(AcquisitionModel.PURCHASE,),
    )
    unmatched_candidate = replace(
        _candidate(),
        candidate_id="raas-only",
        acquisition_models=(AcquisitionModel.RAAS,),
    )
    request = replace(
        _request(purchase_candidate),
        candidates=(purchase_candidate, unmatched_candidate),
    )

    results = EconomicCalculationEngine().calculate(request).candidates

    assert [
        (item.candidate_id, item.acquisition_model) for item in results
    ] == [("purchase-only", AcquisitionModel.PURCHASE)]


def test_calculation_rejects_no_matching_candidate_scenario() -> None:
    candidate = replace(
        _candidate(), acquisition_models=(AcquisitionModel.RAAS,)
    )

    with pytest.raises(InvalidInputError, match="No candidate acquisition"):
        EconomicCalculationEngine().calculate(_request(candidate))


def test_evaluation_accepts_positive_finite_sourced_throughput() -> None:
    candidate = replace(
        _candidate(),
        throughput_per_hour=SourcedValue(
            Decimal("12.5"), "task_units/hour", SOURCE
        ),
    )

    result = EconomicCalculationEngine().calculate(_request(candidate))

    assert result.candidates


def test_catalog_throughput_converts_capacity_and_applies_norms() -> None:
    candidate = replace(
        _candidate(),
        payload_kg=Decimal("100"),
        throughput_per_hour=SourcedValue(
            Decimal("12.5"), "task_units/hour", SOURCE
        ),
    )
    task = replace(
        _task(),
        load_unit_mass_kg=Decimal("250"),
        load_is_divisible=True,
    )
    request = replace(_request(candidate), task=task)

    result = EconomicCalculationEngine().calculate(request).candidates[0]

    assert _metric(
        result, "candidate.productivity.catalog_throughput_per_hour"
    ).value == Decimal("12.5")
    assert _metric(
        result, "candidate.productivity.trips_per_process_unit"
    ).value == Decimal("3")
    assert _metric(
        result, "candidate.productivity.nominal_trips_per_robot_hour"
    ).value == Decimal("37.5")
    assert _metric(
        result, "candidate.productivity.effective_trips_per_robot_hour"
    ).value == Decimal("27.00")
    assert _metric(
        result, "candidate.fleet.average_utilization"
    ).value == Decimal("30") / (Decimal("3") * Decimal("37.5"))


def test_catalog_throughput_precedence_allows_missing_cycle_inputs() -> None:
    candidate = replace(
        _candidate(),
        max_speed_mps=None,
        loading_seconds=None,
        unloading_seconds=None,
        throughput_per_hour=SourcedValue(
            Decimal("12.5"), "task_units/hour", SOURCE
        ),
    )

    result = EconomicCalculationEngine().calculate(
        _request(candidate)
    ).candidates[0]

    assert _metric(
        result, "candidate.productivity.catalog_throughput_per_hour"
    ).value == Decimal("12.5")
    assert _metric(
        result, "candidate.productivity.effective_trips_per_robot_hour"
    ).value == Decimal("9.000")
    assert "candidate.productivity.cycle_seconds" not in {
        metric.code for metric in result.metrics
    }


@pytest.mark.parametrize(
    "value",
    [
        Decimal("0"),
        Decimal("-1"),
        Decimal("NaN"),
        Decimal("Infinity"),
    ],
)
def test_evaluation_rejects_invalid_sourced_throughput(
    value: Decimal,
) -> None:
    candidate = replace(
        _candidate(),
        throughput_per_hour=SourcedValue(
            value, "task_units/hour", SOURCE
        ),
    )

    with pytest.raises(InvalidInputError):
        EconomicCalculationEngine().calculate(_request(candidate))
