"""Инварианты продуктового пути: что симуляция берёт, возвращает и не считает.

Тесты описывают контракт шага, а не внутреннее устройство. Экономики в сервисе
нет: денег он не принимает и не возвращает. Медленный прогон один на сессию
(фикстура verified).
"""

from __future__ import annotations

import json

import conftest
import pytest

from adapters.web import demo_input
from simcore import inputs
from simcore import verify


# ----------------------------------------------------------------------------
# Вход: след расчёта приходит из запроса и не пересчитывается
# ----------------------------------------------------------------------------
def test_calc_trace_is_taken_from_request_not_recomputed():
    req = conftest.request_body()
    req["configuration"]["calc"][
        "peak_trips_h"
    ] = 30.0  # заведомо не равно расчёту по объёмам (35.625)
    b = inputs.build(req, conftest.scenario())

    assert b.calc.peak_trips_h == 30.0
    assert b.calc.n_util == conftest.CALC["n_util"]
    assert b.calc.n_kv == conftest.CALC["n_kv"]
    assert b.calc.n_avail == conftest.CALC["n_avail"]
    assert b.calc.n_reserve == conftest.CALC["n_reserve"]
    assert b.calc.route_len_m == conftest.CALC["route_len_m"]
    assert b.calc.cycles_h == pytest.approx(3600.0 / conftest.CALC["cycle_s"])
    assert b.site.peak_trips_h == pytest.approx(
        35.625
    ), "поток по объёмам задачи считается отдельно от следа расчёта"


def test_fleet_size_comes_from_configuration():
    b = inputs.build(conftest.request_body(), conftest.scenario())
    assert (b.calc.n_robots, b.calc.n_chargers) == (6, 2)


def test_missing_required_configuration_field_is_rejected():
    req = conftest.request_body()
    del req["configuration"]["robot_count"]
    with pytest.raises(inputs.RequestError) as e:
        inputs.build(req, conftest.scenario())
    assert any(
        err["field"] == "configuration.robot_count" for err in e.value.errors
    )


def test_unknown_simulation_params_group_is_rejected():
    with pytest.raises(inputs.RequestError) as e:
        inputs.build(
            conftest.request_body(), conftest.scenario(unknown_group={"x": 1})
        )
    assert any(
        "simulation_params.unknown_group" in err["field"]
        for err in e.value.errors
    )


# ----------------------------------------------------------------------------
# Почасовой поток симуляция строит сама, но сверяет со следом расчёта
# ----------------------------------------------------------------------------
def test_hourly_demand_is_built_from_task_volumes():
    b = inputs.build(conftest.request_body(), conftest.scenario())
    assert len(b.rate_in) == b.schedule.hours == 8
    assert sum(b.rate_in) == pytest.approx(100 * 0.95, rel=1e-6)
    assert sum(b.rate_out) == pytest.approx(100 * 0.95, rel=1e-6)


def test_matching_average_flow_gives_no_warning():
    req = conftest.request_body()
    b = inputs.build(req, conftest.scenario())
    assert not [
        w for w in inputs.consistency_warnings(req, b) if "Средний поток" in w
    ]


def test_average_flow_divergence_over_one_percent_warns():
    req = conftest.request_body()
    req["configuration"]["calc"]["avg_trips_h"] = (
        conftest.CALC["avg_trips_h"] * 1.05
    )
    b = inputs.build(req, conftest.scenario())
    assert [
        w for w in inputs.consistency_warnings(req, b) if "Средний поток" in w
    ]


# ----------------------------------------------------------------------------
# Выход: контракт ответа
# ----------------------------------------------------------------------------
def test_response_has_contract_keys(verified):
    for key in (
        "simulation_id",
        "configuration_id",
        "simulation_version",
        "status",
        "verdict",
        "tolerance",
        "checks_before",
        "checks_after",
        "fleet_change",
        "diagnosis",
        "evidence",
        "kpis",
        "kpis_before",
        "hourly_before",
        "hourly_after",
        "demand",
        "adjusted_input_set",
        "warnings",
        "resolved_params",
        "timing",
    ):
        assert key in verified, key
    assert verified["status"] in (
        "confirmed",
        "can_reduce",
        "needs_additions",
        "layout_bottleneck",
        "not_achievable",
    )
    assert set(verified["adjusted_input_set"]) == {"items"}


def _resolved_entries(resolved: dict):
    """resolved_params вложен по группам полей.

    Вид: {группа: {поле: {value, source}}} либо {группа: {value, source}}
    для одиночных полей.
    """
    for group in resolved.values():
        if "source" in group:
            yield group
        else:
            yield from group.values()


def test_resolved_params_report_source_of_every_field(verified):
    entries = list(_resolved_entries(verified["resolved_params"]))
    assert (
        entries
    ), "вход шага должен возвращаться с источником каждого значения"
    assert {e["source"] for e in entries} <= {"user", "task", "default"}
    assert all("value" in e for e in entries)


