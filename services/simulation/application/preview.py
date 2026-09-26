"""Сценарий «предпросмотр потребности»: без имитации и без хранилища."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from simcore import inputs


def preview_demand(body: Mapping[str, Any]) -> dict:
    """Потребность по часам и сверка со следом расчёта.

    Args:
        body: Конфигурация, площадка, задача и один сценарий (scenario).

    Returns:
        Часы, потоки приёмки и отгрузки, маски пиков, пик расчёта и сценария,
        предупреждения о расхождениях.

    Raises:
        inputs.RequestError: Во входе есть ошибки.
    """
    request = {k: v for k, v in body.items() if k != "scenario"}
    scenario = body.get("scenario")
    b = inputs.build(request, scenario if scenario is not None else {})
    sch = b.schedule
    return {
        "hours": [sch.clock(i) for i in range(sch.hours)],
        "rate_in": b.rate_in,
        "rate_out": b.rate_out,
        "peak_in": sch.peak_mask("in"),
        "peak_out": sch.peak_mask("out"),
        "calc_peak_trips_h": b.calc.peak_trips_h,
        "scenario_peak_trips_h": max(
            i + o for i, o in zip(b.rate_in, b.rate_out)
        ),
        "warnings": inputs.consistency_warnings(request, b),
    }
