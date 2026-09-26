"""Расчёт сценариев в дочерних процессах: итоги, сбои, прерывание.

Базы здесь нет: адаптер процессов о ней не знает.
"""

from __future__ import annotations

import gzip
import json
import time

import conftest
import crash_target
import pytest

from adapters.processes import runner
from application import errors
from application import models
from simcore import inputs


def _tasks(*scenarios: dict) -> list[models.ScenarioTask]:
    return [
        models.ScenarioTask(simulation_id=f"{i + 1:032x}", scenario=s)
        for i, s in enumerate(scenarios)
    ]


def _collecting_tick(sink: list):
    def tick(lines) -> bool:
        sink.extend(lines)
        return True

    return tick


def test_scenarios_are_computed_in_order_with_their_ids():
    first = dict(conftest.scenario(), name="Первый")
    second = dict(conftest.scenario(), name="Второй")
    lines: list[str] = []

    outcome = runner.ProcessScenarioRunner().run(
        conftest.request_body(),
        _tasks(first, second),
        2,
        _collecting_tick(lines),
    )

    runs = [o.run for o in outcome.outputs]
    assert [r["scenario"]["name"] for r in runs] == ["Первый", "Второй"]
    assert [r["simulation_id"] for r in runs] == [f"{1:032x}", f"{2:032x}"]
    traces = json.loads(gzip.decompress(outcome.outputs[0].traces.gzip_json))
    assert traces[0]["name"].startswith("Из подбора")
    assert lines or outcome.trailing_lines


def test_invalid_input_raises_request_error():
    request = conftest.request_body()
    request["task"]["shifts"] = 9

    with pytest.raises(inputs.RequestError) as e:
        runner.ProcessScenarioRunner().run(
            request, _tasks(conftest.scenario()), 1, lambda _: True
        )

    assert any(x["field"] == "task.shifts" for x in e.value.errors)


def test_exception_in_child_becomes_scenario_failure_with_detail():
    with pytest.raises(errors.ScenarioFailedError) as e:
        runner.ProcessScenarioRunner(crash_target.explode).run(
            {}, _tasks({}), 1, lambda _: True
        )

    assert "расчёт упал" in str(e.value)
    assert "RuntimeError" in e.value.detail


def test_child_dying_without_result_is_reported_with_exit_code():
    with pytest.raises(errors.ScenarioFailedError) as e:
        runner.ProcessScenarioRunner(crash_target.die).run(
            {}, _tasks({}), 1, lambda _: True
        )

    assert "аварийно" in str(e.value)
    assert "код 3" in str(e.value)
    assert e.value.detail is None


def test_tick_returning_false_stops_the_children_quickly():
    seen: list[str] = []

    def tick(lines) -> bool:
        seen.extend(lines)
        return not seen

    started = time.monotonic()
    outcome = runner.ProcessScenarioRunner(crash_target.slow).run(
        {}, _tasks({}), 1, tick
    )

    assert outcome is None
    assert seen == ["медленный расчёт начат"]
    assert time.monotonic() - started < 30
