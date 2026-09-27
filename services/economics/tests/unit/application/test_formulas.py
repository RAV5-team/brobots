"""Direct tests for deterministic economic formula stages."""

from decimal import Decimal

import pytest

from economic_service.application import formulas
from economic_service.domain.errors import InvalidInputError


def _decimal(value: str) -> Decimal:
    return Decimal(value)


def test_divisible_load_trip_count_uses_decimal_ceiling() -> None:
    result = formulas.calculate_demand(
        formulas.DemandInputs(
            operations_per_day=_decimal("100"),
            peak_factor=_decimal("2"),
            automatable_share=_decimal("0.8"),
            operating_hours_per_day=_decimal("10"),
            load_unit_mass_kg=_decimal("101"),
            load_is_divisible=True,
            payload_kg=_decimal("50"),
            volume_factor=_decimal("1"),
        )
    )

    assert result.trips_per_operation == _decimal("3")
    assert result.peak_trips_per_hour == _decimal("48.0")


def test_productivity_applies_speed_limit_and_cycle_components() -> None:
    result = formulas.calculate_productivity(
        formulas.ProductivityInputs(
            max_speed_mps=_decimal("3"),
            site_speed_limit_mps=_decimal("2"),
            operating_speed_factor=_decimal("0.5"),
            one_way_route_m=_decimal("100"),
            lift_trip_share=_decimal("0.5"),
            one_way_lift_seconds=_decimal("20"),
            loading_seconds=_decimal("10"),
            unloading_seconds=_decimal("20"),
            productive_time_share=_decimal("0.8"),
            technical_availability=_decimal("0.9"),
        )
    )

    assert result.effective_speed_mps == _decimal("1.0")
    assert result.movement_seconds == _decimal("200")
    assert result.lift_seconds == _decimal("20.0")
    assert result.cycle_seconds == _decimal("250.0")
    assert result.nominal_cycles_per_hour == _decimal("14.4")
    assert result.effective_trips_per_robot_hour == _decimal("10.368")


def test_productivity_rejects_nonpositive_effective_speed() -> None:
    inputs = formulas.ProductivityInputs(
        max_speed_mps=_decimal("1"),
        site_speed_limit_mps=_decimal("1"),
        operating_speed_factor=_decimal("0"),
        one_way_route_m=_decimal("100"),
        lift_trip_share=_decimal("0"),
        one_way_lift_seconds=_decimal("0"),
        loading_seconds=_decimal("10"),
        unloading_seconds=_decimal("10"),
        productive_time_share=_decimal("1"),
        technical_availability=_decimal("1"),
    )

    with pytest.raises(InvalidInputError, match="Effective operating speed"):
        formulas.calculate_productivity(inputs)


def test_labor_replacement_calculates_fte_and_payroll() -> None:
    result = formulas.calculate_labor(
        formulas.LaborInputs(
            replacement_share=_decimal("0.5"),
            baseline_annual_payroll=_decimal("120000"),
            target_fte=_decimal("10"),
            target_annual_payroll=_decimal("100000"),
            labor_factor=_decimal("1.1"),
            volume_factor=_decimal("0.8"),
        )
    )

    assert result.scenario_baseline_payroll == _decimal("105600.0")
    assert result.released_fte == _decimal("4.00")
    assert result.annual_payroll_saving == _decimal("44000.00")
    assert result.remaining_annual_payroll == _decimal("61600.00")


def test_fleet_sizes_robots_chargers_and_utilization() -> None:
    result = formulas.calculate_fleet(
        formulas.FleetInputs(
            peak_trips_per_hour=_decimal("20"),
            effective_trips_per_robot_hour=_decimal("10"),
            fleet_reserve_share=_decimal("0.1"),
            robots_per_charger=_decimal("2"),
            average_operations_per_hour=_decimal("10"),
            trips_per_operation=_decimal("2"),
            nominal_cycles_per_hour=_decimal("20"),
            charger_power_kw=_decimal("2.5"),
        )
    )

    assert result.robot_count == _decimal("3")
    assert result.charger_count == _decimal("2")
    assert result.peak_capacity_per_hour == _decimal("30")
    assert result.average_utilization == _decimal("1") / _decimal("3")
    assert result.required_charging_power_kw == _decimal("5.0")


