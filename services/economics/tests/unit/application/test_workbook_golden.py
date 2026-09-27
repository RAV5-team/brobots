"""Independent regression checkpoints from the supplied workbook.

The expected outputs are the workbook's cached formula results, not values
computed by this service. Source: ФЦБАС_Экономическая_модель_v1_1.xlsx, sheet
«Склад», engine columns S (Ronavi H1500 · Покупка · База), E (DMR Carrier P ·
Покупка · База) and L (DMR Carrier P · RaaS · База), rows 104–164. Inputs are
the sheet's named cells Skl_* and the norms of sheet «Нормативы».
"""

from dataclasses import replace
from decimal import Decimal

import pytest

from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.domain.models import (
    AcquisitionModel,
    Money,
    Scenario,
)
from tests.unit.application.test_calculation import (
    SOURCE,
    _candidate,
    _metric,
    _norms,
    _request,
    _task,
)

TOLERANCE = Decimal("0.000001")


def _money(value: str) -> Money:
    return Money(Decimal(value))


def _workbook_task():
    """Named cells Skl_* of sheet «Склад»."""

    return replace(
        _task(),
        operations_per_day=Decimal("2000"),
        peak_factor=Decimal("1.5"),
        automatable_share=Decimal("0.95"),
        operating_hours_per_day=Decimal("22"),
        one_way_route_m=Decimal("100"),
        site_speed_limit_mps=Decimal("1.5"),
        load_unit_mass_kg=Decimal("800"),
        load_is_divisible=False,
        available_charging_power_kw=Decimal("500"),
        target_fte=Decimal("23.75"),
        target_annual_payroll=_money("44528400"),
        baseline_annual_payroll=_money("46872000"),
        fleet_operators_per_shift=Decimal("1"),
        shifts_per_day=Decimal("2"),
        staff_time_loss_share=Decimal("0.25"),
        fleet_operator_monthly_salary=_money("120000"),
        target_monthly_salary=_money("120000"),
        annual_staff_turnover=Decimal("0"),
        annual_other_benefits=_money("0"),
        replacement_by_handling=(
            ("forks", Decimal("0.8")),
            ("platform", Decimal("0.6")),
        ),
        horizon_years=5,
        budget=_money("80000000"),
        integration_cost=_money("2000000"),
        annual_consumables_per_robot=_money("0"),
    )


def _workbook_norms():
    """Sheet «Нормативы», column D."""

    return replace(
        _norms(),
        payroll_multiplier=Decimal("1.302"),
        productive_time_share=Decimal("0.8"),
        technical_availability=Decimal("0.95"),
        fleet_reserve_share=Decimal("0.15"),
        operating_speed_factor=Decimal("0.6"),
        robots_per_charger=Decimal("4"),
        charger_installed_price=_money("250000"),
        charger_power_kw=Decimal("5"),
        fms_upfront_share=Decimal("0.1"),
        delivery_share=Decimal("0.02"),
        commissioning_share=Decimal("0.05"),
        training_cost=_money("300000"),
        capex_contingency_share=Decimal("0.1"),
        annual_service_share=Decimal("0.08"),
        annual_license_share=Decimal("0.03"),
        annual_repair_share=Decimal("0.02"),
        electricity_price=_money("7.5"),
        battery_life_years=Decimal("4"),
        battery_replacement_share=Decimal("0.1"),
        annual_connectivity_cost=_money("60000"),
        equipment_life_years=Decimal("7"),
        discount_rate=Decimal("0.15"),
        loan_share=Decimal("0"),
        loan_interest_rate=Decimal("0.2"),
        loan_term_years=Decimal("3"),
        monthly_raas_share=Decimal("0.03"),
        raas_setup_share=Decimal("0.05"),
        recruitment_months_salary=Decimal("0.5"),
        good_payback_years=Decimal("3"),
        medium_payback_years=Decimal("5"),
        site_preparation_share=Decimal("0.05"),
        source=SOURCE,
    )


