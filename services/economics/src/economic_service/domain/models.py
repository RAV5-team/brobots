"""Typed, framework-independent domain models for economic evaluations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import StrEnum

from economic_service.domain.errors import InvalidInputError

_USER_MONEY_QUANTUM = Decimal("0.01")
CALCULATION_CURRENCY = "RUB"


class InputOrigin(StrEnum):
    """Identifies where an input value originated."""

    RECORDED = "recorded"
    USER = "user"
    ADMIN_NORM = "admin_norm"
    ESTIMATE = "estimate"
    DERIVED = "derived"


class ConfirmationStatus(StrEnum):
    """Describes whether a source value has been confirmed."""

    CONFIRMED = "confirmed"
    PARTIAL = "partial"
    UNCONFIRMED = "unconfirmed"
    UNKNOWN = "unknown"


class AcquisitionModel(StrEnum):
    """Supported candidate acquisition models."""

    PURCHASE = "purchase"
    RAAS = "raas"


class CandidateStatus(StrEnum):
    """Describes candidate economics status, including legacy snapshot states."""

    APPLICABLE = "applicable"
    # Retained only so old snapshots can be decoded without data loss.
    EXCLUDED = "excluded"
    REQUIRES_VERIFICATION = "requires_verification"
    UNRESOLVED_ECONOMICS = "unresolved_economics"


class EvaluationStatus(StrEnum):
    """Overall status of an evaluation."""

    COMPLETED = "completed"
    PARTIAL = "partial"
    INVALID = "invalid"


class RankingStatus(StrEnum):
    """Availability status of ranking output."""

    NOT_CONFIGURED = "not_configured"
    AVAILABLE = "available"


class RankingItemStatus(StrEnum):
    """Describes whether an applicable candidate received a score."""

    RANKED = "ranked"
    UNRANKED = "unranked"


class RankingCriterion(StrEnum):
    """Criteria supported by the ranking methodology contract."""

    PAYBACK = "payback"
    ROI = "roi"
    ANNUAL_EFFECT = "annual_effect"
    BUDGET_FIT = "budget_fit"
    TCO_SAVINGS = "tco_savings"
    MATURITY = "maturity"
    DATA_QUALITY = "data_quality"
    FLEET_UTILIZATION = "fleet_utilization"


type ScalarValue = bool | Decimal | int | str | None


@dataclass(frozen=True, slots=True)
class Money:
    """Represents a monetary amount with its source currency scale."""

    amount: Decimal
    currency: str = CALCULATION_CURRENCY
    scale: int = 0

    def __post_init__(self) -> None:
        """Validates and normalizes monetary identity fields."""

        try:
            normalized_amount = Decimal(self.amount)
        except (InvalidOperation, TypeError, ValueError) as error:
            raise InvalidInputError(
                "Money amount must be a decimal value."
            ) from error

        if not normalized_amount.is_finite():
            raise InvalidInputError("Money amount must be finite.")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise InvalidInputError(
                "Money currency must be a three-letter code."
            )
        if self.scale < 0:
            raise InvalidInputError("Money scale must not be negative.")

        object.__setattr__(self, "amount", normalized_amount)
        object.__setattr__(self, "currency", self.currency.upper())

    @property
    def base_amount(self) -> Decimal:
        """Returns the amount normalized to base currency units."""

        return self.amount * (Decimal(10) ** self.scale)

    @property
    def user_amount(self) -> Decimal:
        """Returns the amount rounded for user-facing presentation."""

        return self.base_amount.quantize(_USER_MONEY_QUANTUM, ROUND_HALF_UP)


@dataclass(frozen=True, slots=True)
class SourceRef:
    """Describes the provenance and confirmation state of an input."""

    source: str
    origin: InputOrigin
    confirmation: ConfirmationStatus
    version: str | None = None
    note: str | None = None


@dataclass(frozen=True, slots=True)
class SourcedValue[ValueType]:
    """Represents a typed value together with its unit and provenance."""

    value: ValueType
    unit: str
    source: SourceRef


@dataclass(frozen=True, slots=True)
class TaskEconomicsInput:
    """Represents the task and site values required for economics."""

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
    target_annual_payroll: Money
    baseline_annual_payroll: Money
    fleet_operators_per_shift: Decimal
    shifts_per_day: Decimal
    staff_time_loss_share: Decimal
    fleet_operator_monthly_salary: Money
    target_monthly_salary: Money
    annual_staff_turnover: Decimal
    annual_other_benefits: Money
    replacement_by_handling: tuple[tuple[str, Decimal], ...]
    horizon_years: int
    budget: Money | None
    source: SourceRef
    lift_trip_share: Decimal = Decimal("0")
    one_way_lift_seconds: Decimal = Decimal("0")
    integration_cost: Money | None = None
    annual_consumables_per_robot: Money | None = None

    def replacement_share(self, handling_method: str) -> Decimal:
        """Returns the task-specific replacement share for a handling method."""

        replacement_values = dict(self.replacement_by_handling)
        return replacement_values.get(handling_method, Decimal("0"))


@dataclass(frozen=True, slots=True)
class RobotCandidate:
    """Represents a pre-screened catalog solution supplied for economics."""

    candidate_id: str
    robot_code: str
    price: Money | None
    payload_kg: Decimal | None
    max_speed_mps: Decimal | None
    loading_seconds: Decimal | None
    unloading_seconds: Decimal | None
    average_power_kw: Decimal | None
    handling_method: str | None
    catalog_status: str
    confirmation: ConfirmationStatus
    source: SourceRef
    maturity_trl: SourcedValue[Decimal] | None = None
    catalog_completeness_percent: SourcedValue[Decimal] | None = None


@dataclass(frozen=True, slots=True)
class NormSet:
    """Represents versioned organizer and calculation norms."""

    payroll_multiplier: Decimal
    productive_time_share: Decimal
    technical_availability: Decimal
    fleet_reserve_share: Decimal
    operating_speed_factor: Decimal
    robots_per_charger: Decimal
    charger_installed_price: Money
    charger_power_kw: Decimal
    fms_upfront_share: Decimal
    delivery_share: Decimal
    commissioning_share: Decimal
    training_cost: Money
    capex_contingency_share: Decimal
    annual_service_share: Decimal
    annual_license_share: Decimal
    annual_repair_share: Decimal
    electricity_price: Money
    battery_life_years: Decimal
    battery_replacement_share: Decimal
    annual_connectivity_cost: Money
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
    source: SourceRef


@dataclass(frozen=True, slots=True)
class Scenario:
    """Represents one acquisition and sensitivity scenario."""

    acquisition_model: AcquisitionModel
    price_factor: Decimal
    volume_factor: Decimal
    labor_factor: Decimal
    model_version: str


@dataclass(frozen=True, slots=True)
class CalculationTrace:
    """Represents one traceable derived calculation."""

    formula_id: str
    result: ScalarValue
    unit: str
    source: SourceRef
    inputs: tuple[tuple[str, ScalarValue], ...]


@dataclass(frozen=True, slots=True)
class MetricValue:
    """Represents one named derived value with its unit and provenance."""

    code: str
    value: ScalarValue
    unit: str
    source: SourceRef


@dataclass(frozen=True, slots=True)
class CandidateEconomics:
    """Represents one candidate and acquisition model's economic result."""

    candidate_id: str
    acquisition_model: AcquisitionModel
    status: CandidateStatus
    metrics: tuple[MetricValue, ...]
    traces: tuple[CalculationTrace, ...]
    risks: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class RankingCriterionTrace:
    """Explains one criterion's input and contribution to a candidate score."""

    code: RankingCriterion
    raw_value: Decimal | None
    unit: str
    normalized_value: Decimal | None
    configured_weight: Decimal
    effective_weight: Decimal | None
    contribution: Decimal | None
    provenance: tuple[SourceRef, ...]
    is_missing: bool
    missing_reason: str | None = None


