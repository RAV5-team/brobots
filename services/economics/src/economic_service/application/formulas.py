"""Pure Decimal formulas for the economic calculation stages."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

from economic_service.application import assumptions
from economic_service.domain.errors import InvalidInputError


@dataclass(frozen=True)
class DemandInputs:
    """Inputs for scenario demand and divisible-load trip calculations."""

    operations_per_day: Decimal
    peak_factor: Decimal
    automatable_share: Decimal
    operating_hours_per_day: Decimal
    load_unit_mass_kg: Decimal
    load_is_divisible: bool
    payload_kg: Decimal | None
    volume_factor: Decimal


@dataclass(frozen=True)
class DemandResult:
    """Calculated demand metrics for one candidate and scenario."""

    scenario_operations_per_day: Decimal
    automatable_operations_per_day: Decimal
    trips_per_operation: Decimal
    average_operations_per_hour: Decimal
    peak_operations_per_hour: Decimal
    peak_trips_per_hour: Decimal


def calculate_demand(inputs: DemandInputs) -> DemandResult:
    """Calculates average and peak demand in operations and trips."""

    scenario_operations = calculate_scenario_operations(
        inputs.operations_per_day, inputs.volume_factor
    )
    automatable_operations = calculate_automatable_operations(
        scenario_operations, inputs.automatable_share
    )
    trips_per_operation = calculate_trips_per_operation(
        inputs.load_unit_mass_kg,
        inputs.load_is_divisible,
        inputs.payload_kg,
    )
    average_operations = calculate_average_operations_per_hour(
        automatable_operations, inputs.operating_hours_per_day
    )
    peak_operations = calculate_peak_operations_per_hour(
        inputs.operations_per_day,
        inputs.operating_hours_per_day,
        inputs.peak_factor,
        inputs.volume_factor,
        inputs.automatable_share,
    )
    return DemandResult(
        scenario_operations_per_day=scenario_operations,
        automatable_operations_per_day=automatable_operations,
        trips_per_operation=trips_per_operation,
        average_operations_per_hour=average_operations,
        peak_operations_per_hour=peak_operations,
        peak_trips_per_hour=calculate_peak_trips_per_hour(
            peak_operations, trips_per_operation
        ),
    )


def calculate_scenario_operations(
    operations_per_day: Decimal,
    volume_factor: Decimal,
) -> Decimal:
    """Calculates scenario-adjusted operations per day."""

    return operations_per_day * volume_factor


def calculate_automatable_operations(
    scenario_operations_per_day: Decimal,
    automatable_share: Decimal,
) -> Decimal:
    """Calculates automatable operations per day."""

    return scenario_operations_per_day * automatable_share


def calculate_trips_per_operation(
    load_unit_mass_kg: Decimal,
    load_is_divisible: bool,
    payload_kg: Decimal | None,
) -> Decimal:
    """Calculates trips needed for one operation."""

    if not load_is_divisible:
        return assumptions.ONE
    payload = payload_kg or assumptions.MINIMUM_DIVISIBLE_PAYLOAD
    return _ceil(
        load_unit_mass_kg / max(payload, assumptions.MINIMUM_DIVISIBLE_PAYLOAD)
    )


def calculate_average_operations_per_hour(
    automatable_operations_per_day: Decimal,
    operating_hours_per_day: Decimal,
) -> Decimal:
    """Calculates average automatable operations per hour."""

    return automatable_operations_per_day / operating_hours_per_day


def calculate_peak_operations_per_hour(
    operations_per_day: Decimal,
    operating_hours_per_day: Decimal,
    peak_factor: Decimal,
    volume_factor: Decimal,
    automatable_share: Decimal,
) -> Decimal:
    """Calculates peak automatable operations per hour."""

    return (
        operations_per_day
        / operating_hours_per_day
        * peak_factor
        * volume_factor
        * automatable_share
    )


def calculate_peak_trips_per_hour(
    peak_operations_per_hour: Decimal,
    trips_per_operation: Decimal,
) -> Decimal:
    """Calculates peak trips per hour."""

    return peak_operations_per_hour * trips_per_operation


@dataclass(frozen=True)
class LaborInputs:
    """Inputs for labor replacement and payroll effects."""

    replacement_share: Decimal
    baseline_annual_payroll: Decimal
    target_fte: Decimal
    target_annual_payroll: Decimal
    labor_factor: Decimal
    volume_factor: Decimal


@dataclass(frozen=True)
class LaborResult:
    """Calculated labor metrics for one candidate and scenario."""

    scenario_baseline_payroll: Decimal
    released_fte: Decimal
    annual_payroll_saving: Decimal
    remaining_annual_payroll: Decimal


def calculate_labor(inputs: LaborInputs) -> LaborResult:
    """Calculates payroll and FTE changes from labor replacement."""

    baseline_payroll = calculate_scenario_baseline_payroll(
        inputs.baseline_annual_payroll,
        inputs.labor_factor,
        inputs.volume_factor,
    )
    released_fte = calculate_released_fte(
        inputs.target_fte, inputs.replacement_share, inputs.volume_factor
    )
    payroll_saving = calculate_annual_payroll_saving(
        inputs.target_annual_payroll,
        inputs.replacement_share,
        inputs.labor_factor,
        inputs.volume_factor,
    )
    return LaborResult(
        scenario_baseline_payroll=baseline_payroll,
        released_fte=released_fte,
        annual_payroll_saving=payroll_saving,
        remaining_annual_payroll=calculate_remaining_annual_payroll(
            baseline_payroll, payroll_saving
        ),
    )


def calculate_scenario_baseline_payroll(
    baseline_annual_payroll: Decimal,
    labor_factor: Decimal,
    volume_factor: Decimal,
) -> Decimal:
    """Calculates baseline annual payroll for the scenario."""

    return baseline_annual_payroll * labor_factor * volume_factor


def calculate_released_fte(
    target_fte: Decimal,
    replacement_share: Decimal,
    volume_factor: Decimal,
) -> Decimal:
    """Calculates FTE released by automation in the scenario."""

    return target_fte * replacement_share * volume_factor


def calculate_annual_payroll_saving(
    target_annual_payroll: Decimal,
    replacement_share: Decimal,
    labor_factor: Decimal,
    volume_factor: Decimal,
) -> Decimal:
    """Calculates annual payroll savings in the scenario."""

    return (
        target_annual_payroll * replacement_share * labor_factor * volume_factor
    )


def calculate_remaining_annual_payroll(
    scenario_baseline_payroll: Decimal,
    annual_payroll_saving: Decimal,
) -> Decimal:
    """Calculates remaining annual payroll after automation savings."""

    return scenario_baseline_payroll - annual_payroll_saving


@dataclass(frozen=True)
class ProductivityInputs:
    """Inputs for cycle-based or catalog-rated robot productivity."""

    max_speed_mps: Decimal | None
    site_speed_limit_mps: Decimal
    operating_speed_factor: Decimal
    one_way_route_m: Decimal
    lift_trip_share: Decimal
    one_way_lift_seconds: Decimal
    loading_seconds: Decimal | None
    unloading_seconds: Decimal | None
    productive_time_share: Decimal
    technical_availability: Decimal
    trips_per_operation: Decimal = assumptions.ONE
    catalog_throughput_per_hour: Decimal | None = None


@dataclass(frozen=True)
class ProductivityResult:
    """Calculated nominal and effective robot capacity metrics."""

    effective_speed_mps: Decimal | None
    movement_seconds: Decimal | None
    lift_seconds: Decimal | None
    cycle_seconds: Decimal | None
    nominal_cycles_per_hour: Decimal | None
    nominal_capacity_per_hour: Decimal
    effective_trips_per_robot_hour: Decimal


def calculate_productivity(inputs: ProductivityInputs) -> ProductivityResult:
    """Calculates capacity from catalog throughput or the robot cycle."""

    if inputs.catalog_throughput_per_hour is not None:
        nominal_capacity = (
            inputs.catalog_throughput_per_hour * inputs.trips_per_operation
        )
        return ProductivityResult(
            effective_speed_mps=None,
            movement_seconds=None,
            lift_seconds=None,
            cycle_seconds=None,
            nominal_cycles_per_hour=None,
            nominal_capacity_per_hour=nominal_capacity,
            effective_trips_per_robot_hour=(
                calculate_effective_trips_per_robot_hour(
                    nominal_capacity,
                    inputs.productive_time_share,
                    inputs.technical_availability,
                )
            ),
        )

    if (
        inputs.max_speed_mps is None
        or inputs.loading_seconds is None
        or inputs.unloading_seconds is None
    ):
        raise InvalidInputError(
            "Cycle-based productivity requires speed, loading, and unloading."
        )

    effective_speed = calculate_effective_speed(
        inputs.max_speed_mps,
        inputs.site_speed_limit_mps,
        inputs.operating_speed_factor,
    )
    movement_seconds = calculate_round_trip_movement_seconds(
        inputs.one_way_route_m, effective_speed
    )
    lift_seconds = calculate_round_trip_lift_seconds(
        inputs.lift_trip_share, inputs.one_way_lift_seconds
    )
    cycle_seconds = calculate_cycle_seconds(
        movement_seconds,
        inputs.loading_seconds,
        inputs.unloading_seconds,
        lift_seconds,
    )
    nominal_cycles = calculate_nominal_cycles_per_hour(cycle_seconds)
    effective_trips = calculate_effective_trips_per_robot_hour(
        nominal_cycles,
        inputs.productive_time_share,
        inputs.technical_availability,
    )
    return ProductivityResult(
        effective_speed_mps=effective_speed,
        movement_seconds=movement_seconds,
        lift_seconds=lift_seconds,
        cycle_seconds=cycle_seconds,
        nominal_cycles_per_hour=nominal_cycles,
        nominal_capacity_per_hour=nominal_cycles,
        effective_trips_per_robot_hour=effective_trips,
    )


def calculate_effective_speed(
    max_speed_mps: Decimal,
    site_speed_limit_mps: Decimal,
    operating_speed_factor: Decimal,
) -> Decimal:
    """Calculates effective operating speed after site and norm limits."""

    effective_speed = (
        min(max_speed_mps, site_speed_limit_mps) * operating_speed_factor
    )
    if effective_speed <= assumptions.ZERO:
        raise InvalidInputError("Effective operating speed must be positive.")
    return effective_speed


def calculate_round_trip_movement_seconds(
    one_way_route_m: Decimal,
    effective_speed_mps: Decimal,
) -> Decimal:
    """Calculates round-trip movement time."""

    return (
        assumptions.ROUND_TRIP_MULTIPLIER
        * one_way_route_m
        / effective_speed_mps
    )


def calculate_round_trip_lift_seconds(
    lift_trip_share: Decimal,
    one_way_lift_seconds: Decimal,
) -> Decimal:
    """Calculates round-trip lift time weighted by lift trip share."""

    return (
        lift_trip_share
        * assumptions.ROUND_TRIP_MULTIPLIER
        * one_way_lift_seconds
    )


def calculate_cycle_seconds(
    movement_seconds: Decimal,
    loading_seconds: Decimal,
    unloading_seconds: Decimal,
    lift_seconds: Decimal,
) -> Decimal:
    """Calculates total cycle time and rejects nonpositive cycles."""

    cycle_seconds = (
        movement_seconds + loading_seconds + unloading_seconds + lift_seconds
    )
    if cycle_seconds <= assumptions.ZERO:
        raise InvalidInputError("Cycle time must be positive.")
    return cycle_seconds


def calculate_nominal_cycles_per_hour(cycle_seconds: Decimal) -> Decimal:
    """Calculates theoretical cycles completed in one hour."""

    return assumptions.SECONDS_PER_HOUR / cycle_seconds


def calculate_effective_trips_per_robot_hour(
    nominal_capacity_per_hour: Decimal,
    productive_time_share: Decimal,
    technical_availability: Decimal,
) -> Decimal:
    """Calculates effective trips after productivity and uptime factors."""

    return (
        nominal_capacity_per_hour
        * productive_time_share
        * technical_availability
    )


@dataclass(frozen=True)
class FleetInputs:
    """Inputs for fleet size, charger count, and utilization."""

    peak_trips_per_hour: Decimal
    effective_trips_per_robot_hour: Decimal
    fleet_reserve_share: Decimal
    robots_per_charger: Decimal
    average_operations_per_hour: Decimal
    trips_per_operation: Decimal
    nominal_cycles_per_hour: Decimal
    charger_power_kw: Decimal
    nominal_capacity_per_hour: Decimal | None = None


@dataclass(frozen=True)
class FleetResult:
    """Calculated fleet capacity, utilization, and charging requirement."""

    robot_count: Decimal
    charger_count: Decimal
    peak_capacity_per_hour: Decimal
    average_utilization: Decimal
    required_charging_power_kw: Decimal


def calculate_fleet(inputs: FleetInputs) -> FleetResult:
    """Sizes the fleet and derives charger count and average utilization."""

    robot_count = calculate_robot_count(
        inputs.peak_trips_per_hour,
        inputs.effective_trips_per_robot_hour,
        inputs.fleet_reserve_share,
    )
    charger_count = calculate_charger_count(
        robot_count, inputs.robots_per_charger
    )
    peak_capacity = calculate_peak_capacity(
        robot_count, inputs.effective_trips_per_robot_hour
    )
    nominal_capacity = (
        inputs.nominal_cycles_per_hour
        if inputs.nominal_capacity_per_hour is None
        else inputs.nominal_capacity_per_hour
    )
    utilization = calculate_average_utilization(
        inputs.average_operations_per_hour,
        inputs.trips_per_operation,
        robot_count,
        nominal_capacity,
    )
    return FleetResult(
        robot_count=robot_count,
        charger_count=charger_count,
        peak_capacity_per_hour=peak_capacity,
        average_utilization=utilization,
        required_charging_power_kw=calculate_required_charging_power(
            charger_count, inputs.charger_power_kw
        ),
    )


def calculate_robot_count(
    peak_trips_per_hour: Decimal,
    effective_trips_per_robot_hour: Decimal,
    fleet_reserve_share: Decimal,
) -> Decimal:
    """Calculates robots required to meet peak demand and reserve."""

    if effective_trips_per_robot_hour <= assumptions.ZERO:
        raise InvalidInputError("Effective productivity must be positive.")
    return max(
        assumptions.ONE,
        _ceil(
            peak_trips_per_hour
            / effective_trips_per_robot_hour
            * (assumptions.ONE + fleet_reserve_share)
        ),
    )


def calculate_charger_count(
    robot_count: Decimal,
    robots_per_charger: Decimal,
) -> Decimal:
    """Calculates charger count rounded up to cover all robots."""

    return _ceil(robot_count / robots_per_charger)


def calculate_peak_capacity(
    robot_count: Decimal,
    effective_trips_per_robot_hour: Decimal,
) -> Decimal:
    """Calculates peak fleet throughput capacity."""

    return robot_count * effective_trips_per_robot_hour


def calculate_average_utilization(
    average_operations_per_hour: Decimal,
    trips_per_operation: Decimal,
    robot_count: Decimal,
    nominal_capacity_per_hour: Decimal,
) -> Decimal:
    """Calculates average fleet utilization."""

    return (
        average_operations_per_hour
        * trips_per_operation
        / (robot_count * nominal_capacity_per_hour)
    )


def calculate_required_charging_power(
    charger_count: Decimal,
    charger_power_kw: Decimal,
) -> Decimal:
    """Calculates installed charging power required by the fleet."""

    return charger_count * charger_power_kw


@dataclass(frozen=True)
class CapexInputs:
    """Inputs for purchase or RaaS upfront investment calculations."""

    robot_count: Decimal
    charger_count: Decimal
    catalog_price: Decimal
    price_factor: Decimal
    is_purchase: Decimal
    charger_installed_price: Decimal
    site_preparation_share: Decimal
    fms_upfront_share: Decimal
    integration_cost: Decimal
    delivery_share: Decimal
    commissioning_share: Decimal
    raas_setup_share: Decimal
    training_cost: Decimal
    contingency_share: Decimal


@dataclass(frozen=True)
class CapexResult:
    """Calculated CAPEX components and adjusted robot price."""

    adjusted_price: Decimal
    equipment: Decimal
    charging: Decimal
    site_preparation: Decimal
    software: Decimal
    integration: Decimal
    delivery: Decimal
    commissioning: Decimal
    training: Decimal
    subtotal: Decimal
    contingency: Decimal
    total: Decimal


def calculate_capex(inputs: CapexInputs) -> CapexResult:
    """Calculates acquisition-specific CAPEX and contingency."""

    adjusted_price = calculate_adjusted_robot_price(
        inputs.catalog_price, inputs.price_factor
    )
    equipment = calculate_equipment_capex(
        inputs.robot_count, adjusted_price, inputs.is_purchase
    )
    charging = calculate_charging_capex(
        inputs.charger_count,
        inputs.charger_installed_price,
        inputs.is_purchase,
    )
    site_preparation = calculate_site_preparation_capex(
        inputs.robot_count, adjusted_price, inputs.site_preparation_share
    )
    software = calculate_software_capex(equipment, inputs.fms_upfront_share)
    integration = calculate_integration_capex(
        inputs.integration_cost, inputs.robot_count
    )
    delivery = calculate_delivery_capex(equipment, inputs.delivery_share)
    commissioning = calculate_commissioning_capex(
        inputs.robot_count,
        adjusted_price,
        inputs.is_purchase,
        equipment,
        inputs.commissioning_share,
        inputs.raas_setup_share,
    )
    training = calculate_training_capex(
        inputs.training_cost, inputs.robot_count
    )
    subtotal = calculate_capex_subtotal(
        equipment,
        charging,
        site_preparation,
        software,
        integration,
        delivery,
        commissioning,
        training,
    )
    contingency = calculate_capex_contingency(
        subtotal, inputs.contingency_share
    )
    return CapexResult(
        adjusted_price=adjusted_price,
        equipment=equipment,
        charging=charging,
        site_preparation=site_preparation,
        software=software,
        integration=integration,
        delivery=delivery,
        commissioning=commissioning,
        training=training,
        subtotal=subtotal,
        contingency=contingency,
        total=calculate_total_capex(subtotal, contingency),
    )


def calculate_adjusted_robot_price(
    catalog_price: Decimal,
    price_factor: Decimal,
) -> Decimal:
    """Calculates robot price adjusted by the scenario price factor."""

    return catalog_price * price_factor


def calculate_equipment_capex(
    robot_count: Decimal,
    adjusted_price: Decimal,
    is_purchase: Decimal,
) -> Decimal:
    """Calculates purchase cost for the robot fleet."""

    return robot_count * adjusted_price * is_purchase


def calculate_charging_capex(
    charger_count: Decimal,
    charger_installed_price: Decimal,
    is_purchase: Decimal,
) -> Decimal:
    """Calculates purchase cost for installed chargers."""

    return charger_count * charger_installed_price * is_purchase


def calculate_site_preparation_capex(
    robot_count: Decimal,
    adjusted_price: Decimal,
    site_preparation_share: Decimal,
) -> Decimal:
    """Calculates site preparation cost for the robot fleet."""

    return robot_count * adjusted_price * site_preparation_share


def calculate_software_capex(
    equipment_capex: Decimal,
    fms_upfront_share: Decimal,
) -> Decimal:
    """Calculates upfront software cost from equipment CAPEX."""

    return equipment_capex * fms_upfront_share


def calculate_integration_capex(
    integration_cost: Decimal,
    robot_count: Decimal,
) -> Decimal:
    """Calculates integration cost when the fleet contains robots."""

    return (
        integration_cost if robot_count > assumptions.ZERO else assumptions.ZERO
    )


def calculate_delivery_capex(
    equipment_capex: Decimal,
    delivery_share: Decimal,
) -> Decimal:
    """Calculates delivery cost from equipment CAPEX."""

    return equipment_capex * delivery_share


def calculate_commissioning_capex(
    robot_count: Decimal,
    adjusted_price: Decimal,
    is_purchase: Decimal,
    equipment_capex: Decimal,
    commissioning_share: Decimal,
    raas_setup_share: Decimal,
) -> Decimal:
    """Calculates purchase commissioning and RaaS setup costs."""

    return (
        equipment_capex * commissioning_share
        + (assumptions.ONE - is_purchase)
        * robot_count
        * adjusted_price
        * raas_setup_share
    )


def calculate_training_capex(
    training_cost: Decimal,
    robot_count: Decimal,
) -> Decimal:
    """Calculates training cost when the fleet contains robots."""

    return training_cost if robot_count > assumptions.ZERO else assumptions.ZERO


def calculate_capex_subtotal(*components: Decimal) -> Decimal:
    """Sums upfront CAPEX components before contingency."""

    return sum(components, assumptions.ZERO)


def calculate_capex_contingency(
    subtotal: Decimal,
    contingency_share: Decimal,
) -> Decimal:
    """Calculates contingency on pre-contingency CAPEX."""

    return subtotal * contingency_share


def calculate_total_capex(
    subtotal: Decimal,
    contingency: Decimal,
) -> Decimal:
    """Calculates total CAPEX including contingency."""

    return subtotal + contingency


@dataclass(frozen=True)
class OpexInputs:
    """Inputs for annual operating costs."""

    is_purchase: Decimal
    robot_count: Decimal
    adjusted_price: Decimal
    equipment_capex: Decimal
    total_capex: Decimal
    average_power_kw: Decimal
    operating_hours_per_day: Decimal
    electricity_price: Decimal
    annual_connectivity_cost: Decimal
    consumables_per_robot: Decimal
    fleet_operators_per_shift: Decimal
    shifts_per_day: Decimal
    staff_time_loss_share: Decimal
    fleet_operator_monthly_salary: Decimal
    payroll_multiplier: Decimal
    labor_factor: Decimal
    remaining_annual_payroll: Decimal
    loan_share: Decimal
    loan_interest_rate: Decimal
    loan_term_years: Decimal
    monthly_raas_share: Decimal
    annual_service_share: Decimal
    annual_license_share: Decimal
    annual_repair_share: Decimal


@dataclass(frozen=True)
class OpexResult:
    """Calculated annual OPEX components and totals."""

    raas: Decimal
    service: Decimal
    license: Decimal
    repair: Decimal
    energy: Decimal
    connectivity: Decimal
    consumables: Decimal
    fleet_staff: Decimal
    financing: Decimal
    solution_opex: Decimal
    process_opex: Decimal


def calculate_opex(inputs: OpexInputs) -> OpexResult:
    """Calculates annual costs for the solution and robotized process."""

    raas = calculate_annual_raas_cost(
        inputs.is_purchase,
        inputs.robot_count,
        inputs.adjusted_price,
        inputs.monthly_raas_share,
    )
    service = calculate_annual_service_cost(
        inputs.is_purchase,
        inputs.equipment_capex,
        inputs.annual_service_share,
    )
    license_cost = calculate_annual_license_cost(
        inputs.is_purchase,
        inputs.equipment_capex,
        inputs.annual_license_share,
    )
    repair = calculate_annual_repair_cost(
        inputs.is_purchase,
        inputs.equipment_capex,
        inputs.annual_repair_share,
    )
    energy = calculate_annual_energy_cost(
        inputs.robot_count,
        inputs.average_power_kw,
        inputs.operating_hours_per_day,
        inputs.electricity_price,
    )
    connectivity = calculate_annual_connectivity_cost(
        inputs.annual_connectivity_cost, inputs.robot_count
    )
    consumables = calculate_annual_consumables_cost(
        inputs.consumables_per_robot, inputs.robot_count
    )
    fleet_staff = calculate_annual_fleet_staff_cost(
        inputs.fleet_operators_per_shift,
        inputs.shifts_per_day,
        inputs.staff_time_loss_share,
        inputs.fleet_operator_monthly_salary,
        inputs.payroll_multiplier,
        inputs.labor_factor,
        inputs.robot_count,
    )
    financing = calculate_annual_financing_cost(
        inputs.is_purchase,
        inputs.total_capex,
        inputs.loan_share,
        inputs.loan_interest_rate,
        inputs.loan_term_years,
    )
    solution_opex = calculate_annual_solution_opex(
        raas,
        service,
        license_cost,
        repair,
        energy,
        connectivity,
        consumables,
        fleet_staff,
        financing,
    )
    return OpexResult(
        raas=raas,
        service=service,
        license=license_cost,
        repair=repair,
        energy=energy,
        connectivity=connectivity,
        consumables=consumables,
        fleet_staff=fleet_staff,
        financing=financing,
        solution_opex=solution_opex,
        process_opex=calculate_annual_process_opex(
            inputs.remaining_annual_payroll, solution_opex
        ),
    )


def calculate_annual_raas_cost(
    is_purchase: Decimal,
    robot_count: Decimal,
    adjusted_price: Decimal,
    monthly_raas_share: Decimal,
) -> Decimal:
    """Calculates annual RaaS fees."""

    return (
        (assumptions.ONE - is_purchase)
        * robot_count
        * adjusted_price
        * monthly_raas_share
        * assumptions.MONTHS_PER_YEAR
    )


def calculate_annual_service_cost(
    is_purchase: Decimal,
    equipment_capex: Decimal,
    annual_service_share: Decimal,
) -> Decimal:
    """Calculates annual service cost for purchased equipment."""

    return is_purchase * equipment_capex * annual_service_share


def calculate_annual_license_cost(
    is_purchase: Decimal,
    equipment_capex: Decimal,
    annual_license_share: Decimal,
) -> Decimal:
    """Calculates annual software license cost for purchased equipment."""

    return is_purchase * equipment_capex * annual_license_share


def calculate_annual_repair_cost(
    is_purchase: Decimal,
    equipment_capex: Decimal,
    annual_repair_share: Decimal,
) -> Decimal:
    """Calculates annual repair cost for purchased equipment."""

    return is_purchase * equipment_capex * annual_repair_share


def calculate_annual_energy_cost(
    robot_count: Decimal,
    average_power_kw: Decimal,
    operating_hours_per_day: Decimal,
    electricity_price: Decimal,
) -> Decimal:
    """Calculates annual fleet energy costs."""

    return (
        robot_count
        * average_power_kw
        * operating_hours_per_day
        * assumptions.DAYS_PER_YEAR
        * electricity_price
    )


def calculate_annual_connectivity_cost(
    annual_connectivity_cost: Decimal,
    robot_count: Decimal,
) -> Decimal:
    """Calculates annual connectivity costs when a fleet exists."""

    return (
        annual_connectivity_cost
        if robot_count > assumptions.ZERO
        else assumptions.ZERO
    )


def calculate_annual_consumables_cost(
    consumables_per_robot: Decimal,
    robot_count: Decimal,
) -> Decimal:
    """Calculates annual consumables for the fleet."""

    return consumables_per_robot * robot_count


def calculate_annual_fleet_staff_cost(
    fleet_operators_per_shift: Decimal,
    shifts_per_day: Decimal,
    staff_time_loss_share: Decimal,
    fleet_operator_monthly_salary: Decimal,
    payroll_multiplier: Decimal,
    labor_factor: Decimal,
    robot_count: Decimal,
) -> Decimal:
    """Calculates annual fleet staff cost when a fleet exists."""

    if robot_count <= assumptions.ZERO:
        return assumptions.ZERO
    return (
        fleet_operators_per_shift
        * shifts_per_day
        * (assumptions.ONE + staff_time_loss_share)
        * fleet_operator_monthly_salary
        * assumptions.MONTHS_PER_YEAR
        * payroll_multiplier
        * labor_factor
    )


def calculate_annual_financing_cost(
    is_purchase: Decimal,
    total_capex: Decimal,
    loan_share: Decimal,
    loan_interest_rate: Decimal,
    loan_term_years: Decimal,
) -> Decimal:
    """Calculates annualized financing cost for purchased equipment."""

    return (
        is_purchase
        * total_capex
        * loan_share
        * loan_interest_rate
        * (loan_term_years + assumptions.ONE)
        / (assumptions.ROUND_TRIP_MULTIPLIER * loan_term_years)
    )


def calculate_annual_solution_opex(*components: Decimal) -> Decimal:
    """Sums the annual operating costs of the robotic solution."""

    return sum(components, assumptions.ZERO)


def calculate_annual_process_opex(
    remaining_annual_payroll: Decimal,
    annual_solution_opex: Decimal,
) -> Decimal:
    """Calculates process OPEX after automation and solution costs."""

    return remaining_annual_payroll + annual_solution_opex


@dataclass(frozen=True)
class EffectsInputs:
    """Inputs for annual savings and depreciation metrics."""

    baseline_opex: Decimal
    process_opex: Decimal
    released_fte: Decimal
    annual_staff_turnover: Decimal
    recruitment_months_salary: Decimal
    target_monthly_salary: Decimal
    labor_factor: Decimal
    annual_other_benefits: Decimal
    total_capex: Decimal
    equipment_life_years: Decimal
    is_purchase: Decimal


@dataclass(frozen=True)
class EffectsResult:
    """Calculated annual savings, net benefit, and depreciation."""

    change_in_annual_opex: Decimal
    recruitment_saving: Decimal
    net_annual_benefit: Decimal
    depreciation: Decimal
    benefit_after_depreciation: Decimal


def calculate_effects(inputs: EffectsInputs) -> EffectsResult:
    """Calculates annual operating effects and depreciation."""

    recruitment_saving = calculate_annual_recruitment_saving(
        inputs.released_fte,
        inputs.annual_staff_turnover,
        inputs.recruitment_months_salary,
        inputs.target_monthly_salary,
        inputs.labor_factor,
    )
    net_benefit = calculate_net_annual_benefit(
        inputs.baseline_opex,
        inputs.process_opex,
        recruitment_saving,
        inputs.annual_other_benefits,
    )
    depreciation = calculate_annual_depreciation(
        inputs.total_capex,
        inputs.equipment_life_years,
        inputs.is_purchase,
    )
    return EffectsResult(
        change_in_annual_opex=calculate_change_in_annual_opex(
            inputs.process_opex, inputs.baseline_opex
        ),
        recruitment_saving=recruitment_saving,
        net_annual_benefit=net_benefit,
        depreciation=depreciation,
        benefit_after_depreciation=calculate_benefit_after_depreciation(
            net_benefit, depreciation
        ),
    )


def calculate_change_in_annual_opex(
    process_opex: Decimal,
    baseline_opex: Decimal,
) -> Decimal:
    """Calculates OPEX difference between robotized and baseline processes."""

    return process_opex - baseline_opex


def calculate_annual_recruitment_saving(
    released_fte: Decimal,
    annual_staff_turnover: Decimal,
    recruitment_months_salary: Decimal,
    target_monthly_salary: Decimal,
    labor_factor: Decimal,
) -> Decimal:
    """Calculates annual recruitment savings from released FTE."""

    return (
        released_fte
        * annual_staff_turnover
        * recruitment_months_salary
        * target_monthly_salary
        * labor_factor
    )


def calculate_net_annual_benefit(
    baseline_opex: Decimal,
    process_opex: Decimal,
    recruitment_saving: Decimal,
    annual_other_benefits: Decimal,
) -> Decimal:
    """Calculates total annual benefit before depreciation."""

    return (
        baseline_opex
        - process_opex
        + recruitment_saving
        + annual_other_benefits
    )


def calculate_annual_depreciation(
    total_capex: Decimal,
    equipment_life_years: Decimal,
    is_purchase: Decimal,
) -> Decimal:
    """Calculates annual depreciation for purchased equipment."""

    return total_capex / equipment_life_years * is_purchase


def calculate_benefit_after_depreciation(
    net_annual_benefit: Decimal,
    annual_depreciation: Decimal,
) -> Decimal:
    """Calculates annual benefit after depreciation."""

    return net_annual_benefit - annual_depreciation


@dataclass(frozen=True)
class ReturnsInputs:
    """Inputs for payback, ROI, TCO, and budget calculations."""

    total_capex: Decimal
    net_annual_benefit: Decimal
    horizon_years: Decimal
    is_purchase: Decimal
    battery_life_years: Decimal
    equipment_capex: Decimal
    battery_replacement_share: Decimal
    annual_solution_opex: Decimal
    baseline_annual_opex: Decimal
    annual_process_opex: Decimal
    budget: Decimal | None


@dataclass(frozen=True)
class ReturnsResult:
    """Calculated return, TCO, and budget metrics."""

    simple_payback_years: Decimal | None
    battery_replacement_events: Decimal
    fleet_battery_replacement_cost: Decimal
    cumulative_operating_benefit: Decimal
    workbook_roi: Decimal | None
    solution_tco: Decimal
    baseline_process_tco: Decimal
    robotized_process_tco: Decimal
    change_in_process_tco: Decimal
    within_budget: bool | None
    budget_overage: Decimal | None
    budget_overage_share: Decimal | None


def calculate_returns(inputs: ReturnsInputs) -> ReturnsResult:
    """Calculates investment returns, lifecycle costs, and budget fit."""

    payback = calculate_simple_payback(
        inputs.net_annual_benefit, inputs.total_capex
    )
    battery_events = calculate_battery_replacement_events(
        inputs.is_purchase, inputs.horizon_years, inputs.battery_life_years
    )
    battery_cost = calculate_fleet_battery_replacement_cost(
        inputs.equipment_capex, inputs.battery_replacement_share
    )
    cumulative_benefit = calculate_cumulative_operating_benefit(
        inputs.net_annual_benefit,
        inputs.horizon_years,
        battery_events,
        battery_cost,
    )
    workbook_roi = calculate_workbook_roi(
        cumulative_benefit, inputs.total_capex
    )
    solution_tco = calculate_solution_tco(
        inputs.total_capex,
        inputs.annual_solution_opex,
        inputs.horizon_years,
        battery_events,
        battery_cost,
    )
    baseline_tco = calculate_baseline_process_tco(
        inputs.baseline_annual_opex, inputs.horizon_years
    )
    process_tco = calculate_robotized_process_tco(
        inputs.total_capex,
        inputs.annual_process_opex,
        inputs.horizon_years,
        battery_events,
        battery_cost,
    )
    overage = calculate_budget_overage(inputs.total_capex, inputs.budget)
    overage_share = calculate_budget_overage_share(overage, inputs.budget)
    return ReturnsResult(
        simple_payback_years=payback,
        battery_replacement_events=battery_events,
        fleet_battery_replacement_cost=battery_cost,
        cumulative_operating_benefit=cumulative_benefit,
        workbook_roi=workbook_roi,
        solution_tco=solution_tco,
        baseline_process_tco=baseline_tco,
        robotized_process_tco=process_tco,
        change_in_process_tco=calculate_change_in_process_tco(
            process_tco, baseline_tco
        ),
        within_budget=calculate_within_budget(
            inputs.total_capex, inputs.budget
        ),
        budget_overage=overage,
        budget_overage_share=overage_share,
    )


def calculate_simple_payback(
    net_annual_benefit: Decimal,
    total_capex: Decimal,
) -> Decimal | None:
    """Calculates payback years when benefit and CAPEX support a ratio."""

    if net_annual_benefit <= assumptions.ZERO or total_capex < assumptions.ZERO:
        return None
    return total_capex / net_annual_benefit


def calculate_battery_replacement_events(
    is_purchase: Decimal,
    horizon_years: Decimal,
    battery_life_years: Decimal,
) -> Decimal:
    """Calculates battery replacement events during the evaluation horizon."""

    return is_purchase * _floor(
        (horizon_years - assumptions.ONE) / battery_life_years
    )


def calculate_fleet_battery_replacement_cost(
    equipment_capex: Decimal,
    battery_replacement_share: Decimal,
) -> Decimal:
    """Calculates replacement cost for the fleet's batteries."""

    return equipment_capex * battery_replacement_share


