"""Обоснование числа станций — по строке, где требования ломаются."""

from __future__ import annotations

from simcore import verdict_text

_VOL = "при росте объёма на 20%"


def _row(c: int, ok: bool, on_time_min: float, charge_peak: float) -> dict:
    return {
        "c": c,
        "ok": ok,
        "on_time_min": on_time_min,
        "charge_peak": charge_peak,
    }


def _justify(stations: list[dict], c0: int, c1: int) -> str | None:
    return verdict_text._station_justification(  # pylint: disable=protected-access
        stations, c0, c1, _VOL
    )


def test_reduced_stations_explain_the_failing_row_below():
    rows = [_row(1, False, 0.545, 2.52), _row(2, True, 0.993, 1.41)]

    result = _justify(rows, c0=5, c1=2)

    assert result.startswith("Станции: 2 вместо 5")
    assert "при 1 станции — нет" in result
    assert "54,5 %" in result
    assert "2,52 робота" in result
    assert "₽" not in result


def test_charging_is_not_blamed_when_it_did_not_grow():
    rows = [_row(2, False, 0.842, 0.30), _row(3, True, 0.997, 0.50)]

    result = _justify(rows, c0=5, c1=3)

    assert "84,2 %" in result
    assert "на зарядке" not in result


def test_kept_stations_say_one_less_fails():
    rows = [_row(4, False, 0.80, 1.0), _row(5, True, 0.99, 0.5)]

    result = _justify(rows, c0=5, c1=5)

    assert result.startswith("Станции оставляем 5")
    assert "при 4 станциях" in result


def test_nothing_to_say_when_one_less_also_passes():
    rows = [_row(4, True, 0.99, 0.6), _row(5, True, 0.99, 0.5)]

    assert _justify(rows, c0=5, c1=5) is None