def test_adjusted_inputs_compare_measured_against_calc_trace(verified):
    items = {i["code"]: i for i in verified["adjusted_input_set"]["items"]}
    assert items["n_kv"]["base"] == conftest.CALC["n_kv"]
    assert items["n_util"]["base"] == conftest.CALC["n_util"]
    assert items["n_avail"]["base"] == conftest.CALC["n_avail"]
    assert items["route_len_m"]["base"] == conftest.CALC["route_len_m"]
    assert items["cycle_s"]["base"] == pytest.approx(
        conftest.CALC["cycle_s"], rel=1e-6
    )
    assert items["eff_prod"]["base"] == conftest.CALC["eff_prod"]
    for code in (
        "n_kv",
        "n_util",
        "n_avail",
        "route_len_m",
        "cycle_s",
        "eff_prod",
    ):
        assert (
            items[code]["simulated"] is not None
        ), f"{code}: измеренное значение обязательно"
        assert items[code]["source"] == "simulation"
    assert items["robot_count"]["apply"] == "override"
    assert items["n_util"]["apply"] == "calibration"


def test_fleet_change_matches_status(verified):
    fc = verified["fleet_change"]
    assert fc["from_"]["robots"] == 6 and fc["from_"]["chargers"] == 2
    assert fc["to"]["robots"] == fc["from_"]["robots"] + fc["robots"]
    assert fc["to"]["chargers"] == fc["from_"]["chargers"] + fc["chargers"]
    if verified["status"] == "confirmed":
        assert (fc["robots"], fc["chargers"]) == (0, 0)


def test_verification_is_deterministic():
    a, _ = verify.run_verification(
        conftest.request_body(),
        conftest.scenario(),
        with_trace=False,
        simulation_id="0" * 32,
    )
    b, _ = verify.run_verification(
        conftest.request_body(),
        conftest.scenario(),
        with_trace=False,
        simulation_id="0" * 32,
    )
    assert a["status"] == b["status"]
    assert a["fleet_change"] == b["fleet_change"]
    assert a["kpis"]["on_time"] == pytest.approx(b["kpis"]["on_time"])


# ----------------------------------------------------------------------------
# Экономики в сервисе нет
# ----------------------------------------------------------------------------
def test_response_carries_no_money(verified):
    assert not conftest.all_keys(verified) & conftest.MONEY_KEYS
    assert "₽" not in json.dumps(verified["verdict"], ensure_ascii=False)


def test_money_fields_are_rejected_as_unknown():
    """Денежных полей в контракте нет: прислать их — ошибка входа."""
    req = conftest.request_body()
    req["economics_basis"] = {"charger_price_rub": 250_000.0}
    req["configuration"]["economics"] = {"capex_total": 40_000_000.0}
    req["configuration"]["robot"]["price_rub"] = 4_300_000.0

    with pytest.raises(inputs.RequestError) as e:
        inputs.build(req, conftest.scenario())

    assert {err["field"] for err in e.value.errors} == {
        "economics_basis",
        "configuration.economics",
        "configuration.robot.price_rub",
    }


def test_demo_input_carries_no_money():
    demo = [
        demo_input.demo_configurations(),
        demo_input.location(),
        demo_input.task(),
    ]

    assert not conftest.all_keys(demo) & conftest.MONEY_KEYS


# ----------------------------------------------------------------------------
# Без тихих подстановок: след расчёта обязателен
# ----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "field",
    [
        "peak_trips_h",
        "route_len_m",
        "eff_prod",
        "n_util",
        "n_kv",
        "n_avail",
        "n_reserve",
    ],
)
def test_missing_calc_field_is_rejected(field):
    req = conftest.request_body()
    del req["configuration"]["calc"][field]
    with pytest.raises(inputs.RequestError) as e:
        inputs.build(req, conftest.scenario())
    assert any(
        err["field"] == f"configuration.calc.{field}" for err in e.value.errors
    )


def test_cycle_time_is_required_in_either_form():
    req = conftest.request_body()
    del req["configuration"]["calc"]["cycle_s"]
    with pytest.raises(inputs.RequestError):
        inputs.build(req, conftest.scenario())

    req["configuration"]["calc"]["cycles_h"] = 3600.0 / conftest.CALC["cycle_s"]
    b = inputs.build(req, conftest.scenario())
    assert b.calc.cycles_h == pytest.approx(3600.0 / conftest.CALC["cycle_s"])


def test_missing_avg_trips_falls_back_to_task_flow():
    req = conftest.request_body()
    del req["configuration"]["calc"]["avg_trips_h"]
    b = inputs.build(req, conftest.scenario())
    assert b.calc.avg_trips_h == pytest.approx(
        b.site.avg_trips_h
    ), "поток по задаче — не подстановка норматива"


# ----------------------------------------------------------------------------
# Формулы подбора не возвращаются в продуктовый путь
# ----------------------------------------------------------------------------
def test_kpis_carry_no_sizing_formula_result(verified):
    """Пересчёт числа роботов по формуле — работа шага «Подбор».

    Измерительный слой такие формулы не применяет.
    """
    assert "n_robots_by_measured" not in verified["kpis"]
    assert "econ" not in verified["kpis"]


def test_task_values_are_validated_like_scenario_values():
    req = conftest.request_body()
    req["task"]["shifts"] = 9

    with pytest.raises(inputs.RequestError) as e:
        inputs.build(req, conftest.scenario())

    assert any(err["field"] == "task.shifts" for err in e.value.errors)


def test_scenario_fields_outside_simulation_params_are_rejected():
    req = conftest.request_body()
    flat = {"name": "Плоский", "growth": 0.5}

    with pytest.raises(inputs.RequestError) as e:
        inputs.build(req, flat)

    assert e.value.errors[0]["field"] == "scenario.growth"