def calculate_cumulative_operating_benefit(
    net_annual_benefit: Decimal,
    horizon_years: Decimal,
    battery_replacement_events: Decimal,
    fleet_battery_replacement_cost: Decimal,
) -> Decimal:
    """Calculates benefit over the horizon after battery replacement costs."""

    return (
        net_annual_benefit * horizon_years
        - battery_replacement_events * fleet_battery_replacement_cost
    )


def calculate_workbook_roi(
    cumulative_operating_benefit: Decimal,
    total_capex: Decimal,
) -> Decimal | None:
    """Calculates ROI when total CAPEX is positive."""

    if total_capex <= assumptions.ZERO:
        return None
    return cumulative_operating_benefit / total_capex


def calculate_solution_tco(
    total_capex: Decimal,
    annual_solution_opex: Decimal,
    horizon_years: Decimal,
    battery_replacement_events: Decimal,
    fleet_battery_replacement_cost: Decimal,
) -> Decimal:
    """Calculates lifecycle cost of the robotic solution."""

    return (
        total_capex
        + annual_solution_opex * horizon_years
        + battery_replacement_events * fleet_battery_replacement_cost
    )


def calculate_baseline_process_tco(
    baseline_annual_opex: Decimal,
    horizon_years: Decimal,
) -> Decimal:
    """Calculates baseline process TCO over the evaluation horizon."""

    return baseline_annual_opex * horizon_years


