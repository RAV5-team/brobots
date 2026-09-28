"""JSON snapshot encoding and decoding for domain dataclasses."""

from __future__ import annotations

from dataclasses import fields, is_dataclass, replace
from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from economic_service.domain.models import (
    CALCULATION_CURRENCY,
    AcquisitionModel,
    CalculationTrace,
    CandidateEconomics,
    CandidateStatus,
    ConfirmationStatus,
    EvaluationRequest,
    EvaluationResult,
    EvaluationSnapshot,
    EvaluationStatus,
    InputOrigin,
    MetricValue,
    Money,
    NormSet,
    RankingCriterion,
    RankingCriterionTrace,
    RankingItem,
    RankingItemStatus,
    RankingResult,
    RankingStatus,
    ReasonCode,
    RobotCandidate,
    Scenario,
    SourcedValue,
    SourceRef,
    TaskEconomicsInput,
)

_LEGACY_REASON_CODES = {
    "Catalog price is missing; economics are unresolved.": (
        ReasonCode.CATALOG_PRICE_MISSING
    ),
    "Maximum speed is missing; productivity is unresolved.": (
        ReasonCode.PRODUCTIVITY_INPUTS_MISSING
    ),
    "Loading time is missing; productivity is unresolved.": (
        ReasonCode.LOADING_TIME_MISSING
    ),
    "Unloading time is missing; productivity is unresolved.": (
        ReasonCode.UNLOADING_TIME_MISSING
    ),
    "Average power is missing; OPEX is unresolved.": (
        ReasonCode.AVERAGE_POWER_MISSING
    ),
    "Handling method is missing; labor replacement is unresolved.": (
        ReasonCode.HANDLING_METHOD_MISSING
    ),
    "Payload is missing for a divisible-load calculation.": (
        ReasonCode.PAYLOAD_MISSING
    ),
    "Catalog technical specifications require confirmation.": (
        ReasonCode.CATALOG_SPECS_UNCONFIRMED
    ),
    "CAPEX exceeds the planning budget.": ReasonCode.CAPEX_EXCEEDS_BUDGET,
    "Available charging power is insufficient.": (
        ReasonCode.CHARGING_POWER_INSUFFICIENT
    ),
    "Average fleet utilization is below 30%.": (
        ReasonCode.FLEET_UTILIZATION_BELOW_THRESHOLD
    ),
    "The modeled net annual benefit is not positive.": (
        ReasonCode.NON_POSITIVE_ANNUAL_BENEFIT
    ),
    "No positive-weight criteria have available values.": (
        ReasonCode.NO_POSITIVE_WEIGHT_CRITERIA
    ),
    "Baseline or robotized process TCO is unavailable.": (
        ReasonCode.CALCULATED_METRIC_UNAVAILABLE
    ),
    "Baseline or robotized process TCO is not numeric.": (
        ReasonCode.CALCULATED_METRIC_NOT_NUMERIC
    ),
    "Calculated metric is unavailable.": (
        ReasonCode.CALCULATED_METRIC_UNAVAILABLE
    ),
    "Calculated metric is not numeric.": (
        ReasonCode.CALCULATED_METRIC_NOT_NUMERIC
    ),
    "Location budget is unavailable.": (
        ReasonCode.LOCATION_BUDGET_UNAVAILABLE
    ),
    "Location budget must not be negative.": (
        ReasonCode.LOCATION_BUDGET_NEGATIVE
    ),
    "Total upfront CAPEX is unavailable.": (
        ReasonCode.UPFRONT_CAPEX_UNAVAILABLE
    ),
    "Total upfront CAPEX is not numeric.": (
        ReasonCode.UPFRONT_CAPEX_NOT_NUMERIC
    ),
    "Total upfront CAPEX must not be negative.": (
        ReasonCode.UPFRONT_CAPEX_NEGATIVE
    ),
    "Sourced value is unavailable.": ReasonCode.SOURCED_VALUE_UNAVAILABLE,
    "Sourced value is not a finite decimal.": (
        ReasonCode.SOURCED_VALUE_NOT_FINITE
    ),
}


def _reason_code(value: Any, *, legacy_reason_texts: bool) -> ReasonCode | None:
    if value is None:
        return None
    try:
        return ReasonCode(str(value))
    except ValueError:
        if not legacy_reason_texts:
            raise

    text = str(value)
    known_code = _LEGACY_REASON_CODES.get(text)
    if known_code is not None:
        return known_code
    status_prefix = "Catalog maturity status is "
    if text.startswith(status_prefix) and text.endswith("."):
        status = text.removeprefix(status_prefix).removesuffix(".").strip()
        if status:
            return ReasonCode.CATALOG_STATUS_NOT_OPERATIONAL
    return ReasonCode.LEGACY_UNMAPPED