def test_capex_and_opex_cover_purchase_and_raas() -> None:
    purchase_capex = formulas.calculate_capex(
        formulas.CapexInputs(
            robot_count=_decimal("2"),
            charger_count=_decimal("1"),
            catalog_price=_decimal("10000"),
            price_factor=_decimal("1"),
            is_purchase=_decimal("1"),
            charger_installed_price=_decimal("1000"),
            site_preparation_share=_decimal("0.05"),
            fms_upfront_share=_decimal("0.1"),
            integration_cost=_decimal("1000"),
            delivery_share=_decimal("0.05"),
            commissioning_share=_decimal("0.1"),
            raas_setup_share=_decimal("0.1"),
            training_cost=_decimal("500"),
            contingency_share=_decimal("0.1"),
        )
    )
    raas_capex = formulas.calculate_capex(
        formulas.CapexInputs(
            robot_count=_decimal("2"),
            charger_count=_decimal("1"),
            catalog_price=_decimal("10000"),
            price_factor=_decimal("1"),
            is_purchase=_decimal("0"),
            charger_installed_price=_decimal("1000"),
            site_preparation_share=_decimal("0.05"),
            fms_upfront_share=_decimal("0.1"),
            integration_cost=_decimal("1000"),
            delivery_share=_decimal("0.05"),
            commissioning_share=_decimal("0.1"),
            raas_setup_share=_decimal("0.1"),
            training_cost=_decimal("500"),
            contingency_share=_decimal("0.1"),
        )
    )
    purchase_opex = formulas.calculate_opex(
        formulas.OpexInputs(
            is_purchase=_decimal("1"),
            robot_count=_decimal("2"),
            adjusted_price=_decimal("10000"),
            equipment_capex=purchase_capex.equipment,
            total_capex=purchase_capex.total,
            average_power_kw=_decimal("1"),
            operating_hours_per_day=_decimal("10"),
            electricity_price=_decimal("0.2"),
            annual_connectivity_cost=_decimal("100"),
            consumables_per_robot=_decimal("50"),
            fleet_operators_per_shift=_decimal("0"),
            shifts_per_day=_decimal("1"),
            staff_time_loss_share=_decimal("0"),
            fleet_operator_monthly_salary=_decimal("1000"),
            payroll_multiplier=_decimal("1"),
            labor_factor=_decimal("1"),
            remaining_annual_payroll=_decimal("0"),
            loan_share=_decimal("0"),
            loan_interest_rate=_decimal("0"),
            loan_term_years=_decimal("5"),
            monthly_raas_share=_decimal("0.02"),
            annual_service_share=_decimal("0.05"),
            annual_license_share=_decimal("0.02"),
            annual_repair_share=_decimal("0.03"),
        )
    )
    raas_opex = formulas.calculate_opex(
        formulas.OpexInputs(
            is_purchase=_decimal("0"),
            robot_count=_decimal("2"),
            adjusted_price=_decimal("10000"),
            equipment_capex=raas_capex.equipment,
            total_capex=raas_capex.total,
            average_power_kw=_decimal("1"),
            operating_hours_per_day=_decimal("10"),
            electricity_price=_decimal("0.2"),
            annual_connectivity_cost=_decimal("100"),
            consumables_per_robot=_decimal("50"),
            fleet_operators_per_shift=_decimal("0"),
            shifts_per_day=_decimal("1"),
            staff_time_loss_share=_decimal("0"),
            fleet_operator_monthly_salary=_decimal("1000"),
            payroll_multiplier=_decimal("1"),
            labor_factor=_decimal("1"),
            remaining_annual_payroll=_decimal("0"),
            loan_share=_decimal("0"),
            loan_interest_rate=_decimal("0"),
            loan_term_years=_decimal("5"),
            monthly_raas_share=_decimal("0.02"),
            annual_service_share=_decimal("0.05"),
            annual_license_share=_decimal("0.02"),
            annual_repair_share=_decimal("0.03"),
        )
    )

    assert purchase_capex.equipment == _decimal("20000")
    assert purchase_capex.charging == _decimal("1000")
    assert purchase_capex.total == _decimal("31350.000")
    assert raas_capex.equipment == _decimal("0")
    assert raas_capex.charging == _decimal("0")
    assert raas_capex.commissioning == _decimal("2000.0")
    assert raas_capex.total == _decimal("4950.000")
    assert purchase_opex.raas == _decimal("0")
    assert purchase_opex.connectivity == _decimal("100")
    assert purchase_opex.consumables == _decimal("100")
    assert raas_opex.raas == _decimal("4800.00")
    assert raas_opex.service == _decimal("0")
    assert raas_opex.energy == _decimal("1460.0")


def test_capex_components_can_be_calculated_independently() -> None:
    adjusted_price = formulas.calculate_adjusted_robot_price(
        _decimal("10000"), _decimal("1.1")
    )

    assert adjusted_price == _decimal("11000.0")
    assert formulas.calculate_equipment_capex(
        _decimal("2"), adjusted_price, _decimal("1")
    ) == _decimal("22000.0")
    assert formulas.calculate_charging_capex(
        _decimal("1"), _decimal("1000"), _decimal("1")
    ) == _decimal("1000")
    assert formulas.calculate_commissioning_capex(
        _decimal("2"),
        adjusted_price,
        _decimal("0"),
        _decimal("0"),
        _decimal("0"),
        _decimal("0.1"),
    ) == _decimal("2200.00")


def test_annual_effects_and_returns_use_stage_values() -> None:
    effects = formulas.calculate_effects(
        formulas.EffectsInputs(
            baseline_opex=_decimal("120000"),
            process_opex=_decimal("90000"),
            released_fte=_decimal("5"),
            annual_staff_turnover=_decimal("0.1"),
            recruitment_months_salary=_decimal("1"),
            target_monthly_salary=_decimal("1000"),
            labor_factor=_decimal("1"),
            annual_other_benefits=_decimal("1000"),
            total_capex=_decimal("30000"),
            equipment_life_years=_decimal("10"),
            is_purchase=_decimal("1"),
        )
    )
    returns = formulas.calculate_returns(
        formulas.ReturnsInputs(
            total_capex=_decimal("30000"),
            net_annual_benefit=effects.net_annual_benefit,
            horizon_years=_decimal("5"),
            is_purchase=_decimal("1"),
            battery_life_years=_decimal("4"),
            equipment_capex=_decimal("20000"),
            battery_replacement_share=_decimal("0.1"),
            annual_solution_opex=_decimal("20000"),
            baseline_annual_opex=_decimal("120000"),
            annual_process_opex=_decimal("90000"),
            budget=_decimal("25000"),
        )
    )

    assert effects.recruitment_saving == _decimal("500.0")
    assert effects.net_annual_benefit == _decimal("31500.0")
    assert effects.depreciation == _decimal("3000")
    assert returns.simple_payback_years == _decimal("30000") / _decimal("31500")
    assert returns.battery_replacement_events == _decimal("1")
    assert returns.fleet_battery_replacement_cost == _decimal("2000.0")
    assert returns.within_budget is False
    assert returns.budget_overage == _decimal("5000")
    assert returns.budget_overage_share == _decimal("0.2")
