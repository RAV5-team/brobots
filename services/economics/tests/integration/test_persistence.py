"""Round-trip tests for immutable SQLAlchemy snapshot persistence."""

from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool

from economic_service.adapters.persistence.codec import (
    snapshot_from_json,
    snapshot_to_json,
)
from economic_service.adapters.persistence.sqlalchemy_repository import (
    SNAPSHOT_SCHEMA_VERSION,
    Base,
    EvaluationSnapshotRecord,
    SqlAlchemyEvaluationSnapshotRepository,
)
from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.application.evaluation import EvaluationApplicationService
from economic_service.domain.models import (
    AcquisitionModel,
    EvaluationRequest,
    RankingCriterion,
    ReasonCode,
)
from tests.unit.application.test_calculation import _request


class _FixedClock:
    """Stable clock for snapshot tests."""

    def now(self) -> datetime:
        return datetime(2026, 9, 23, 12, 0, tzinfo=UTC)


def _repository() -> SqlAlchemyEvaluationSnapshotRepository:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return SqlAlchemyEvaluationSnapshotRepository.from_engine(engine)


def test_snapshot_round_trip_preserves_domain_values_and_traces() -> None:
    repository = _repository()
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=_FixedClock(),
    )
    request = replace(
        _request(),
        ranking_weights=tuple(
            (criterion.value, weight)
            for criterion, weight in zip(
                RankingCriterion,
                tuple(
                    Decimal(weight)
                    for weight in ("30", "15", "15", "10", "10", "10", "5", "5")
                ),
                strict=True,
            )
        ),
    )

    saved = service.evaluate(request)
    loaded = repository.get(request.evaluation_id)

    assert loaded == saved
    assert loaded is not None
    assert loaded.request.norms.source == request.norms.source
    assert loaded.result.candidates[0].traces
    assert loaded.result.ranking.model_version == "ranking-v1"
    assert loaded.request.ranking_weights == request.ranking_weights
    assert loaded.result.ranking.items[0].criteria

    input_payload, result_payload = snapshot_to_json(saved)
    assert "baseline_annual_payroll" in input_payload["task"]
    assert "baseline_annual_opex" not in input_payload["task"]

    legacy_input_payload = dict(input_payload)
    legacy_task_payload = dict(input_payload["task"])
    legacy_task_payload["baseline_annual_opex"] = legacy_task_payload.pop(
        "baseline_annual_payroll"
    )
    legacy_input_payload["task"] = legacy_task_payload
    legacy_input_payload.pop("ranking_weights")
    legacy_candidates = [
        dict(candidate) for candidate in legacy_input_payload["candidates"]
    ]
    for candidate in legacy_candidates:
        candidate.pop("acquisition_models", None)
        candidate.pop("throughput_per_hour", None)
        candidate.pop("maturity_trl", None)
        candidate.pop("catalog_completeness_percent", None)
    legacy_input_payload["candidates"] = legacy_candidates
    legacy_result_payload = dict(result_payload)
    legacy_ranking = dict(result_payload["ranking"])
    legacy_items = [dict(item) for item in legacy_ranking["items"]]
    for item in legacy_items:
        item.pop("status", None)
        item.pop("unranked_reason", None)
        item.pop("criteria", None)
    legacy_ranking["items"] = legacy_items
    legacy_result_payload["ranking"] = legacy_ranking
    legacy_loaded = snapshot_from_json(
        legacy_input_payload,
        legacy_result_payload,
        saved.created_at,
        saved.revision_of,
    )
    assert legacy_loaded.request.ranking_weights is None
    assert legacy_loaded.request.candidates[0].acquisition_models == (
        AcquisitionModel.PURCHASE,
    )
    assert legacy_loaded.request.candidates[0].throughput_per_hour is None
    assert legacy_loaded.result.ranking.items[0].criteria == ()

    with repository.session_factory() as session:
        record = session.scalar(
            select(EvaluationSnapshotRecord).where(
                EvaluationSnapshotRecord.evaluation_id == request.evaluation_id
            )
        )
    assert record is not None
    assert record.schema_version == SNAPSHOT_SCHEMA_VERSION == "2"