@pytest.mark.parametrize(
    ("acquisition", "robot", "expected"),
    (
        pytest.param(
            AcquisitionModel.PURCHASE,
            {
                "robot_code": "RONAVI-H1500",
                "price": "2700000",
                "loading": "30",
                "unloading": "30",
                "power": "1",
                "handling": "platform",
            },
            {
                "candidate.demand.peak_trips_per_hour": "129.545454545455",
                "candidate.productivity.cycle_seconds": "282.222222222222",
                "candidate.fleet.robot_count": "16",
                "candidate.fleet.charger_count": "4",
                "candidate.capex.total": "61604400",
                "candidate.opex.annual_solution_opex": "11326800",
                "candidate.effects.net_annual_benefit": "15390240",
                "candidate.returns.simple_payback_years": "4.00282256806911",
                "candidate.returns.workbook_roi": "1.17899370824162",
                "candidate.returns.solution_tco": "122558400",
            },
            id="column-S-ronavi-h1500-purchase",
        ),
        pytest.param(
            AcquisitionModel.PURCHASE,
            {
                "robot_code": "DMR-CARRIER-P",
                "price": "4300000",
                "loading": "60",
                "unloading": "60",
                "power": "3",
                "handling": "forks",
            },
            {
                "candidate.demand.peak_trips_per_hour": "129.545454545455",
                "candidate.productivity.cycle_seconds": "342.222222222222",
                "candidate.fleet.robot_count": "19",
                "candidate.fleet.charger_count": "5",
                "candidate.capex.total": "113546400",
                "candidate.opex.annual_solution_opex": "18801025",
                "candidate.effects.net_annual_benefit": "16821695",
                "candidate.returns.simple_payback_years": "6.74999754780954",
                "candidate.returns.workbook_roi": "0.668788046120353",
                "candidate.returns.solution_tco": "215721525",
            },
            id="column-E-dmr-carrier-p-purchase",
        ),
        pytest.param(
            AcquisitionModel.RAAS,
            {
                "robot_code": "DMR-CARRIER-P",
                "price": "4300000",
                "loading": "60",
                "unloading": "60",
                "power": "3",
                "handling": "forks",
            },
            {
                "candidate.demand.peak_trips_per_hour": "129.545454545455",
                "candidate.productivity.cycle_seconds": "342.222222222222",
                "candidate.fleet.robot_count": "19",
                "candidate.fleet.charger_count": "5",
                "candidate.capex.total": "11517000",
                "candidate.opex.annual_solution_opex": "37592025",
                "candidate.effects.net_annual_benefit": "-1969305",
                "candidate.returns.simple_payback_years": None,
                "candidate.returns.workbook_roi": "-0.854955717634801",
                "candidate.returns.solution_tco": "199477125",
            },
            id="column-L-dmr-carrier-p-raas",
        ),
    ),
)
def test_warehouse_workbook_golden(
    acquisition: AcquisitionModel,
    robot: dict[str, str],
    expected: dict[str, str | None],
) -> None:
    """Checks purchase and RaaS outputs against the workbook's cached values."""

    candidate = replace(
        _candidate(),
        candidate_id="workbook-warehouse-candidate",
        robot_code=robot["robot_code"],
        price=_money(robot["price"]),
        payload_kg=Decimal("1500"),
        max_speed_mps=Decimal("1.5"),
        loading_seconds=Decimal(robot["loading"]),
        unloading_seconds=Decimal(robot["unloading"]),
        average_power_kw=Decimal(robot["power"]),
        handling_method=robot["handling"],
    )
    request = replace(
        _request(candidate, acquisition),
        task=_workbook_task(),
        norms=_workbook_norms(),
        scenarios=(
            Scenario(
                acquisition_model=acquisition,
                price_factor=Decimal("1"),
                volume_factor=Decimal("1"),
                labor_factor=Decimal("1"),
                model_version="economic-v1.1",
            ),
        ),
    )

    result = EconomicCalculationEngine().calculate(request).candidates[0]

    for code, expected_value in expected.items():
        metric = _metric(result, code)
        if expected_value is None:
            assert metric.value is None, code
            continue
        assert isinstance(metric.value, Decimal), code
        assert abs(metric.value - Decimal(expected_value)) <= TOLERANCE, (
            f"{code}: {metric.value} != {expected_value}"
        )
