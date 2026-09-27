"""Independent regression checkpoints from the supplied workbook.

The expected outputs are recorded from the source workbook's cached formula
results, not computed by this service. Source: docs/source-materials/economics/
ФЦБАС_Экономическая_модель_v1_1.xlsx, sheet "Склад". Inputs are documented
alongside the extracted reference in docs/reference/economics.
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


def _money(value: str) -> Money:
    return Money(Decimal(value))


def _source_money(value: str) -> Money:
    return Money(Decimal(value), currency="RUB", scale=6)


@pytest.mark.parametrize(
    (
        "acquisition",
        "price",
        "speed",
        "loading",
        "unloading",
        "power",
        "expected",
    ),
    (
        (
            AcquisitionModel.PURCHASE,
            "2700000",
            "1.5",
            "30",
            "30",
            "1",
            {
                "candidate.demand.peak_trips_per_hour": Decimal(
                    "129.54545454545455"
                ),
                "candidate.productivity.cycle_seconds": Decimal(
                    "193.33333333333333"
                ),
                "candidate.fleet.robot_count": Decimal("11"),
                "candidate.fleet.charger_count": Decimal("6"),
                "candidate.capex.total": Decimal("47151150"),
                "candidate.opex.annual_solution_opex": Decimal("8315052"),
                "candidate.effects.net_annual_benefit": Decimal("10533348"),
                "candidate.returns.simple_payback_years": Decimal(
                    "4.477594307555934"
                ),
                "candidate.returns.workbook_roi": Decimal("1.1169888379312402"),
                "candidate.returns.solution_tco": Decimal("88726350"),
            },
        ),
        (
            AcquisitionModel.RAAS,
            "4300000",
            "1.5",
            "60",
            "60",
            "3",
            {
                "candidate.demand.peak_trips_per_hour": Decimal(
                    "129.54545454545455"
                ),
                "candidate.productivity.cycle_seconds": Decimal(
                    "253.33333333333333"
                ),
                "candidate.fleet.robot_count": Decimal("14"),
                "candidate.fleet.charger_count": Decimal("8"),
                "candidate.capex.total": Decimal("21628650"),
                "candidate.opex.annual_solution_opex": Decimal("24171660"),
                "candidate.effects.net_annual_benefit": Decimal("3057940"),
                "candidate.returns.simple_payback_years": Decimal(
                    "7.070185867229674"
                ),
                "candidate.returns.workbook_roi": Decimal("0.7078320603878956"),
                "candidate.returns.solution_tco": Decimal("141224850"),
            },
        ),
    ),
)
def test_warehouse_workbook_golden(
    acquisition: AcquisitionModel,
    price: str,
    speed: str,
    loading: str,
    unloading: str,
    power: str,
    expected: dict[str, Decimal],
) -> None:
    """Checks purchase and RaaS outputs against independent sheet values."""

    task = replace(
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
        target_fte=Decimal("25"),
        target_annual_payroll=_money("46872000"),
        baseline_annual_payroll=_money("46872000"),
        fleet_operators_per_shift=Decimal("1"),
        shifts_per_day=Decimal("2"),
        staff_time_loss_share=Decimal("0.25"),
        fleet_operator_monthly_salary=_money("120000"),
        target_monthly_salary=_money("120000"),
        annual_staff_turnover=Decimal("0"),
        annual_other_benefits=_money("0"),
        replacement_by_handling=(("forks", Decimal("0.5")),),
        horizon_years=5,
        budget=_money("80000000"),
    )
    candidate = replace(
        _candidate(),
        candidate_id="workbook-warehouse-candidate",
        robot_code=(
            "Ronavi H1500"
            if acquisition is AcquisitionModel.PURCHASE
            else "DMR Carrier P"
        ),
        price=_money(price),
        payload_kg=Decimal("1500"),
        max_speed_mps=Decimal(speed),
        loading_seconds=Decimal(loading),
        unloading_seconds=Decimal(unloading),
        average_power_kw=Decimal(power),
    )
    norms = replace(
        replace(_norms(), source=SOURCE),
        payroll_multiplier=Decimal("1.302"),
        productive_time_share=Decimal("0.8"),
        technical_availability=Decimal("0.9"),
        fleet_reserve_share=Decimal("0.1"),
        operating_speed_factor=Decimal("1"),
        robots_per_charger=Decimal("2"),
        charger_installed_price=_money("1000"),
        charger_power_kw=Decimal("5"),
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
        loan_share=Decimal("0"),
        loan_interest_rate=Decimal("0.2"),
        loan_term_years=Decimal("3"),
        monthly_raas_share=Decimal("0.02"),
        raas_setup_share=Decimal("0.1"),
        recruitment_months_salary=Decimal("1"),
        good_payback_years=Decimal("3"),
        medium_payback_years=Decimal("5"),
        site_preparation_share=Decimal("0.05"),
    )
    request = replace(
        _request(candidate, acquisition),
        task=task,
        norms=norms,
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
        assert isinstance(metric.value, Decimal)
        assert abs(metric.value - expected_value) <= Decimal("0.0000001")