def encode(value: Any) -> Any:
    """Converts domain values to JSON without losing decimal values."""

    if isinstance(value, Decimal):
        return {"__type__": "decimal", "value": str(value)}
    if isinstance(value, datetime):
        return {"__type__": "datetime", "value": value.isoformat()}
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return {
            field.name: encode(getattr(value, field.name))
            for field in fields(value)
        }
    if isinstance(value, tuple):
        return [encode(item) for item in value]
    if isinstance(value, list):
        return [encode(item) for item in value]
    if isinstance(value, dict):
        return {str(key): encode(item) for key, item in value.items()}
    return value


def _decimal(value: Any) -> Decimal:
    if isinstance(value, dict) and value.get("__type__") == "decimal":
        return Decimal(str(value["value"]))
    return Decimal(str(value))


def _datetime(value: Any) -> datetime:
    if isinstance(value, dict) and value.get("__type__") == "datetime":
        value = value["value"]
    return datetime.fromisoformat(str(value))


def _source(payload: dict[str, Any]) -> SourceRef:
    return SourceRef(
        source=str(payload["source"]),
        origin=InputOrigin(str(payload["origin"])),
        confirmation=ConfirmationStatus(str(payload["confirmation"])),
        version=payload.get("version"),
        note=payload.get("note"),
    )


def _money(payload: dict[str, Any]) -> Money:
    return Money(
        amount=_decimal(payload["amount"]),
        currency=str(payload["currency"]),
        scale=int(payload["scale"]),
    )


def _task(payload: dict[str, Any]) -> TaskEconomicsInput:
    return TaskEconomicsInput(
        project_id=str(payload["project_id"]),
        task_id=str(payload["task_id"]),
        operations_per_day=_decimal(payload["operations_per_day"]),
        peak_factor=_decimal(payload["peak_factor"]),
        automatable_share=_decimal(payload["automatable_share"]),
        operating_hours_per_day=_decimal(payload["operating_hours_per_day"]),
        one_way_route_m=_decimal(payload["one_way_route_m"]),
        site_speed_limit_mps=_decimal(payload["site_speed_limit_mps"]),
        load_unit_mass_kg=_decimal(payload["load_unit_mass_kg"]),
        load_is_divisible=bool(payload["load_is_divisible"]),
        available_charging_power_kw=_decimal(
            payload["available_charging_power_kw"]
        ),
        target_fte=_decimal(payload["target_fte"]),
        target_annual_payroll=_money(payload["target_annual_payroll"]),
        baseline_annual_payroll=_money(
            payload.get(
                "baseline_annual_payroll",
                payload.get("baseline_annual_opex"),
            )
        ),
        fleet_operators_per_shift=_decimal(
            payload["fleet_operators_per_shift"]
        ),
        shifts_per_day=_decimal(payload["shifts_per_day"]),
        staff_time_loss_share=_decimal(payload["staff_time_loss_share"]),
        fleet_operator_monthly_salary=_money(
            payload["fleet_operator_monthly_salary"]
        ),
        target_monthly_salary=_money(payload["target_monthly_salary"]),
        annual_staff_turnover=_decimal(payload["annual_staff_turnover"]),
        annual_other_benefits=_money(payload["annual_other_benefits"]),
        replacement_by_handling=tuple(
            (str(item[0]), _decimal(item[1]))
            for item in payload["replacement_by_handling"]
        ),
        horizon_years=int(payload["horizon_years"]),
        budget=(
            None if payload["budget"] is None else _money(payload["budget"])
        ),
        source=_source(payload["source"]),
        lift_trip_share=_decimal(payload.get("lift_trip_share", "0")),
        one_way_lift_seconds=_decimal(payload.get("one_way_lift_seconds", "0")),
        integration_cost=(
            None
            if payload.get("integration_cost") is None
            else _money(payload["integration_cost"])
        ),
        annual_consumables_per_robot=(
            None
            if payload.get("annual_consumables_per_robot") is None
            else _money(payload["annual_consumables_per_robot"])
        ),
    )