def test_legacy_v11_reason_texts_decode_to_codes_and_unknown_fallback() -> None:
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=_repository(),
        clock=_FixedClock(),
    )
    saved = service.evaluate(_request())
    input_payload, result_payload = snapshot_to_json(saved)
    input_payload["model_version"] = "economic-v1.1"
    result_payload["model_version"] = "economic-v1.1"
    result_payload["candidates"][0]["risks"] = [
        "Catalog price is missing; economics are unresolved.",
        "Maximum speed is missing; productivity is unresolved.",
        "Loading time is missing; productivity is unresolved.",
        "Unloading time is missing; productivity is unresolved.",
        "Average power is missing; OPEX is unresolved.",
        "Handling method is missing; labor replacement is unresolved.",
        "Payload is missing for a divisible-load calculation.",
        "Catalog maturity status is testing.",
        "Catalog technical specifications require confirmation.",
        "CAPEX exceeds the planning budget.",
        "Available charging power is insufficient.",
        "Average fleet utilization is below 30%.",
        "The modeled net annual benefit is not positive.",
        "An unknown historic reason.",
    ]
    ranking_item = result_payload["ranking"]["items"][0]
    ranking_item["risks"] = [
        "Baseline or robotized process TCO is unavailable.",
        "Baseline or robotized process TCO is not numeric.",
        "Location budget is unavailable.",
        "Location budget must not be negative.",
        "Total upfront CAPEX is unavailable.",
        "Total upfront CAPEX is not numeric.",
        "Total upfront CAPEX must not be negative.",
        "Sourced value is unavailable.",
        "Sourced value is not a finite decimal.",
        "Calculated metric is unavailable.",
        "Calculated metric is not numeric.",
    ]
    ranking_item["unranked_reason"] = (
        "No positive-weight criteria have available values."
    )
    maturity_trace = next(
        trace
        for trace in ranking_item["criteria"]
        if trace["code"] == RankingCriterion.MATURITY.value
    )
    maturity_trace["missing_reason"] = "Sourced value is unavailable."

    loaded = snapshot_from_json(
        input_payload,
        result_payload,
        saved.created_at,
        saved.revision_of,
    )

    assert loaded.request.model_version == "economic-v1.1"
    assert loaded.result.candidates[0].risks[:13] == (
        ReasonCode.CATALOG_PRICE_MISSING,
        ReasonCode.PRODUCTIVITY_INPUTS_MISSING,
        ReasonCode.LOADING_TIME_MISSING,
        ReasonCode.UNLOADING_TIME_MISSING,
        ReasonCode.AVERAGE_POWER_MISSING,
        ReasonCode.HANDLING_METHOD_MISSING,
        ReasonCode.PAYLOAD_MISSING,
        ReasonCode.CATALOG_STATUS_NOT_OPERATIONAL,
        ReasonCode.CATALOG_SPECS_UNCONFIRMED,
        ReasonCode.CAPEX_EXCEEDS_BUDGET,
        ReasonCode.CHARGING_POWER_INSUFFICIENT,
        ReasonCode.FLEET_UTILIZATION_BELOW_THRESHOLD,
        ReasonCode.NON_POSITIVE_ANNUAL_BENEFIT,
    )
    assert loaded.result.candidates[0].risks[-1] is ReasonCode.LEGACY_UNMAPPED
    assert loaded.result.ranking.items[0].risks == (
        ReasonCode.CALCULATED_METRIC_UNAVAILABLE,
        ReasonCode.CALCULATED_METRIC_NOT_NUMERIC,
        ReasonCode.LOCATION_BUDGET_UNAVAILABLE,
        ReasonCode.LOCATION_BUDGET_NEGATIVE,
        ReasonCode.UPFRONT_CAPEX_UNAVAILABLE,
        ReasonCode.UPFRONT_CAPEX_NOT_NUMERIC,
        ReasonCode.UPFRONT_CAPEX_NEGATIVE,
        ReasonCode.SOURCED_VALUE_UNAVAILABLE,
        ReasonCode.SOURCED_VALUE_NOT_FINITE,
        ReasonCode.CALCULATED_METRIC_UNAVAILABLE,
        ReasonCode.CALCULATED_METRIC_NOT_NUMERIC,
    )
    assert loaded.result.ranking.items[0].unranked_reason is (
        ReasonCode.NO_POSITIVE_WEIGHT_CRITERIA
    )
    assert (
        next(
            trace
            for trace in loaded.result.ranking.items[0].criteria
            if trace.code is RankingCriterion.MATURITY
        ).missing_reason
        is ReasonCode.SOURCED_VALUE_UNAVAILABLE
    )


