"""Versioned scoring and explanation for calculated candidate economics."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from economic_service.application.ranking import (
    RankingCriterionDefinition,
    RankingModel,
    RankingModelRegistry,
)
from economic_service.domain.errors import ModelVersionError
from economic_service.domain.models import (
    AcquisitionModel,
    CandidateEconomics,
    CandidateStatus,
    EvaluationRequest,
    MetricValue,
    RankingCriterion,
    RankingCriterionTrace,
    RankingItem,
    RankingItemStatus,
    RankingResult,
    RankingStatus,
    RobotCandidate,
    SourceRef,
)

_SCORE_QUANTUM = Decimal("0.01")
_SCORE_SCALE = Decimal("100")
_CRITERION_UNITS = {
    RankingCriterion.PAYBACK: "years",
    RankingCriterion.ROI: "fraction",
    RankingCriterion.ANNUAL_EFFECT: "RUB/year",
    RankingCriterion.BUDGET_FIT: "fraction",
    RankingCriterion.TCO_SAVINGS: "RUB",
    RankingCriterion.MATURITY: "TRL",
    RankingCriterion.DATA_QUALITY: "%",
    RankingCriterion.FLEET_UTILIZATION: "fraction",
}
_METRIC_CODES = {
    RankingCriterion.PAYBACK: "candidate.returns.simple_payback_years",
    RankingCriterion.ROI: "candidate.returns.workbook_roi",
    RankingCriterion.ANNUAL_EFFECT: "candidate.effects.net_annual_benefit",
    RankingCriterion.FLEET_UTILIZATION: "candidate.fleet.average_utilization",
}


@dataclass(frozen=True, slots=True)
class _CriterionValue:
    """Holds one extracted raw value and its explanatory provenance."""

    value: Decimal | None
    unit: str
    provenance: tuple[SourceRef, ...]
    missing_reason: str | None = None


class MinMaxRankingStrategy:
    """Scores applicable candidate scenarios using a registered model."""

    def rank(
        self,
        candidates: Sequence[CandidateEconomics],
        model_version: str | None,
        request: EvaluationRequest | None = None,
        model: RankingModel | None = None,
    ) -> RankingResult:
        """Normalizes criteria and returns ranked applicable scenarios.

        Args:
            candidates: Calculated candidate and acquisition model results.
            model_version: Registered ranking model version.
            request: Evaluation inputs needed for sourced criteria and weights.
            model: Resolved immutable model definition.

        Raises:
            ModelVersionError: If the model version or request is unavailable.
        """

        if model_version is None:
            raise ModelVersionError("A ranking model version is required.")
        if request is None:
            raise ModelVersionError(
                "Evaluation inputs are required to calculate ranking criteria."
            )

        if model is None or model.version != model_version:
            raise ModelVersionError(
                "Requested ranking model version is unavailable: "
                f"{model_version}."
            )
        definitions = {item.code: item for item in model.criteria}
        configured_weights = _configured_weights(model, request)
        candidate_inputs = {
            item.candidate_id: item for item in request.candidates
        }
        applicable = tuple(
            item
            for item in candidates
            if item.status is CandidateStatus.APPLICABLE
        )
        extracted = {
            _scenario_key(item): _extract_values(
                item,
                candidate_inputs.get(item.candidate_id),
                request,
                definitions,
            )
            for item in applicable
        }
        normalized = _normalize_all(extracted, definitions)
        ranked_data = {
            _scenario_key(candidate): _score_candidate(
                candidate,
                extracted[_scenario_key(candidate)],
                normalized[_scenario_key(candidate)],
                definitions,
                configured_weights,
            )
            for candidate in applicable
        }

        ordered = sorted(
            applicable,
            key=lambda candidate: (
                ranked_data[_scenario_key(candidate)][0] is None,
                -ranked_data[_scenario_key(candidate)][0]
                if ranked_data[_scenario_key(candidate)][0] is not None
                else Decimal("0"),
                candidate.candidate_id,
                candidate.acquisition_model.value,
            ),
        )
        items: list[RankingItem] = []
        previous_score: Decimal | None = None
        current_rank = 0
        for index, candidate in enumerate(ordered, start=1):
            key = _scenario_key(candidate)
            score, contributions, traces = ranked_data[key]
            if score is None:
                rank = None
                item_status = RankingItemStatus.UNRANKED
                reason = "No positive-weight criteria have available values."
            else:
                if score != previous_score:
                    current_rank = index
                rank = current_rank
                item_status = RankingItemStatus.RANKED
                reason = None
                previous_score = score
            items.append(
                RankingItem(
                    candidate_id=candidate.candidate_id,
                    acquisition_model=candidate.acquisition_model,
                    candidate_status=candidate.status,
                    risks=candidate.risks,
                    rank=rank,
                    score=score,
                    contributions=contributions,
                    status=item_status,
                    unranked_reason=reason,
                    criteria=traces,
                )
            )
        return RankingResult(
            status=RankingStatus.AVAILABLE,
            model_version=model_version,
            items=tuple(items),
        )


@dataclass(frozen=True, slots=True)
class ScoringUseCase:
    """Resolves a ranking model and delegates scoring to its strategy."""

    model_registry: RankingModelRegistry
    strategy: MinMaxRankingStrategy

    @classmethod
    def ranking_v1(cls) -> ScoringUseCase:
        """Builds a scoring use case with the approved v1 model."""

        registry = RankingModelRegistry.ranking_v1()
        return cls(
            model_registry=registry,
            strategy=MinMaxRankingStrategy(),
        )

    def score(
        self,
        request: EvaluationRequest,
        candidates: Sequence[CandidateEconomics],
    ) -> RankingResult:
        """Scores calculated candidates using the requested or default model."""

        version, model = self._resolve_model(request)
        return self.strategy.rank(candidates, version, request, model)

    def validate_request(self, request: EvaluationRequest) -> None:
        """Rejects unknown ranking versions before economic calculation."""

        self._resolve_model(request)

    def _resolve_model(
        self,
        request: EvaluationRequest,
    ) -> tuple[str, RankingModel]:
        version = request.requested_ranking_version
        if version is None:
            version = self.model_registry.default_version
        if not self.model_registry.is_available(version):
            raise ModelVersionError(
                f"Requested ranking model version is unavailable: {version}."
            )
        return version, self.model_registry.models[version]


def _configured_weights(
    model: RankingModel,
    request: EvaluationRequest,
) -> dict[RankingCriterion, Decimal]:
    if request.ranking_weights is None:
        return {
            item.code: item.default_weight
            for item in model.criteria
        }
    requested = {
        RankingCriterion(code): weight
        for code, weight in request.ranking_weights
    }
    return {item.code: requested[item.code] for item in model.criteria}


def _extract_values(
    candidate: CandidateEconomics,
    robot: RobotCandidate | None,
    request: EvaluationRequest,
    definitions: Mapping[RankingCriterion, RankingCriterionDefinition],
) -> dict[RankingCriterion, _CriterionValue]:
    metrics = {item.code: item for item in candidate.metrics}
    values: dict[RankingCriterion, _CriterionValue] = {}
    for criterion, metric_code in _METRIC_CODES.items():
        metric = metrics.get(metric_code)
        values[criterion] = _from_metric(metric, criterion)

    baseline = metrics.get("candidate.returns.baseline_process_tco")
    robotized = metrics.get("candidate.returns.robotized_process_tco")
    if baseline is None or robotized is None:
        values[RankingCriterion.TCO_SAVINGS] = _CriterionValue(
            None,
            baseline.unit if baseline is not None else "RUB",
            tuple(
                metric.source
                for metric in (baseline, robotized)
                if metric is not None
            ),
            "Baseline or robotized process TCO is unavailable.",
        )
    else:
        baseline_value = _decimal_value(baseline.value)
        robotized_value = _decimal_value(robotized.value)
        if baseline_value is None or robotized_value is None:
            values[RankingCriterion.TCO_SAVINGS] = _CriterionValue(
                None,
                baseline.unit,
                (baseline.source, robotized.source),
                "Baseline or robotized process TCO is not numeric.",
            )
        else:
            values[RankingCriterion.TCO_SAVINGS] = _CriterionValue(
                baseline_value - robotized_value,
                baseline.unit,
                (baseline.source, robotized.source),
            )

    capex_metric = metrics.get("candidate.capex.total")
    budget = request.task.budget
    if budget is None:
        values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
            None,
            "fraction",
            (
                (request.task.source, capex_metric.source)
                if capex_metric is not None
                else (request.task.source,)
            ),
            "Location budget is unavailable.",
        )
    elif budget.base_amount < 0:
        values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
            None,
            "fraction",
            (
                (request.task.source, capex_metric.source)
                if capex_metric is not None
                else (request.task.source,)
            ),
            "Location budget must not be negative.",
        )
    elif capex_metric is None:
        values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
            None,
            "fraction",
            (request.task.source,),
            "Total upfront CAPEX is unavailable.",
        )
    else:
        capex_value = _decimal_value(capex_metric.value)
        provenance = (request.task.source, capex_metric.source)
        if capex_value is None:
            values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
                None,
                "fraction",
                provenance,
                "Total upfront CAPEX is not numeric.",
            )
        elif capex_value < 0:
            values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
                None,
                "fraction",
                provenance,
                "Total upfront CAPEX must not be negative.",
            )
        elif capex_value == 0:
            values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
                Decimal("1"), "fraction", provenance
            )
        else:
            fit = min(budget.base_amount / capex_value, Decimal("1"))
            values[RankingCriterion.BUDGET_FIT] = _CriterionValue(
                fit, "fraction", provenance
            )

    sourced_values = {
        RankingCriterion.MATURITY: (
            robot.maturity_trl if robot is not None else None
        ),
        RankingCriterion.DATA_QUALITY: (
            robot.catalog_completeness_percent if robot is not None else None
        ),
    }
    for criterion, sourced in sourced_values.items():
        if sourced is None:
            values[criterion] = _CriterionValue(
                None,
                _criterion_unit(criterion),
                (),
                "Sourced value is unavailable.",
            )
            continue
        value = _decimal_value(sourced.value)
        if value is None:
            values[criterion] = _CriterionValue(
                None,
                sourced.unit,
                (sourced.source,),
                "Sourced value is not a finite decimal.",
            )
        else:
            values[criterion] = _CriterionValue(
                value, sourced.unit, (sourced.source,)
            )

    return {criterion: values[criterion] for criterion in definitions}


def _from_metric(
    metric: MetricValue | None,
    criterion: RankingCriterion,
) -> _CriterionValue:
    if metric is None:
        return _CriterionValue(
            None,
            _CRITERION_UNITS[criterion],
            (),
            "Calculated metric is unavailable.",
        )
    value = _decimal_value(metric.value)
    if value is None:
        return _CriterionValue(
            None,
            metric.unit,
            (metric.source,),
            "Calculated metric is not numeric.",
        )
    return _CriterionValue(value, metric.unit, (metric.source,))


def _normalize_all(
    extracted: Mapping[
        tuple[str, AcquisitionModel],
        Mapping[RankingCriterion, _CriterionValue],
    ],
    definitions: Mapping[RankingCriterion, RankingCriterionDefinition],
) -> dict[tuple[str, AcquisitionModel], dict[RankingCriterion, Decimal | None]]:
    normalized = {key: {} for key in extracted}
    for criterion, definition in definitions.items():
        available = [
            values[criterion].value
            for values in extracted.values()
            if values[criterion].value is not None
        ]
        if not available:
            for key in extracted:
                normalized[key][criterion] = None
            continue
        minimum = min(available)
        maximum = max(available)
        for key, values in extracted.items():
            raw_value = values[criterion].value
            if raw_value is None:
                normalized[key][criterion] = None
            elif minimum == maximum:
                normalized[key][criterion] = Decimal("0.5")
            else:
                value = (raw_value - minimum) / (maximum - minimum)
                if not definition.higher_is_better:
                    value = Decimal("1") - value
                normalized[key][criterion] = value
    return normalized


def _score_candidate(
    candidate: CandidateEconomics,
    values: Mapping[RankingCriterion, _CriterionValue],
    normalized: Mapping[RankingCriterion, Decimal | None],
    definitions: Mapping[RankingCriterion, RankingCriterionDefinition],
    configured_weights: Mapping[RankingCriterion, Decimal],
) -> tuple[
    Decimal | None,
    tuple[tuple[str, Decimal], ...],
    tuple[RankingCriterionTrace, ...],
]:
    available_weight = sum(
        (
            configured_weights[criterion]
            for criterion, value in values.items()
            if value.value is not None and configured_weights[criterion] > 0
        ),
        Decimal("0"),
    )
    contributions: list[tuple[str, Decimal]] = []
    traces: list[RankingCriterionTrace] = []
    for criterion in definitions:
        value = values[criterion]
        norm_value = normalized[criterion]
        configured_weight = configured_weights[criterion]
        effective_weight = None
        contribution = None
        if value.value is not None:
            effective_weight = (
                configured_weight * _SCORE_SCALE / available_weight
                if available_weight > 0 and configured_weight > 0
                else Decimal("0")
            )
            if effective_weight > 0 and norm_value is not None:
                contribution = (
                    norm_value * effective_weight
                ).quantize(_SCORE_QUANTUM, rounding=ROUND_HALF_UP)
                contributions.append((criterion.value, contribution))
        traces.append(
            RankingCriterionTrace(
                code=criterion,
                raw_value=value.value,
                unit=value.unit,
                normalized_value=norm_value,
                configured_weight=configured_weight,
                effective_weight=effective_weight,
                contribution=contribution,
                provenance=value.provenance,
                is_missing=value.value is None,
                missing_reason=value.missing_reason,
            )
        )
    if not contributions:
        return None, (), tuple(traces)
    score = sum((value for _, value in contributions), Decimal("0"))
    return score, tuple(contributions), tuple(traces)


def _scenario_key(
    candidate: CandidateEconomics,
) -> tuple[str, AcquisitionModel]:
    return candidate.candidate_id, candidate.acquisition_model


def _decimal_value(value: object) -> Decimal | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value if value.is_finite() else None
    if isinstance(value, int):
        return Decimal(value)
    return None


def _criterion_unit(criterion: RankingCriterion) -> str:
    return _CRITERION_UNITS[criterion]