def calculate_robotized_process_tco(
    total_capex: Decimal,
    annual_process_opex: Decimal,
    horizon_years: Decimal,
    battery_replacement_events: Decimal,
    fleet_battery_replacement_cost: Decimal,
) -> Decimal:
    """Calculates lifecycle cost of the robotized process."""

    return (
        total_capex
        + annual_process_opex * horizon_years
        + battery_replacement_events * fleet_battery_replacement_cost
    )


def calculate_change_in_process_tco(
    robotized_process_tco: Decimal,
    baseline_process_tco: Decimal,
) -> Decimal:
    """Calculates robotized process TCO change against baseline."""

    return robotized_process_tco - baseline_process_tco


def calculate_within_budget(
    total_capex: Decimal,
    budget: Decimal | None,
) -> bool | None:
    """Returns budget fit when a budget was provided."""

    if budget is None:
        return None
    return total_capex <= budget


def calculate_budget_overage(
    total_capex: Decimal,
    budget: Decimal | None,
) -> Decimal | None:
    """Calculates the amount by which CAPEX exceeds the budget."""

    if budget is None:
        return None
    return max(total_capex - budget, assumptions.ZERO)


def calculate_budget_overage_share(
    budget_overage: Decimal | None,
    budget: Decimal | None,
) -> Decimal | None:
    """Calculates budget overage as a share when budget is positive."""

    if budget_overage is None or budget is None or budget <= assumptions.ZERO:
        return None
    return budget_overage / budget


def _ceil(value: Decimal) -> Decimal:
    """Returns a non-floating-point ceiling as a Decimal."""

    return value.to_integral_value(rounding=ROUND_CEILING)


def _floor(value: Decimal) -> Decimal:
    """Returns a non-floating-point floor as a Decimal."""

    return value.to_integral_value(rounding=ROUND_FLOOR)
