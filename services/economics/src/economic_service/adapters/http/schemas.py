"""Pydantic DTOs kept at the HTTP boundary."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from economic_service.adapters.http.reason_texts_ru import REASON_TEXTS_RU
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

ScalarDto = bool | Decimal | int | str | None


class StrictModel(BaseModel):
    """Rejects undocumented fields at the transport boundary."""

    model_config = ConfigDict(extra="forbid")


class ValidationIssueDto(BaseModel):
    """Describes one request validation issue returned by FastAPI."""

    loc: tuple[str | int, ...]
    msg: str
    type: str
    input: Any | None = None
    ctx: dict[str, Any] | None = None
    url: str | None = None


class ErrorResponseDto(StrictModel):
    """Describes an HTTP error response body."""

    detail: str | tuple[ValidationIssueDto, ...]


class ReasonDto(StrictModel):
    """Pairs a stable reason code with its Russian display text."""

    code: ReasonCode
    text_ru: str

    @classmethod
    def from_code(cls, code: ReasonCode) -> ReasonDto:
        return cls(code=code, text_ru=REASON_TEXTS_RU[code])


class ModelVersionDto(StrictModel):
    """Describes the calculation and ranking versions served now."""

    model_version: str = Field(
        description="Calculation model version to send in evaluations."
    )
    ranking_version: str = Field(
        description="Default ranking methodology version."
    )
class SourceDto(StrictModel):
    source: str
    origin: InputOrigin
    confirmation: ConfirmationStatus
    version: str | None = None
    note: str | None = None

    def to_domain(self) -> SourceRef:
        return SourceRef(
            source=self.source,
            origin=self.origin,
            confirmation=self.confirmation,
            version=self.version,
            note=self.note,
        )

    @classmethod
    def from_domain(cls, source: SourceRef) -> SourceDto:
        return cls(
            source=source.source,
            origin=source.origin,
            confirmation=source.confirmation,
            version=source.version,
            note=source.note,
        )


class MoneyDto(StrictModel):
    amount: Decimal
    currency: str
    scale: int = 0

    def to_domain(self) -> Money:
        return Money(self.amount, self.currency, self.scale)

    @classmethod
    def from_domain(cls, money: Money) -> MoneyDto:
        return cls(
            amount=money.amount, currency=money.currency, scale=money.scale
        )


class TaskDto(StrictModel):
    project_id: str
    task_id: str
    operations_per_day: Decimal
    peak_factor: Decimal
    automatable_share: Decimal
    operating_hours_per_day: Decimal
    one_way_route_m: Decimal
    site_speed_limit_mps: Decimal
    load_unit_mass_kg: Decimal
    load_is_divisible: bool
    available_charging_power_kw: Decimal
    target_fte: Decimal
    target_annual_payroll: MoneyDto
    baseline_annual_opex: MoneyDto = Field(
        description=(
            "Annual baseline payroll for the current process workforce; "
            "this is not total process OPEX."
        )
    )
    fleet_operators_per_shift: Decimal
    shifts_per_day: Decimal
    staff_time_loss_share: Decimal
    fleet_operator_monthly_salary: MoneyDto
    target_monthly_salary: MoneyDto
    annual_staff_turnover: Decimal
    annual_other_benefits: MoneyDto
    replacement_by_handling: tuple[tuple[str, Decimal], ...]
    horizon_years: int
    budget: MoneyDto | None
    source: SourceDto
    lift_trip_share: Decimal = Decimal("0")
    one_way_lift_seconds: Decimal = Decimal("0")
    integration_cost: MoneyDto | None = None
    annual_consumables_per_robot: MoneyDto | None = None

    def to_domain(self) -> TaskEconomicsInput:
        return TaskEconomicsInput(
            project_id=self.project_id,
            task_id=self.task_id,
            operations_per_day=self.operations_per_day,
            peak_factor=self.peak_factor,
            automatable_share=self.automatable_share,
            operating_hours_per_day=self.operating_hours_per_day,
            one_way_route_m=self.one_way_route_m,
            site_speed_limit_mps=self.site_speed_limit_mps,
            load_unit_mass_kg=self.load_unit_mass_kg,
            load_is_divisible=self.load_is_divisible,
            available_charging_power_kw=self.available_charging_power_kw,
            target_fte=self.target_fte,
            target_annual_payroll=self.target_annual_payroll.to_domain(),
            baseline_annual_payroll=self.baseline_annual_opex.to_domain(),
            fleet_operators_per_shift=self.fleet_operators_per_shift,
            shifts_per_day=self.shifts_per_day,
            staff_time_loss_share=self.staff_time_loss_share,
            fleet_operator_monthly_salary=self.fleet_operator_monthly_salary.to_domain(),
            target_monthly_salary=self.target_monthly_salary.to_domain(),
            annual_staff_turnover=self.annual_staff_turnover,
            annual_other_benefits=self.annual_other_benefits.to_domain(),
            replacement_by_handling=self.replacement_by_handling,
            horizon_years=self.horizon_years,
            budget=None if self.budget is None else self.budget.to_domain(),
            source=self.source.to_domain(),
            lift_trip_share=self.lift_trip_share,
            one_way_lift_seconds=self.one_way_lift_seconds,
            integration_cost=(
                None
                if self.integration_cost is None
                else self.integration_cost.to_domain()
            ),
            annual_consumables_per_robot=(
                None
                if self.annual_consumables_per_robot is None
                else self.annual_consumables_per_robot.to_domain()
            ),
        )

    @classmethod
    def from_domain(cls, task: TaskEconomicsInput) -> TaskDto:
        return cls(
            project_id=task.project_id,
            task_id=task.task_id,
            operations_per_day=task.operations_per_day,
            peak_factor=task.peak_factor,
            automatable_share=task.automatable_share,
            operating_hours_per_day=task.operating_hours_per_day,
            one_way_route_m=task.one_way_route_m,
            site_speed_limit_mps=task.site_speed_limit_mps,
            load_unit_mass_kg=task.load_unit_mass_kg,
            load_is_divisible=task.load_is_divisible,
            available_charging_power_kw=task.available_charging_power_kw,
            target_fte=task.target_fte,
            target_annual_payroll=MoneyDto.from_domain(
                task.target_annual_payroll
            ),
            baseline_annual_opex=MoneyDto.from_domain(
                task.baseline_annual_payroll
            ),
            fleet_operators_per_shift=task.fleet_operators_per_shift,
            shifts_per_day=task.shifts_per_day,
            staff_time_loss_share=task.staff_time_loss_share,
            fleet_operator_monthly_salary=MoneyDto.from_domain(
                task.fleet_operator_monthly_salary
            ),
            target_monthly_salary=MoneyDto.from_domain(
                task.target_monthly_salary
            ),
            annual_staff_turnover=task.annual_staff_turnover,
            annual_other_benefits=MoneyDto.from_domain(
                task.annual_other_benefits
            ),
            replacement_by_handling=task.replacement_by_handling,
            horizon_years=task.horizon_years,
            budget=None
            if task.budget is None
            else MoneyDto.from_domain(task.budget),
            source=SourceDto.from_domain(task.source),
            lift_trip_share=task.lift_trip_share,
            one_way_lift_seconds=task.one_way_lift_seconds,
            integration_cost=(
                None
                if task.integration_cost is None
                else MoneyDto.from_domain(task.integration_cost)
            ),
            annual_consumables_per_robot=(
                None
                if task.annual_consumables_per_robot is None
                else MoneyDto.from_domain(task.annual_consumables_per_robot)
            ),
        )


class SourcedValueDto(StrictModel):
    value: Decimal
    unit: str
    source: SourceDto

    def to_domain(self) -> SourcedValue[Decimal]:
        return SourcedValue(
            value=self.value,
            unit=self.unit,
            source=self.source.to_domain(),
        )

    @classmethod
    def from_domain(
        cls, value: SourcedValue[Decimal]
    ) -> SourcedValueDto:
        return cls(
            value=value.value,
            unit=value.unit,
            source=SourceDto.from_domain(value.source),
        )


class CandidateDto(StrictModel):
    candidate_id: str
    robot_code: str
    price: MoneyDto | None
    payload_kg: Decimal | None
    max_speed_mps: Decimal | None
    loading_seconds: Decimal | None
    unloading_seconds: Decimal | None
    average_power_kw: Decimal | None
    handling_method: str | None
    catalog_status: str
    confirmation: ConfirmationStatus
    source: SourceDto
    acquisition_models: tuple[AcquisitionModel, ...] = Field(min_length=1)
    throughput_per_hour: SourcedValueDto | None = None
    maturity_trl: SourcedValueDto | None = None
    catalog_completeness_percent: SourcedValueDto | None = None

    @field_validator("acquisition_models")
    @classmethod
    def validate_acquisition_models(
        cls, acquisition_models: tuple[AcquisitionModel, ...]
    ) -> tuple[AcquisitionModel, ...]:
        if len(acquisition_models) != len(set(acquisition_models)):
            raise ValueError("acquisition_models must not contain duplicates.")
        return acquisition_models

    def to_domain(self) -> RobotCandidate:
        return RobotCandidate(
            candidate_id=self.candidate_id,
            robot_code=self.robot_code,
            price=None if self.price is None else self.price.to_domain(),
            payload_kg=self.payload_kg,
            max_speed_mps=self.max_speed_mps,
            loading_seconds=self.loading_seconds,
            unloading_seconds=self.unloading_seconds,
            average_power_kw=self.average_power_kw,
            handling_method=self.handling_method,
            catalog_status=self.catalog_status,
            confirmation=self.confirmation,
            source=self.source.to_domain(),
            acquisition_models=self.acquisition_models,
            throughput_per_hour=(
                None
                if self.throughput_per_hour is None
                else self.throughput_per_hour.to_domain()
            ),
            maturity_trl=(
                None
                if self.maturity_trl is None
                else self.maturity_trl.to_domain()
            ),
            catalog_completeness_percent=(
                None
                if self.catalog_completeness_percent is None
                else self.catalog_completeness_percent.to_domain()
            ),
        )

    @classmethod
    def from_domain(cls, candidate: RobotCandidate) -> CandidateDto:
        return cls(
            candidate_id=candidate.candidate_id,
            robot_code=candidate.robot_code,
            price=None
            if candidate.price is None
            else MoneyDto.from_domain(candidate.price),
            payload_kg=candidate.payload_kg,
            max_speed_mps=candidate.max_speed_mps,
            loading_seconds=candidate.loading_seconds,
            unloading_seconds=candidate.unloading_seconds,
            average_power_kw=candidate.average_power_kw,
            handling_method=candidate.handling_method,
            catalog_status=candidate.catalog_status,
            confirmation=candidate.confirmation,
            source=SourceDto.from_domain(candidate.source),
            acquisition_models=candidate.acquisition_models,
            throughput_per_hour=(
                None
                if candidate.throughput_per_hour is None
                else SourcedValueDto.from_domain(candidate.throughput_per_hour)
            ),
            maturity_trl=(
                None
                if candidate.maturity_trl is None
                else SourcedValueDto.from_domain(candidate.maturity_trl)
            ),
            catalog_completeness_percent=(
                None
                if candidate.catalog_completeness_percent is None
                else SourcedValueDto.from_domain(
                    candidate.catalog_completeness_percent
                )
            ),
        )


class NormsDto(StrictModel):
    payroll_multiplier: Decimal
    productive_time_share: Decimal
    technical_availability: Decimal
    fleet_reserve_share: Decimal
    operating_speed_factor: Decimal
    robots_per_charger: Decimal
    charger_installed_price: MoneyDto
    charger_power_kw: Decimal
    fms_upfront_share: Decimal
    delivery_share: Decimal
    commissioning_share: Decimal
    training_cost: MoneyDto
    capex_contingency_share: Decimal
    annual_service_share: Decimal
    annual_license_share: Decimal
    annual_repair_share: Decimal
    electricity_price: MoneyDto
    battery_life_years: Decimal
    battery_replacement_share: Decimal
    annual_connectivity_cost: MoneyDto
    equipment_life_years: Decimal
    discount_rate: Decimal
    loan_share: Decimal
    loan_interest_rate: Decimal
    loan_term_years: Decimal
    monthly_raas_share: Decimal
    raas_setup_share: Decimal
    recruitment_months_salary: Decimal
    good_payback_years: Decimal
    medium_payback_years: Decimal
    site_preparation_share: Decimal
    source: SourceDto

    def to_domain(self) -> NormSet:
        return NormSet(
            payroll_multiplier=self.payroll_multiplier,
            productive_time_share=self.productive_time_share,
            technical_availability=self.technical_availability,
            fleet_reserve_share=self.fleet_reserve_share,
            operating_speed_factor=self.operating_speed_factor,
            robots_per_charger=self.robots_per_charger,
            charger_installed_price=self.charger_installed_price.to_domain(),
            charger_power_kw=self.charger_power_kw,
            fms_upfront_share=self.fms_upfront_share,
            delivery_share=self.delivery_share,
            commissioning_share=self.commissioning_share,
            training_cost=self.training_cost.to_domain(),
            capex_contingency_share=self.capex_contingency_share,
            annual_service_share=self.annual_service_share,
            annual_license_share=self.annual_license_share,
            annual_repair_share=self.annual_repair_share,
            electricity_price=self.electricity_price.to_domain(),
            battery_life_years=self.battery_life_years,
            battery_replacement_share=self.battery_replacement_share,
            annual_connectivity_cost=self.annual_connectivity_cost.to_domain(),
            equipment_life_years=self.equipment_life_years,
            discount_rate=self.discount_rate,
            loan_share=self.loan_share,
            loan_interest_rate=self.loan_interest_rate,
            loan_term_years=self.loan_term_years,
            monthly_raas_share=self.monthly_raas_share,
            raas_setup_share=self.raas_setup_share,
            recruitment_months_salary=self.recruitment_months_salary,
            good_payback_years=self.good_payback_years,
            medium_payback_years=self.medium_payback_years,
            site_preparation_share=self.site_preparation_share,
            source=self.source.to_domain(),
        )

    @classmethod
    def from_domain(cls, norms: NormSet) -> NormsDto:
        values: dict[str, Any] = {
            name: getattr(norms, name)
            for name in (
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
        }
        return cls(
            **values,
            charger_installed_price=MoneyDto.from_domain(
                norms.charger_installed_price
            ),
            training_cost=MoneyDto.from_domain(norms.training_cost),
            electricity_price=MoneyDto.from_domain(norms.electricity_price),
            annual_connectivity_cost=MoneyDto.from_domain(
                norms.annual_connectivity_cost
            ),
            source=SourceDto.from_domain(norms.source),
        )


class ScenarioDto(StrictModel):
    acquisition_model: AcquisitionModel
    price_factor: Decimal
    volume_factor: Decimal
    labor_factor: Decimal
    model_version: str

    def to_domain(self) -> Scenario:
        return Scenario(
            acquisition_model=self.acquisition_model,
            price_factor=self.price_factor,
            volume_factor=self.volume_factor,
            labor_factor=self.labor_factor,
            model_version=self.model_version,
        )

    @classmethod
    def from_domain(cls, scenario: Scenario) -> ScenarioDto:
        return cls(
            acquisition_model=scenario.acquisition_model,
            price_factor=scenario.price_factor,
            volume_factor=scenario.volume_factor,
            labor_factor=scenario.labor_factor,
            model_version=scenario.model_version,
        )


class EvaluationRequestDto(StrictModel):
    evaluation_id: str
    project_id: str
    model_version: str
    task: TaskDto
    candidates: tuple[CandidateDto, ...]
    norms: NormsDto
    scenarios: tuple[ScenarioDto, ...]
    requested_ranking_version: str | None = None
    calculation_currency: str = CALCULATION_CURRENCY
    ranking_weights: tuple[tuple[RankingCriterion, Decimal], ...] | None = None

    def to_domain(self) -> EvaluationRequest:
        return EvaluationRequest(
            evaluation_id=self.evaluation_id,
            project_id=self.project_id,
            model_version=self.model_version,
            task=self.task.to_domain(),
            candidates=tuple(
                candidate.to_domain() for candidate in self.candidates
            ),
            norms=self.norms.to_domain(),
            scenarios=tuple(
                scenario.to_domain() for scenario in self.scenarios
            ),
            requested_ranking_version=self.requested_ranking_version,
            calculation_currency=self.calculation_currency,
            ranking_weights=(
                None
                if self.ranking_weights is None
                else tuple(
                    (criterion.value, weight)
                    for criterion, weight in self.ranking_weights
                )
            ),
        )

    @classmethod
    def from_domain(cls, request: EvaluationRequest) -> EvaluationRequestDto:
        return cls(
            evaluation_id=request.evaluation_id,
            project_id=request.project_id,
            model_version=request.model_version,
            task=TaskDto.from_domain(request.task),
            candidates=tuple(
                CandidateDto.from_domain(candidate)
                for candidate in request.candidates
            ),
            norms=NormsDto.from_domain(request.norms),
            scenarios=tuple(
                ScenarioDto.from_domain(scenario)
                for scenario in request.scenarios
            ),
            requested_ranking_version=request.requested_ranking_version,
            calculation_currency=request.calculation_currency,
            ranking_weights=(
                None
                if request.ranking_weights is None
                else tuple(
                    (RankingCriterion(code), weight)
                    for code, weight in request.ranking_weights
                )
            ),
        )


class TraceInputDto(StrictModel):
    name: str
    value: ScalarDto


class CalculationTraceDto(StrictModel):
    formula_id: str
    result: ScalarDto
    unit: str
    source: SourceDto
    inputs: tuple[TraceInputDto, ...]

    @classmethod
    def from_domain(cls, trace: CalculationTrace) -> CalculationTraceDto:
        return cls(
            formula_id=trace.formula_id,
            result=trace.result,
            unit=trace.unit,
            source=SourceDto.from_domain(trace.source),
            inputs=tuple(
                TraceInputDto(name=name, value=value)
                for name, value in trace.inputs
            ),
        )


class MetricValueDto(StrictModel):
    code: str
    value: ScalarDto
    unit: str
    source: SourceDto

    @classmethod
    def from_domain(cls, metric: MetricValue) -> MetricValueDto:
        return cls(
            code=metric.code,
            value=metric.value,
            unit=metric.unit,
            source=SourceDto.from_domain(metric.source),
        )


class CandidateEconomicsDto(StrictModel):
    candidate_id: str
    acquisition_model: AcquisitionModel
    status: CandidateStatus
    metrics: tuple[MetricValueDto, ...]
    traces: tuple[CalculationTraceDto, ...]
    risks: tuple[ReasonDto, ...]

    @classmethod
    def from_domain(
        cls, candidate: CandidateEconomics
    ) -> CandidateEconomicsDto:
        return cls(
            candidate_id=candidate.candidate_id,
            acquisition_model=candidate.acquisition_model,
            status=candidate.status,
            metrics=tuple(
                MetricValueDto.from_domain(metric)
                for metric in candidate.metrics
            ),
            traces=tuple(
                CalculationTraceDto.from_domain(trace)
                for trace in candidate.traces
            ),
            risks=tuple(ReasonDto.from_code(code) for code in candidate.risks),
        )


class RankingItemDto(StrictModel):
    candidate_id: str
    acquisition_model: AcquisitionModel
    candidate_status: CandidateStatus
    risks: tuple[ReasonDto, ...]
    rank: int | None
    score: Decimal | None
    contributions: tuple[tuple[str, Decimal], ...]
    status: RankingItemStatus
    unranked_reason: ReasonDto | None
    criteria: tuple[RankingCriterionTraceDto, ...]

    @classmethod
    def from_domain(cls, item: RankingItem) -> RankingItemDto:
        return cls(
            candidate_id=item.candidate_id,
            acquisition_model=item.acquisition_model,
            candidate_status=item.candidate_status,
            risks=tuple(ReasonDto.from_code(code) for code in item.risks),
            rank=item.rank,
            score=item.score,
            contributions=item.contributions,
            status=item.status,
            unranked_reason=(
                None
                if item.unranked_reason is None
                else ReasonDto.from_code(item.unranked_reason)
            ),
            criteria=tuple(
                RankingCriterionTraceDto.from_domain(trace)
                for trace in item.criteria
            ),
        )


class RankingCriterionTraceDto(StrictModel):
    code: RankingCriterion
    raw_value: Decimal | None
    unit: str
    normalized_value: Decimal | None
    configured_weight: Decimal
    effective_weight: Decimal | None
    contribution: Decimal | None
    provenance: tuple[SourceDto, ...]
    is_missing: bool
    missing_reason: ReasonDto | None

    @classmethod
    def from_domain(
        cls, trace: RankingCriterionTrace
    ) -> RankingCriterionTraceDto:
        return cls(
            code=trace.code,
            raw_value=trace.raw_value,
            unit=trace.unit,
            normalized_value=trace.normalized_value,
            configured_weight=trace.configured_weight,
            effective_weight=trace.effective_weight,
            contribution=trace.contribution,
            provenance=tuple(
                SourceDto.from_domain(source) for source in trace.provenance
            ),
            is_missing=trace.is_missing,
            missing_reason=(
                None
                if trace.missing_reason is None
                else ReasonDto.from_code(trace.missing_reason)
            ),
        )


class RankingResultDto(StrictModel):
    status: RankingStatus
    model_version: str | None
    items: tuple[RankingItemDto, ...]

    @classmethod
    def from_domain(cls, ranking: RankingResult) -> RankingResultDto:
        return cls(
            status=ranking.status,
            model_version=ranking.model_version,
            items=tuple(
                RankingItemDto.from_domain(item) for item in ranking.items
            ),
        )


class EvaluationResultDto(StrictModel):
    evaluation_id: str
    project_id: str
    model_version: str
    status: EvaluationStatus
    candidates: tuple[CandidateEconomicsDto, ...]
    ranking: RankingResultDto

    @classmethod
    def from_domain(cls, result: EvaluationResult) -> EvaluationResultDto:
        return cls(
            evaluation_id=result.evaluation_id,
            project_id=result.project_id,
            model_version=result.model_version,
            status=result.status,
            candidates=tuple(
                CandidateEconomicsDto.from_domain(candidate)
                for candidate in result.candidates
            ),
            ranking=RankingResultDto.from_domain(result.ranking),
        )


class EvaluationSnapshotDto(StrictModel):
    evaluation_id: str
    project_id: str
    request: EvaluationRequestDto
    result: EvaluationResultDto
    created_at: str
    revision_of: str | None

    @classmethod
    def from_domain(cls, snapshot: EvaluationSnapshot) -> EvaluationSnapshotDto:
        return cls(
            evaluation_id=snapshot.evaluation_id,
            project_id=snapshot.project_id,
            request=EvaluationRequestDto.from_domain(snapshot.request),
            result=EvaluationResultDto.from_domain(snapshot.result),
            created_at=snapshot.created_at.isoformat(),
            revision_of=snapshot.revision_of,
        )
