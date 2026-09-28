"""Deterministic economic calculations for hydrated evaluation requests."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from economic_service.application import assumptions, formulas
from economic_service.domain.errors import InvalidInputError
from economic_service.domain.models import (
    CALCULATION_CURRENCY,
    AcquisitionModel,
    CalculatedEconomics,
    CalculationTrace,
    CandidateEconomics,
    CandidateStatus,
    ConfirmationStatus,
    EvaluationRequest,
    EvaluationStatus,
    InputOrigin,
    MetricValue,
    ReasonCode,
    RobotCandidate,
    ScalarValue,
    Scenario,
    SourceRef,
)
from economic_service.domain.validation import validate_evaluation_request


def _derived_source(formula_id: str, model_version: str) -> SourceRef:
    """Builds provenance for one value calculated by this engine."""

    return SourceRef(
        source=formula_id,
        origin=InputOrigin.DERIVED,
        confirmation=ConfirmationStatus.CONFIRMED,
        version=model_version,
    )


@dataclass
class CalculationTracer:
    """Collects named metrics and one trace for each calculated metric."""

    model_version: str

    def __post_init__(self) -> None:
        self.metrics: list[MetricValue] = []
        self.traces: list[CalculationTrace] = []

    def add(
        self,
        code: str,
        value: ScalarValue,
        unit: str,
        inputs: tuple[tuple[str, ScalarValue], ...] = (),
    ) -> ScalarValue:
        """Records a metric and its complete calculation trace."""

        source = _derived_source(code, self.model_version)
        self.metrics.append(
            MetricValue(code=code, value=value, unit=unit, source=source)
        )
        self.traces.append(
            CalculationTrace(
                formula_id=code,
                result=value,
                unit=unit,
                source=source,
                inputs=inputs,
            )
        )
        return value


class EconomicCalculationEngine:
    """Calculates economics for candidates pre-screened as applicable."""

    def calculate(self, request: EvaluationRequest) -> CalculatedEconomics:
        """Calculates each pre-screened candidate against every scenario."""

        validate_evaluation_request(request)
        pairs = tuple(
            (candidate, scenario)
            for candidate in request.candidates
            for scenario in request.scenarios
            if scenario.acquisition_model in candidate.acquisition_models
        )
        if not pairs:
            raise InvalidInputError(
                "No candidate acquisition offer matches a requested scenario."
            )
        results = tuple(
            self._calculate_candidate(request, candidate, scenario)
            for candidate, scenario in pairs
        )
        status = (
            EvaluationStatus.PARTIAL
            if any(
                result.status
                in {
                    CandidateStatus.UNRESOLVED_ECONOMICS,
                }
                for result in results
            )
            else EvaluationStatus.COMPLETED
        )
        return CalculatedEconomics(
            evaluation_id=request.evaluation_id,
            project_id=request.project_id,
            model_version=request.model_version,
            status=status,
            candidates=results,
        )

    def _calculate_candidate(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        scenario: Scenario,
    ) -> CandidateEconomics:
        missing_inputs = self._missing_economic_inputs(request, candidate)
        if missing_inputs:
            return CandidateEconomics(
                candidate_id=candidate.candidate_id,
                acquisition_model=scenario.acquisition_model,
                status=CandidateStatus.UNRESOLVED_ECONOMICS,
                metrics=(),
                traces=(),
                risks=tuple(missing_inputs),
            )

        calc_tracer = CalculationTracer(request.model_version)

        demand = self._calculate_demand(
            request, candidate, scenario, calc_tracer
        )
        labor = self._calculate_labor(request, candidate, scenario, calc_tracer)
        productivity = self._calculate_productivity(
            request,
            candidate,
            demand.trips_per_operation,
            calc_tracer,
        )
        fleet = self._calculate_fleet(
            request, demand, productivity, calc_tracer
        )
        capex = self._calculate_capex(
            request, candidate, scenario, fleet, calc_tracer
        )
        opex = self._calculate_opex(
            request, candidate, scenario, labor, fleet, capex, calc_tracer
        )
        effects = self._calculate_effects(
            request, scenario, labor, capex, opex, calc_tracer
        )
        self._calculate_returns(
            request, scenario, labor, capex, opex, effects, calc_tracer
        )
        risks = self._risks(request, candidate, calc_tracer)
        return CandidateEconomics(
            candidate_id=candidate.candidate_id,
            acquisition_model=scenario.acquisition_model,
            status=CandidateStatus.APPLICABLE,
            metrics=tuple(calc_tracer.metrics),
            traces=tuple(calc_tracer.traces),
            risks=tuple(risks),
        )

    def _missing_economic_inputs(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
    ) -> tuple[ReasonCode, ...]:
        missing: list[ReasonCode] = []
        if candidate.price is None:
            missing.append(ReasonCode.CATALOG_PRICE_MISSING)
        if (
            candidate.throughput_per_hour is None
            and candidate.max_speed_mps is None
        ):
            missing.append(ReasonCode.PRODUCTIVITY_INPUTS_MISSING)
        if (
            candidate.throughput_per_hour is None
            and candidate.loading_seconds is None
        ):
            missing.append(ReasonCode.LOADING_TIME_MISSING)
        if (
            candidate.throughput_per_hour is None
            and candidate.unloading_seconds is None
        ):
            missing.append(ReasonCode.UNLOADING_TIME_MISSING)
        if candidate.average_power_kw is None:
            missing.append(ReasonCode.AVERAGE_POWER_MISSING)
        if candidate.handling_method is None:
            missing.append(ReasonCode.HANDLING_METHOD_MISSING)
        if request.task.load_is_divisible and candidate.payload_kg is None:
            missing.append(ReasonCode.PAYLOAD_MISSING)
        return tuple(missing)

    def _calculate_labor(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        scenario: Scenario,
        recorder: CalculationTracer,
    ) -> formulas.LaborResult:
        task = request.task
        replacement_share = task.replacement_share(
            candidate.handling_method or ""
        )
        result = formulas.calculate_labor(
            formulas.LaborInputs(
                replacement_share=replacement_share,
                baseline_annual_payroll=(
                    task.baseline_annual_payroll.base_amount
                ),
                target_fte=task.target_fte,
                target_annual_payroll=(task.target_annual_payroll.base_amount),
                labor_factor=scenario.labor_factor,
                volume_factor=scenario.volume_factor,
            )
        )
        recorder.add(
            "candidate.labor.replacement_share",
            replacement_share,
            "fraction",
            (("handling_method", candidate.handling_method),),
        )
        recorder.add(
            "candidate.labor.scenario_baseline_payroll",
            result.scenario_baseline_payroll,
            f"{CALCULATION_CURRENCY}/year",
            (
                (
                    "baseline_annual_opex",
                    task.baseline_annual_payroll.base_amount,
                ),
                ("labor_factor", scenario.labor_factor),
                ("volume_factor", scenario.volume_factor),
            ),
        )
        recorder.add(
            "candidate.labor.released_fte",
            result.released_fte,
            "FTE",
            (
                ("target_fte", task.target_fte),
                ("replacement_share", replacement_share),
                ("volume_factor", scenario.volume_factor),
            ),
        )
        recorder.add(
            "candidate.labor.annual_payroll_saving",
            result.annual_payroll_saving,
            f"{CALCULATION_CURRENCY}/year",
            (
                (
                    "target_annual_payroll",
                    task.target_annual_payroll.base_amount,
                ),
                ("replacement_share", replacement_share),
                ("labor_factor", scenario.labor_factor),
                ("volume_factor", scenario.volume_factor),
            ),
        )
        recorder.add(
            "candidate.labor.remaining_annual_payroll",
            result.remaining_annual_payroll,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("scenario_baseline_payroll", result.scenario_baseline_payroll),
                ("annual_payroll_saving", result.annual_payroll_saving),
            ),
        )
        return result

    def _calculate_demand(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        scenario: Scenario,
        recorder: CalculationTracer,
    ) -> formulas.DemandResult:
        task = request.task
        result = formulas.calculate_demand(
            formulas.DemandInputs(
                operations_per_day=task.operations_per_day,
                peak_factor=task.peak_factor,
                automatable_share=task.automatable_share,
                operating_hours_per_day=task.operating_hours_per_day,
                load_unit_mass_kg=task.load_unit_mass_kg,
                load_is_divisible=task.load_is_divisible,
                payload_kg=candidate.payload_kg,
                volume_factor=scenario.volume_factor,
            )
        )
        recorder.add(
            "candidate.demand.scenario_operations_per_day",
            result.scenario_operations_per_day,
            "operations/day",
            (
                ("operations_per_day", task.operations_per_day),
                ("volume_factor", scenario.volume_factor),
            ),
        )
        recorder.add(
            "candidate.demand.automatable_operations_per_day",
            result.automatable_operations_per_day,
            "operations/day",
            (
                (
                    "scenario_operations_per_day",
                    result.scenario_operations_per_day,
                ),
                ("automatable_share", task.automatable_share),
            ),
        )
        recorder.add(
            "candidate.demand.trips_per_operation",
            result.trips_per_operation,
            "trips",
            (
                ("load_unit_mass_kg", task.load_unit_mass_kg),
                ("payload_kg", candidate.payload_kg),
                ("load_is_divisible", task.load_is_divisible),
            ),
        )
        recorder.add(
            "candidate.demand.operating_hours_per_day",
            task.operating_hours_per_day,
            "hours/day",
            (("task_operating_hours_per_day", task.operating_hours_per_day),),
        )
        recorder.add(
            "candidate.demand.average_operations_per_hour",
            result.average_operations_per_hour,
            "operations/hour",
            (
                (
                    "automatable_operations_per_day",
                    result.automatable_operations_per_day,
                ),
                ("operating_hours_per_day", task.operating_hours_per_day),
            ),
        )
        recorder.add(
            "candidate.demand.peak_automatable_operations_per_hour",
            result.peak_operations_per_hour,
            "operations/hour",
            (
                ("operations_per_day", task.operations_per_day),
                ("operating_hours_per_day", task.operating_hours_per_day),
                ("peak_factor", task.peak_factor),
                ("volume_factor", scenario.volume_factor),
                ("automatable_share", task.automatable_share),
            ),
        )
        recorder.add(
            "candidate.demand.peak_trips_per_hour",
            result.peak_trips_per_hour,
            "trips/hour",
            (
                (
                    "peak_automatable_operations_per_hour",
                    result.peak_operations_per_hour,
                ),
                ("trips_per_operation", result.trips_per_operation),
            ),
        )
        return result

    def _calculate_productivity(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        trips_per_operation: Decimal,
        recorder: CalculationTracer,
    ) -> formulas.ProductivityResult:
        task = request.task
        result = formulas.calculate_productivity(
            formulas.ProductivityInputs(
                max_speed_mps=candidate.max_speed_mps,
                site_speed_limit_mps=task.site_speed_limit_mps,
                operating_speed_factor=request.norms.operating_speed_factor,
                one_way_route_m=task.one_way_route_m,
                lift_trip_share=task.lift_trip_share,
                one_way_lift_seconds=task.one_way_lift_seconds,
                loading_seconds=candidate.loading_seconds,
                unloading_seconds=candidate.unloading_seconds,
                productive_time_share=request.norms.productive_time_share,
                technical_availability=request.norms.technical_availability,
                trips_per_operation=trips_per_operation,
                catalog_throughput_per_hour=(
                    None
                    if candidate.throughput_per_hour is None
                    else candidate.throughput_per_hour.value
                ),
            )
        )
        if candidate.throughput_per_hour is not None:
            throughput = candidate.throughput_per_hour
            recorder.add(
                "candidate.productivity.catalog_throughput_per_hour",
                throughput.value,
                throughput.unit,
                (
                    ("source", throughput.source.source),
                    ("source_unit", throughput.unit),
                ),
            )
            recorder.add(
                "candidate.productivity.trips_per_process_unit",
                trips_per_operation,
                "trips/task_unit",
                (("trips_per_operation", trips_per_operation),),
            )
            recorder.add(
                "candidate.productivity.nominal_trips_per_robot_hour",
                result.nominal_capacity_per_hour,
                "trips/hour",
                (
                    ("catalog_throughput_per_hour", throughput.value),
                    ("trips_per_process_unit", trips_per_operation),
                ),
            )
            recorder.add(
                "candidate.productivity.effective_trips_per_robot_hour",
                result.effective_trips_per_robot_hour,
                "trips/hour",
                (
                    (
                        "nominal_trips_per_robot_hour",
                        result.nominal_capacity_per_hour,
                    ),
                    (
                        "productive_time_share",
                        request.norms.productive_time_share,
                    ),
                    (
                        "technical_availability",
                        request.norms.technical_availability,
                    ),
                ),
            )
            return result
        recorder.add(
            "candidate.productivity.one_way_route_m",
            task.one_way_route_m,
            "m",
            (("task_one_way_route_m", task.one_way_route_m),),
        )
        recorder.add(
            "candidate.productivity.operating_speed_mps",
            result.effective_speed_mps,
            "m/s",
            (
                ("max_speed_mps", candidate.max_speed_mps),
                ("site_speed_limit_mps", task.site_speed_limit_mps),
                (
                    "operating_speed_factor",
                    request.norms.operating_speed_factor,
                ),
            ),
        )
        recorder.add(
            "candidate.productivity.round_trip_movement_seconds",
            result.movement_seconds,
            "seconds",
            (
                ("one_way_route_m", task.one_way_route_m),
                ("operating_speed_mps", result.effective_speed_mps),
            ),
        )
        recorder.add(
            "candidate.productivity.round_trip_lift_seconds",
            result.lift_seconds,
            "seconds",
            (
                ("lift_trip_share", task.lift_trip_share),
                ("one_way_lift_seconds", task.one_way_lift_seconds),
            ),
        )
        recorder.add(
            "candidate.productivity.cycle_seconds",
            result.cycle_seconds,
            "seconds",
            (
                ("round_trip_movement_seconds", result.movement_seconds),
                ("loading_seconds", candidate.loading_seconds),
                ("unloading_seconds", candidate.unloading_seconds),
                ("round_trip_lift_seconds", result.lift_seconds),
            ),
        )
        recorder.add(
            "candidate.productivity.nominal_cycles_per_hour",
            result.nominal_cycles_per_hour,
            "cycles/hour",
            (("cycle_seconds", result.cycle_seconds),),
        )
        recorder.add(
            "candidate.productivity.effective_trips_per_robot_hour",
            result.effective_trips_per_robot_hour,
            "trips/hour",
            (
                (
                    "nominal_cycles_per_hour",
                    result.nominal_cycles_per_hour,
                ),
                ("productive_time_share", request.norms.productive_time_share),
                (
                    "technical_availability",
                    request.norms.technical_availability,
                ),
            ),
        )
        return result

    def _calculate_fleet(
        self,
        request: EvaluationRequest,
        demand: formulas.DemandResult,
        productivity: formulas.ProductivityResult,
        recorder: CalculationTracer,
    ) -> formulas.FleetResult:
        result = formulas.calculate_fleet(
            formulas.FleetInputs(
                peak_trips_per_hour=demand.peak_trips_per_hour,
                effective_trips_per_robot_hour=(
                    productivity.effective_trips_per_robot_hour
                ),
                fleet_reserve_share=request.norms.fleet_reserve_share,
                robots_per_charger=request.norms.robots_per_charger,
                average_operations_per_hour=(
                    demand.average_operations_per_hour
                ),
                trips_per_operation=demand.trips_per_operation,
                nominal_cycles_per_hour=(
                    productivity.nominal_capacity_per_hour
                    if productivity.nominal_cycles_per_hour is None
                    else productivity.nominal_cycles_per_hour
                ),
                nominal_capacity_per_hour=(
                    productivity.nominal_capacity_per_hour
                ),
                charger_power_kw=request.norms.charger_power_kw,
            )
        )
        recorder.add(
            "candidate.fleet.robot_count",
            result.robot_count,
            "robots",
            (
                ("peak_trips_per_hour", demand.peak_trips_per_hour),
                (
                    "effective_trips_per_robot_hour",
                    productivity.effective_trips_per_robot_hour,
                ),
                ("fleet_reserve_share", request.norms.fleet_reserve_share),
            ),
        )
        recorder.add(
            "candidate.fleet.charger_count",
            result.charger_count,
            "chargers",
            (
                ("robot_count", result.robot_count),
                ("robots_per_charger", request.norms.robots_per_charger),
            ),
        )
        recorder.add(
            "candidate.fleet.peak_capacity_per_hour",
            result.peak_capacity_per_hour,
            "trips/hour",
            (
                ("robot_count", result.robot_count),
                (
                    "effective_trips_per_robot_hour",
                    productivity.effective_trips_per_robot_hour,
                ),
            ),
        )
        recorder.add(
            "candidate.fleet.average_utilization",
            result.average_utilization,
            "fraction",
            (
                (
                    "average_operations_per_hour",
                    demand.average_operations_per_hour,
                ),
                ("trips_per_operation", demand.trips_per_operation),
                ("robot_count", result.robot_count),
                (
                    (
                        "nominal_cycles_per_hour",
                        productivity.nominal_cycles_per_hour,
                    )
                    if productivity.nominal_cycles_per_hour is not None
                    else (
                        "nominal_capacity_per_hour",
                        productivity.nominal_capacity_per_hour,
                    )
                ),
            ),
        )
        recorder.add(
            "candidate.fleet.required_charging_power_kw",
            result.required_charging_power_kw,
            "kW",
            (
                ("charger_count", result.charger_count),
                ("charger_power_kw", request.norms.charger_power_kw),
            ),
        )
        return result

    def _calculate_capex(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        scenario: Scenario,
        fleet: formulas.FleetResult,
        recorder: CalculationTracer,
    ) -> formulas.CapexResult:
        assert candidate.price is not None
        is_purchase = Decimal(
            int(scenario.acquisition_model is AcquisitionModel.PURCHASE)
        )
        task = request.task
        norms = request.norms
        integration_cost = (
            task.integration_cost.base_amount
            if task.integration_cost is not None
            else assumptions.ZERO
        )
        result = formulas.calculate_capex(
            formulas.CapexInputs(
                robot_count=fleet.robot_count,
                charger_count=fleet.charger_count,
                catalog_price=candidate.price.base_amount,
                price_factor=scenario.price_factor,
                is_purchase=is_purchase,
                charger_installed_price=(
                    norms.charger_installed_price.base_amount
                ),
                site_preparation_share=norms.site_preparation_share,
                fms_upfront_share=norms.fms_upfront_share,
                integration_cost=integration_cost,
                delivery_share=norms.delivery_share,
                commissioning_share=norms.commissioning_share,
                raas_setup_share=norms.raas_setup_share,
                training_cost=norms.training_cost.base_amount,
                contingency_share=norms.capex_contingency_share,
            )
        )
        recorder.add(
            "candidate.price.adjusted_robot_price",
            result.adjusted_price,
            CALCULATION_CURRENCY,
            (
                ("catalog_price", candidate.price.base_amount),
                ("price_factor", scenario.price_factor),
            ),
        )
        recorder.add(
            "candidate.price.is_purchase",
            is_purchase,
            "boolean",
            (("acquisition_model", scenario.acquisition_model),),
        )
        recorder.add(
            "candidate.capex.equipment",
            result.equipment,
            CALCULATION_CURRENCY,
            (
                ("robot_count", fleet.robot_count),
                ("adjusted_robot_price", result.adjusted_price),
                ("is_purchase", is_purchase),
            ),
        )
        recorder.add(
            "candidate.capex.charging",
            result.charging,
            CALCULATION_CURRENCY,
            (
                ("charger_count", fleet.charger_count),
                (
                    "charger_installed_price",
                    request.norms.charger_installed_price.base_amount,
                ),
                ("is_purchase", is_purchase),
            ),
        )
        recorder.add(
            "candidate.capex.site_preparation",
            result.site_preparation,
            CALCULATION_CURRENCY,
            (
                ("robot_count", fleet.robot_count),
                ("adjusted_robot_price", result.adjusted_price),
                (
                    "site_preparation_share",
                    request.norms.site_preparation_share,
                ),
            ),
        )
        recorder.add(
            "candidate.capex.software",
            result.software,
            CALCULATION_CURRENCY,
            (
                ("equipment_capex", result.equipment),
                ("fms_upfront_share", request.norms.fms_upfront_share),
            ),
        )
        recorder.add(
            "candidate.capex.integration",
            result.integration,
            CALCULATION_CURRENCY,
            (
                (
                    "integration_cost",
                    request.task.integration_cost.base_amount
                    if request.task.integration_cost is not None
                    else assumptions.ZERO,
                ),
                ("robot_count", fleet.robot_count),
            ),
        )
        recorder.add(
            "candidate.capex.delivery",
            result.delivery,
            CALCULATION_CURRENCY,
            (
                ("equipment_capex", result.equipment),
                ("delivery_share", request.norms.delivery_share),
            ),
        )
        recorder.add(
            "candidate.capex.commissioning",
            result.commissioning,
            CALCULATION_CURRENCY,
            (
                ("equipment_capex", result.equipment),
                ("commissioning_share", request.norms.commissioning_share),
                ("is_purchase", is_purchase),
                ("robot_count", fleet.robot_count),
                ("adjusted_robot_price", result.adjusted_price),
                ("raas_setup_share", request.norms.raas_setup_share),
            ),
        )
        recorder.add(
            "candidate.capex.training",
            result.training,
            CALCULATION_CURRENCY,
            (
                ("training_cost", request.norms.training_cost.base_amount),
                ("robot_count", fleet.robot_count),
            ),
        )
        recorder.add(
            "candidate.capex.before_contingency",
            result.subtotal,
            CALCULATION_CURRENCY,
            (
                ("equipment_capex", result.equipment),
                ("charging_capex", result.charging),
                ("site_preparation_capex", result.site_preparation),
                ("software_capex", result.software),
                ("integration_capex", result.integration),
                ("delivery_capex", result.delivery),
                ("commissioning_capex", result.commissioning),
                ("training_capex", result.training),
            ),
        )
        recorder.add(
            "candidate.capex.contingency",
            result.contingency,
            CALCULATION_CURRENCY,
            (
                ("capex_before_contingency", result.subtotal),
                ("contingency_share", request.norms.capex_contingency_share),
            ),
        )
        recorder.add(
            "candidate.capex.total",
            result.total,
            CALCULATION_CURRENCY,
            (
                ("capex_before_contingency", result.subtotal),
                ("contingency_capex", result.contingency),
            ),
        )
        return result

    def _calculate_opex(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        scenario: Scenario,
        labor: formulas.LaborResult,
        fleet: formulas.FleetResult,
        capex: formulas.CapexResult,
        recorder: CalculationTracer,
    ) -> formulas.OpexResult:
        assert candidate.average_power_kw is not None
        is_purchase = Decimal(
            int(scenario.acquisition_model is AcquisitionModel.PURCHASE)
        )
        robot_count = fleet.robot_count
        equipment = capex.equipment
        adjusted_price = capex.adjusted_price
        task = request.task
        norms = request.norms
        consumables_per_robot = (
            task.annual_consumables_per_robot.base_amount
            if task.annual_consumables_per_robot is not None
            else assumptions.ZERO
        )
        total_capex = capex.total
        result = formulas.calculate_opex(
            formulas.OpexInputs(
                is_purchase=is_purchase,
                robot_count=robot_count,
                adjusted_price=adjusted_price,
                equipment_capex=equipment,
                total_capex=total_capex,
                average_power_kw=candidate.average_power_kw,
                operating_hours_per_day=task.operating_hours_per_day,
                electricity_price=norms.electricity_price.base_amount,
                annual_connectivity_cost=(
                    norms.annual_connectivity_cost.base_amount
                ),
                consumables_per_robot=consumables_per_robot,
                fleet_operators_per_shift=task.fleet_operators_per_shift,
                shifts_per_day=task.shifts_per_day,
                staff_time_loss_share=task.staff_time_loss_share,
                fleet_operator_monthly_salary=(
                    task.fleet_operator_monthly_salary.base_amount
                ),
                payroll_multiplier=norms.payroll_multiplier,
                labor_factor=scenario.labor_factor,
                remaining_annual_payroll=labor.remaining_annual_payroll,
                loan_share=norms.loan_share,
                loan_interest_rate=norms.loan_interest_rate,
                loan_term_years=norms.loan_term_years,
                monthly_raas_share=norms.monthly_raas_share,
                annual_service_share=norms.annual_service_share,
                annual_license_share=norms.annual_license_share,
                annual_repair_share=norms.annual_repair_share,
            )
        )
        recorder.add(
            "candidate.opex.baseline_annual_opex",
            labor.scenario_baseline_payroll,
            f"{CALCULATION_CURRENCY}/year",
            (
                (
                    "scenario_baseline_payroll",
                    labor.scenario_baseline_payroll,
                ),
            ),
        )
        recorder.add(
            "candidate.opex.annual_raas_cost",
            result.raas,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("is_purchase", is_purchase),
                ("robot_count", robot_count),
                ("adjusted_robot_price", adjusted_price),
                ("monthly_raas_share", norms.monthly_raas_share),
            ),
        )
        recorder.add(
            "candidate.opex.annual_service_cost",
            result.service,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("is_purchase", is_purchase),
                ("equipment_capex", equipment),
                ("annual_service_share", norms.annual_service_share),
            ),
        )
        recorder.add(
            "candidate.opex.annual_license_cost",
            result.license,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("is_purchase", is_purchase),
                ("equipment_capex", equipment),
                ("annual_license_share", norms.annual_license_share),
            ),
        )
        recorder.add(
            "candidate.opex.annual_repair_cost",
            result.repair,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("is_purchase", is_purchase),
                ("equipment_capex", equipment),
                ("annual_repair_share", norms.annual_repair_share),
            ),
        )
        recorder.add(
            "candidate.opex.annual_energy_cost",
            result.energy,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("robot_count", robot_count),
                ("average_power_kw", candidate.average_power_kw),
                ("operating_hours_per_day", task.operating_hours_per_day),
                ("days_per_year", assumptions.DAYS_PER_YEAR),
                ("electricity_price", norms.electricity_price.base_amount),
            ),
        )
        recorder.add(
            "candidate.opex.annual_connectivity_cost",
            result.connectivity,
            f"{CALCULATION_CURRENCY}/year",
            (
                (
                    "annual_connectivity_cost",
                    norms.annual_connectivity_cost.base_amount,
                ),
                ("robot_count", robot_count),
            ),
        )
        recorder.add(
            "candidate.opex.annual_consumables_cost",
            result.consumables,
            f"{CALCULATION_CURRENCY}/year",
            (
                (
                    "annual_consumables_per_robot",
                    consumables_per_robot,
                ),
                ("robot_count", robot_count),
            ),
        )
        recorder.add(
            "candidate.opex.annual_fleet_staff_cost",
            result.fleet_staff,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("fleet_operators_per_shift", task.fleet_operators_per_shift),
                ("shifts_per_day", task.shifts_per_day),
                ("staff_time_loss_share", task.staff_time_loss_share),
                (
                    "fleet_operator_monthly_salary",
                    task.fleet_operator_monthly_salary.base_amount,
                ),
                ("payroll_multiplier", norms.payroll_multiplier),
                ("labor_factor", scenario.labor_factor),
            ),
        )
        recorder.add(
            "candidate.opex.annual_financing_cost",
            result.financing,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("is_purchase", is_purchase),
                ("total_capex", total_capex),
                ("loan_share", norms.loan_share),
                ("loan_interest_rate", norms.loan_interest_rate),
                ("loan_term_years", norms.loan_term_years),
            ),
        )
        recorder.add(
            "candidate.opex.annual_solution_opex",
            result.solution_opex,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("annual_raas_cost", result.raas),
                ("annual_service_cost", result.service),
                ("annual_license_cost", result.license),
                ("annual_repair_cost", result.repair),
                ("annual_energy_cost", result.energy),
                ("annual_connectivity_cost", result.connectivity),
                ("annual_consumables_cost", result.consumables),
                ("annual_fleet_staff_cost", result.fleet_staff),
                ("annual_financing_cost", result.financing),
            ),
        )
        recorder.add(
            "candidate.opex.annual_process_opex",
            result.process_opex,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("remaining_annual_payroll", labor.remaining_annual_payroll),
                ("annual_solution_opex", result.solution_opex),
            ),
        )
        return result

    def _calculate_effects(
        self,
        request: EvaluationRequest,
        scenario: Scenario,
        labor: formulas.LaborResult,
        capex: formulas.CapexResult,
        opex: formulas.OpexResult,
        recorder: CalculationTracer,
    ) -> formulas.EffectsResult:
        task = request.task
        norms = request.norms
        baseline = labor.scenario_baseline_payroll
        other_benefits = task.annual_other_benefits.base_amount
        is_purchase = Decimal(
            int(scenario.acquisition_model is AcquisitionModel.PURCHASE)
        )
        result = formulas.calculate_effects(
            formulas.EffectsInputs(
                baseline_opex=baseline,
                process_opex=opex.process_opex,
                released_fte=labor.released_fte,
                annual_staff_turnover=task.annual_staff_turnover,
                recruitment_months_salary=norms.recruitment_months_salary,
                target_monthly_salary=task.target_monthly_salary.base_amount,
                labor_factor=scenario.labor_factor,
                annual_other_benefits=other_benefits,
                total_capex=capex.total,
                equipment_life_years=norms.equipment_life_years,
                is_purchase=is_purchase,
            )
        )
        recorder.add(
            "candidate.effects.change_in_annual_opex",
            result.change_in_annual_opex,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("annual_process_opex", opex.process_opex),
                ("baseline_annual_opex", baseline),
            ),
        )
        recorder.add(
            "candidate.effects.annual_recruitment_saving",
            result.recruitment_saving,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("released_fte", labor.released_fte),
                ("annual_staff_turnover", task.annual_staff_turnover),
                (
                    "recruitment_months_salary",
                    norms.recruitment_months_salary,
                ),
                (
                    "target_monthly_salary",
                    task.target_monthly_salary.base_amount,
                ),
                ("labor_factor", scenario.labor_factor),
            ),
        )
        recorder.add(
            "candidate.effects.annual_other_benefits",
            other_benefits,
            f"{CALCULATION_CURRENCY}/year",
            (("annual_other_benefits", other_benefits),),
        )
        recorder.add(
            "candidate.effects.net_annual_benefit",
            result.net_annual_benefit,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("baseline_annual_opex", baseline),
                ("annual_process_opex", opex.process_opex),
                (
                    "annual_recruitment_saving",
                    result.recruitment_saving,
                ),
                ("annual_other_benefits", other_benefits),
            ),
        )
        recorder.add(
            "candidate.effects.annual_depreciation",
            result.depreciation,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("total_capex", capex.total),
                ("equipment_life_years", norms.equipment_life_years),
                ("is_purchase", is_purchase),
            ),
        )
        recorder.add(
            "candidate.effects.annual_benefit_after_depreciation",
            result.benefit_after_depreciation,
            f"{CALCULATION_CURRENCY}/year",
            (
                ("net_annual_benefit", result.net_annual_benefit),
                ("annual_depreciation", result.depreciation),
            ),
        )
        return result

    def _calculate_returns(
        self,
        request: EvaluationRequest,
        scenario: Scenario,
        labor: formulas.LaborResult,
        capex: formulas.CapexResult,
        opex: formulas.OpexResult,
        effects: formulas.EffectsResult,
        recorder: CalculationTracer,
    ) -> None:
        is_purchase = Decimal(
            int(scenario.acquisition_model is AcquisitionModel.PURCHASE)
        )
        horizon = Decimal(request.task.horizon_years)
        budget = request.task.budget
        result = formulas.calculate_returns(
            formulas.ReturnsInputs(
                total_capex=capex.total,
                net_annual_benefit=effects.net_annual_benefit,
                horizon_years=horizon,
                is_purchase=is_purchase,
                battery_life_years=request.norms.battery_life_years,
                equipment_capex=capex.equipment,
                battery_replacement_share=(
                    request.norms.battery_replacement_share
                ),
                annual_solution_opex=opex.solution_opex,
                baseline_annual_opex=labor.scenario_baseline_payroll,
                annual_process_opex=opex.process_opex,
                budget=budget.base_amount if budget is not None else None,
            )
        )
        interpretation = self._interpretation(
            effects.net_annual_benefit, result.simple_payback_years, request
        )
        recorder.add(
            "candidate.returns.simple_payback_years",
            result.simple_payback_years,
            "years",
            (
                ("total_capex", capex.total),
                ("net_annual_benefit", effects.net_annual_benefit),
            ),
        )
        recorder.add(
            "candidate.returns.horizon_years",
            request.task.horizon_years,
            "years",
            (("task_horizon_years", request.task.horizon_years),),
        )
        recorder.add(
            "candidate.returns.battery_replacement_events",
            result.battery_replacement_events,
            "events",
            (
                ("is_purchase", is_purchase),
                ("horizon_years", horizon),
                ("battery_life_years", request.norms.battery_life_years),
            ),
        )
        recorder.add(
            "candidate.returns.fleet_battery_replacement_cost",
            result.fleet_battery_replacement_cost,
            CALCULATION_CURRENCY,
            (
                (
                    "equipment_capex",
                    capex.equipment,
                ),
                (
                    "battery_replacement_share",
                    request.norms.battery_replacement_share,
                ),
            ),
        )
        recorder.add(
            "candidate.returns.cumulative_operating_benefit",
            result.cumulative_operating_benefit,
            CALCULATION_CURRENCY,
            (
                ("net_annual_benefit", effects.net_annual_benefit),
                ("horizon_years", horizon),
                (
                    "battery_replacement_events",
                    result.battery_replacement_events,
                ),
                (
                    "fleet_battery_replacement_cost",
                    result.fleet_battery_replacement_cost,
                ),
            ),
        )
        recorder.add(
            "candidate.returns.workbook_roi",
            result.workbook_roi,
            "fraction",
            (
                (
                    "cumulative_operating_benefit",
                    result.cumulative_operating_benefit,
                ),
                ("total_capex", capex.total),
            ),
        )
        recorder.add(
            "candidate.returns.solution_tco",
            result.solution_tco,
            CALCULATION_CURRENCY,
            (
                ("total_capex", capex.total),
                (
                    "annual_solution_opex",
                    opex.solution_opex,
                ),
                ("horizon_years", horizon),
                (
                    "battery_replacement_events",
                    result.battery_replacement_events,
                ),
                (
                    "fleet_battery_replacement_cost",
                    result.fleet_battery_replacement_cost,
                ),
            ),
        )
        recorder.add(
            "candidate.returns.baseline_process_tco",
            result.baseline_process_tco,
            CALCULATION_CURRENCY,
            (
                (
                    "baseline_annual_opex",
                    labor.scenario_baseline_payroll,
                ),
                ("horizon_years", horizon),
            ),
        )
        recorder.add(
            "candidate.returns.robotized_process_tco",
            result.robotized_process_tco,
            CALCULATION_CURRENCY,
            (
                ("total_capex", capex.total),
                (
                    "annual_process_opex",
                    opex.process_opex,
                ),
                ("horizon_years", horizon),
                (
                    "battery_replacement_events",
                    result.battery_replacement_events,
                ),
                (
                    "fleet_battery_replacement_cost",
                    result.fleet_battery_replacement_cost,
                ),
            ),
        )
        recorder.add(
            "candidate.returns.change_in_process_tco",
            result.change_in_process_tco,
            CALCULATION_CURRENCY,
            (
                ("robotized_process_tco", result.robotized_process_tco),
                ("baseline_process_tco", result.baseline_process_tco),
            ),
        )
        recorder.add(
            "candidate.budget.within_budget",
            result.within_budget,
            "boolean",
            (
                ("total_capex", capex.total),
                ("budget", budget.base_amount if budget is not None else None),
            ),
        )
        recorder.add(
            "candidate.budget.overage",
            result.budget_overage,
            CALCULATION_CURRENCY,
            (
                ("total_capex", capex.total),
                ("budget", budget.base_amount if budget is not None else None),
            ),
        )
        recorder.add(
            "candidate.budget.overage_share",
            result.budget_overage_share,
            "fraction",
            (
                ("overage", result.budget_overage),
                ("budget", budget.base_amount if budget is not None else None),
            ),
        )
        recorder.add(
            "candidate.interpretation",
            interpretation,
            "",
            (
                ("net_annual_benefit", effects.net_annual_benefit),
                ("simple_payback_years", result.simple_payback_years),
                ("good_payback_years", request.norms.good_payback_years),
                ("medium_payback_years", request.norms.medium_payback_years),
            ),
        )

    def _risks(
        self,
        request: EvaluationRequest,
        candidate: RobotCandidate,
        recorder: CalculationTracer,
    ) -> list[ReasonCode]:
        risks: list[ReasonCode] = []
        if candidate.catalog_status != "operation":
            risks.append(ReasonCode.CATALOG_STATUS_NOT_OPERATIONAL)
        if candidate.confirmation.value != "confirmed":
            risks.append(ReasonCode.CATALOG_SPECS_UNCONFIRMED)
        budget = request.task.budget
        within_budget = self._scalar_value(
            recorder, "candidate.budget.within_budget"
        )
        if budget is not None and within_budget is False:
            risks.append(ReasonCode.CAPEX_EXCEEDS_BUDGET)
        required_power = self._value(
            recorder, "candidate.fleet.required_charging_power_kw"
        )
        if required_power > request.task.available_charging_power_kw:
            risks.append(ReasonCode.CHARGING_POWER_INSUFFICIENT)
        utilization = self._value(
            recorder, "candidate.fleet.average_utilization"
        )
        if utilization < assumptions.LOW_UTILIZATION_THRESHOLD:
            risks.append(ReasonCode.FLEET_UTILIZATION_BELOW_THRESHOLD)
        if (
            self._value(recorder, "candidate.effects.net_annual_benefit")
            <= assumptions.ZERO
        ):
            risks.append(ReasonCode.NON_POSITIVE_ANNUAL_BENEFIT)
        return risks

    @staticmethod
    def _value(recorder: CalculationTracer, code: str) -> Decimal:
        """Returns a recorded decimal metric for a downstream formula."""

        for metric in reversed(recorder.metrics):
            if metric.code == code:
                if isinstance(metric.value, Decimal):
                    return metric.value
                raise InvalidInputError(f"Metric {code} is not decimal-valued.")
        raise InvalidInputError(f"Metric {code} was not recorded.")

    @staticmethod
    def _scalar_value(recorder: CalculationTracer, code: str) -> ScalarValue:
        """Returns a recorded metric regardless of its scalar type."""

        for metric in reversed(recorder.metrics):
            if metric.code == code:
                return metric.value
        raise InvalidInputError(f"Metric {code} was not recorded.")

    @staticmethod
    def _interpretation(
        net_benefit: Decimal,
        payback: Decimal | None,
        request: EvaluationRequest,
    ) -> str:
        """Returns the source methodology's qualitative interpretation."""

        if net_benefit <= assumptions.ZERO or payback is None:
            return "Does not pay back: net annual benefit is not positive."
        if payback <= request.norms.good_payback_years:
            return "High suitability."
        if payback <= request.norms.medium_payback_years:
            return "Medium suitability; pilot recommended."
        return "Low suitability; requires clarification."