def _candidate(payload: dict[str, Any]) -> RobotCandidate:
    def optional_decimal(name: str) -> Decimal | None:
        value = payload.get(name)
        return None if value is None else _decimal(value)

    def sourced_decimal(name: str) -> SourcedValue[Decimal] | None:
        value = payload.get(name)
        if value is None:
            return None
        return SourcedValue(
            value=_decimal(value["value"]),
            unit=str(value["unit"]),
            source=_source(value["source"]),
        )

    return RobotCandidate(
        candidate_id=str(payload["candidate_id"]),
        robot_code=str(payload["robot_code"]),
        price=None if payload["price"] is None else _money(payload["price"]),
        payload_kg=optional_decimal("payload_kg"),
        max_speed_mps=optional_decimal("max_speed_mps"),
        loading_seconds=optional_decimal("loading_seconds"),
        unloading_seconds=optional_decimal("unloading_seconds"),
        average_power_kw=optional_decimal("average_power_kw"),
        handling_method=payload["handling_method"],
        catalog_status=str(payload["catalog_status"]),
        confirmation=ConfirmationStatus(str(payload["confirmation"])),
        source=_source(payload["source"]),
        acquisition_models=tuple(
            AcquisitionModel(str(model))
            for model in payload.get("acquisition_models", ())
        ),
        throughput_per_hour=sourced_decimal("throughput_per_hour"),
        maturity_trl=sourced_decimal("maturity_trl"),
        catalog_completeness_percent=sourced_decimal(
            "catalog_completeness_percent"
        ),
    )


def _norms(payload: dict[str, Any]) -> NormSet:
    decimal_fields = (
        "payroll_multiplier",
        "productive_time_share",
        "technical_availability",
        "fleet_reserve_share",
        "operating_speed_factor",
        "robots_per_charger",
        "charger_power_kw",
        "fms_upfront_share",
        "delivery_share",
        "commissioning_share",
        "capex_contingency_share",
        "annual_service_share",
        "annual_license_share",
        "annual_repair_share",
        "battery_life_years",
        "battery_replacement_share",
        "equipment_life_years",
        "discount_rate",
        "loan_share",
        "loan_interest_rate",
        "loan_term_years",
        "monthly_raas_share",
        "raas_setup_share",
        "recruitment_months_salary",
        "good_payback_years",
        "medium_payback_years",
        "site_preparation_share",
    )
    values = {name: _decimal(payload[name]) for name in decimal_fields}
    return NormSet(
        **values,
        charger_installed_price=_money(payload["charger_installed_price"]),
        training_cost=_money(payload["training_cost"]),
        electricity_price=_money(payload["electricity_price"]),
        annual_connectivity_cost=_money(payload["annual_connectivity_cost"]),
        source=_source(payload["source"]),
    )


def _scenario(payload: dict[str, Any]) -> Scenario:
    return Scenario(
        acquisition_model=AcquisitionModel(str(payload["acquisition_model"])),
        price_factor=_decimal(payload["price_factor"]),
        volume_factor=_decimal(payload["volume_factor"]),
        labor_factor=_decimal(payload["labor_factor"]),
        model_version=str(payload["model_version"]),
    )


def request_from_json(payload: dict[str, Any]) -> EvaluationRequest:
    """Reconstructs a domain request from an encoded JSON snapshot."""

    scenarios = tuple(_scenario(item) for item in payload["scenarios"])
    legacy_offers = tuple(
        dict.fromkeys(scenario.acquisition_model for scenario in scenarios)
    )
    candidates = tuple(_candidate(item) for item in payload["candidates"])
    candidates = tuple(
        replace(candidate, acquisition_models=legacy_offers)
        if not candidate.acquisition_models
        else candidate
        for candidate in candidates
    )

    return EvaluationRequest(
        evaluation_id=str(payload["evaluation_id"]),
        project_id=str(payload["project_id"]),
        model_version=str(payload["model_version"]),
        task=_task(payload["task"]),
        candidates=candidates,
        norms=_norms(payload["norms"]),
        scenarios=scenarios,
        requested_ranking_version=payload.get("requested_ranking_version"),
        calculation_currency=payload.get(
            "calculation_currency", CALCULATION_CURRENCY
        ),
        ranking_weights=(
            None
            if payload.get("ranking_weights") is None
            else tuple(
                (str(item[0]), _decimal(item[1]))
                for item in payload["ranking_weights"]
            )
        ),
    )


def _scalar(value: Any) -> Any:
    if isinstance(value, dict) and value.get("__type__") == "decimal":
        return _decimal(value)
    return value


def _trace(payload: dict[str, Any]) -> CalculationTrace:
    return CalculationTrace(
        formula_id=str(payload["formula_id"]),
        result=_scalar(payload["result"]),
        unit=str(payload["unit"]),
        source=_source(payload["source"]),
        inputs=tuple(
            (str(item[0]), _scalar(item[1])) for item in payload["inputs"]
        ),
    )


def _metric(payload: dict[str, Any]) -> MetricValue:
    return MetricValue(
        code=str(payload["code"]),
        value=_scalar(payload["value"]),
        unit=str(payload["unit"]),
        source=_source(payload["source"]),
    )