def test_recalculation_inserts_a_new_revision() -> None:
    repository = _repository()
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=_FixedClock(),
    )
    request: EvaluationRequest = _request()

    service.evaluate(request)
    service.evaluate(request)

    with repository.session_factory() as session:
        rows = session.scalars(
            select(EvaluationSnapshotRecord)
            .where(
                EvaluationSnapshotRecord.evaluation_id == request.evaluation_id
            )
            .order_by(EvaluationSnapshotRecord.revision)
        ).all()

    assert len(rows) == 2
    assert [row.revision for row in rows] == [1, 2]
    assert rows[0].snapshot_id != rows[1].snapshot_id
    assert rows[1].revision_of == request.evaluation_id


def test_recalculation_preserves_old_snapshot_when_inputs_change() -> None:
    repository = _repository()
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=_FixedClock(),
    )
    request = _request()
    first = service.evaluate(request)
    first_input, first_result = snapshot_to_json(first)
    changed_weights = tuple(
        (
            criterion.value,
            Decimal("100")
            if criterion is RankingCriterion.PAYBACK
            else Decimal("0"),
        )
        for criterion in RankingCriterion
    )
    revised = replace(request, ranking_weights=changed_weights)

    second = service.evaluate(revised)

    with repository.session_factory() as session:
        rows = session.scalars(
            select(EvaluationSnapshotRecord)
            .where(
                EvaluationSnapshotRecord.evaluation_id == request.evaluation_id
            )
            .order_by(EvaluationSnapshotRecord.revision)
        ).all()

    assert [row.revision for row in rows] == [1, 2]
    assert rows[0].input_snapshot == first_input
    assert rows[0].result_snapshot == first_result
    assert rows[1].input_snapshot["ranking_weights"]
    assert rows[0].request_digest != rows[1].request_digest
    assert repository.get(request.evaluation_id) == second
    assert second.revision_of == request.evaluation_id
    assert second.request.ranking_weights == changed_weights


def test_scoring_uses_pre_screened_candidates_without_rechecking() -> None:
    repository = _repository()
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=_FixedClock(),
    )
    applicable = _request().candidates[0]
    pre_screened = replace(
        applicable,
        candidate_id="under-capacity",
        payload_kg=Decimal("50"),
    )
    request = replace(_request(), candidates=(applicable, pre_screened))

    saved = service.evaluate(request)
    loaded = repository.get(request.evaluation_id)

    assert loaded == saved
    candidate_statuses = [
        candidate.status.value for candidate in saved.result.candidates
    ]
    assert candidate_statuses == ["applicable", "applicable"]
    assert [item.candidate_id for item in saved.result.ranking.items] == [
        applicable.candidate_id,
        pre_screened.candidate_id,
    ]
    assert saved.result.ranking.items[0].criteria
    assert loaded is not None
    assert loaded.result.ranking == saved.result.ranking