@dataclass(frozen=True, slots=True)
class RankingItem:
    """Represents one optional ranked candidate result."""

    candidate_id: str
    acquisition_model: AcquisitionModel
    candidate_status: CandidateStatus
    risks: tuple[str, ...]
    rank: int | None
    score: Decimal | None
    contributions: tuple[tuple[str, Decimal], ...]
    status: RankingItemStatus = RankingItemStatus.RANKED
    unranked_reason: str | None = None
    criteria: tuple[RankingCriterionTrace, ...] = ()


@dataclass(frozen=True, slots=True)
class RankingResult:
    """Represents ranking availability and optional ranked items."""

    status: RankingStatus
    model_version: str | None
    items: tuple[RankingItem, ...]


@dataclass(frozen=True, slots=True)
class EvaluationRequest:
    """Represents a complete version-pinned economics evaluation request."""

    evaluation_id: str
    project_id: str
    model_version: str
    task: TaskEconomicsInput
    candidates: tuple[RobotCandidate, ...]
    norms: NormSet
    scenarios: tuple[Scenario, ...]
    requested_ranking_version: str | None = None
    calculation_currency: str = CALCULATION_CURRENCY
    ranking_weights: tuple[tuple[str, Decimal], ...] | None = None


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    """Represents an explainable result for a complete evaluation request."""

    evaluation_id: str
    project_id: str
    model_version: str
    status: EvaluationStatus
    candidates: tuple[CandidateEconomics, ...]
    ranking: RankingResult


@dataclass(frozen=True, slots=True)
class CalculatedEconomics:
    """Holds completed economic calculations before ranking is applied."""

    evaluation_id: str
    project_id: str
    model_version: str
    status: EvaluationStatus
    candidates: tuple[CandidateEconomics, ...]


@dataclass(frozen=True, slots=True)
class EvaluationSnapshot:
    """Represents an immutable input and result snapshot."""

    evaluation_id: str
    project_id: str
    request: EvaluationRequest
    result: EvaluationResult
    created_at: datetime
    revision_of: str | None = None