def _candidate_economics(
    payload: dict[str, Any], *, legacy_reason_texts: bool
) -> CandidateEconomics:
    # Legacy snapshots may still contain the removed applicability checks.
    return CandidateEconomics(
        candidate_id=str(payload["candidate_id"]),
        acquisition_model=AcquisitionModel(str(payload["acquisition_model"])),
        status=CandidateStatus(str(payload["status"])),
        metrics=tuple(_metric(item) for item in payload["metrics"]),
        traces=tuple(_trace(item) for item in payload["traces"]),
        risks=tuple(
            _reason_code(item, legacy_reason_texts=legacy_reason_texts)
            for item in payload["risks"]
        ),
    )


def _ranking(
    payload: dict[str, Any], *, legacy_reason_texts: bool
) -> RankingResult:
    def criterion_trace(item: dict[str, Any]) -> RankingCriterionTrace:
        raw_value = (
            None
            if item.get("raw_value") is None
            else _decimal(item["raw_value"])
        )
        return RankingCriterionTrace(
            code=RankingCriterion(str(item["code"])),
            raw_value=raw_value,
            unit=str(item.get("unit", "")),
            normalized_value=(
                None
                if item.get("normalized_value") is None
                else _decimal(item["normalized_value"])
            ),
            configured_weight=_decimal(item.get("configured_weight", "0")),
            effective_weight=(
                None
                if item.get("effective_weight") is None
                else _decimal(item["effective_weight"])
            ),
            contribution=(
                None
                if item.get("contribution") is None
                else _decimal(item["contribution"])
            ),
            provenance=tuple(
                _source(source) for source in item.get("provenance", ())
            ),
            is_missing=bool(item.get("is_missing", raw_value is None)),
            missing_reason=_reason_code(
                item.get("missing_reason"),
                legacy_reason_texts=legacy_reason_texts,
            ),
        )

    items = tuple(
        RankingItem(
            candidate_id=str(item["candidate_id"]),
            acquisition_model=AcquisitionModel(str(item["acquisition_model"])),
            candidate_status=CandidateStatus(str(item["candidate_status"])),
            risks=tuple(
                _reason_code(risk, legacy_reason_texts=legacy_reason_texts)
                for risk in item["risks"]
            ),
            rank=item["rank"],
            score=(None if item["score"] is None else _decimal(item["score"])),
            contributions=tuple(
                (str(pair[0]), _decimal(pair[1]))
                for pair in item.get("contributions", ())
            ),
            status=RankingItemStatus(
                item.get(
                    "status",
                    RankingItemStatus.UNRANKED.value
                    if item["score"] is None
                    else RankingItemStatus.RANKED.value,
                )
            ),
            unranked_reason=_reason_code(
                item.get("unranked_reason"),
                legacy_reason_texts=legacy_reason_texts,
            ),
            criteria=tuple(
                criterion_trace(trace)
                for trace in item.get("criteria", ())
            ),
        )
        for item in payload["items"]
    )
    return RankingResult(
        status=RankingStatus(str(payload["status"])),
        model_version=payload["model_version"],
        items=items,
    )


def result_from_json(
    payload: dict[str, Any], *, legacy_reason_texts: bool = False
) -> EvaluationResult:
    """Reconstructs a domain result from an encoded JSON snapshot."""

    return EvaluationResult(
        evaluation_id=str(payload["evaluation_id"]),
        project_id=str(payload["project_id"]),
        model_version=str(payload["model_version"]),
        status=EvaluationStatus(str(payload["status"])),
        candidates=tuple(
            _candidate_economics(
                item, legacy_reason_texts=legacy_reason_texts
            )
            for item in payload["candidates"]
        ),
        ranking=_ranking(
            payload["ranking"], legacy_reason_texts=legacy_reason_texts
        ),
    )


def snapshot_to_json(
    snapshot: EvaluationSnapshot,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns encoded input and result snapshots for JSON storage."""

    return encode(snapshot.request), encode(snapshot.result)


def snapshot_from_json(
    input_payload: dict[str, Any],
    result_payload: dict[str, Any],
    created_at: datetime,
    revision_of: str | None,
) -> EvaluationSnapshot:
    """Reconstructs an immutable domain snapshot from stored JSON."""

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    request = request_from_json(input_payload)
    return EvaluationSnapshot(
        evaluation_id=request.evaluation_id,
        project_id=request.project_id,
        request=request,
        result=result_from_json(
            result_payload,
            legacy_reason_texts=request.model_version == "economic-v1.1",
        ),
        created_at=created_at,
        revision_of=revision_of,
    )
