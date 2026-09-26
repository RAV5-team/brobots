"""Сценарий «предпросмотр потребности»: без имитации и без хранилища."""

from __future__ import annotations

import conftest
import pytest

from application import preview
from simcore import inputs


def test_preview_returns_hourly_demand_and_peaks():
    body = dict(conftest.request_body(), scenario=conftest.scenario())

    out = preview.preview_demand(body)

    assert list(out) == [
        "hours",
        "rate_in",
        "rate_out",
        "peak_in",
        "peak_out",
        "calc_peak_trips_h",
        "scenario_peak_trips_h",
        "warnings",
    ]
    assert len(out["hours"]) == len(out["rate_in"]) == len(out["peak_out"])
    assert out["calc_peak_trips_h"] == conftest.CALC["peak_trips_h"]
    assert out["scenario_peak_trips_h"] == max(
        i + o for i, o in zip(out["rate_in"], out["rate_out"])
    )


def test_preview_without_scenario_uses_defaults():
    out = preview.preview_demand(conftest.request_body())

    assert out["hours"]


def test_preview_reports_field_errors():
    body = conftest.request_body()
    del body["configuration"]["calc"]["route_len_m"]

    with pytest.raises(inputs.RequestError) as e:
        preview.preview_demand(dict(body, scenario=conftest.scenario()))

    assert "configuration.calc.route_len_m" in {
        x["field"] for x in e.value.errors
    }
