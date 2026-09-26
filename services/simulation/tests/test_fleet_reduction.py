"""Правило уменьшения парка: только операционные требования, без цен.

Имитация подменена поддельным оценщиком, поэтому тесты мгновенные: они
проверяют сам поиск минимального состава, а не SimPy-модель.
"""

from __future__ import annotations

from simcore import verify

_C0 = 5
_N0 = 10
_K_GROWTH = 1.2
_TOL = 0.1


class _FakeEvaluator:
    """Оценщик без имитации и без атрибута b: цен в нём нет по построению."""

    def eval(self, n: int, c: int, k: float = 1.0, seeds=None) -> dict:
        """Возвращает поддельный прогон состава (n, c).

        Имя повторяет evaluate.CaseEvaluator.eval; это не встроенный eval.
        """
        del k, seeds  # поддельному прогону объём и дни не важны
        # Чем меньше станций, тем больше роботов стоит на зарядке в пик.
        # Ценовое правило остановило бы на этом снятие станций.
        return {
            "n": n,
            "c": c,
            "util_peak": 0.5,
            "charge_peak": 10.0 * (_C0 - c),
        }


def _require(monkeypatch, min_robots: int, min_chargers: int) -> None:
    """Подменяет check: прогон проходит, если состав не меньше требования."""

    def fake_check(ev, r: dict, tol: float) -> dict:
        del ev, tol
        return {"ok": r["n"] >= min_robots and r["c"] >= min_chargers}

    monkeypatch.setattr(verify, "check", fake_check)


def test_reduction_returns_minimal_passing_fleet(monkeypatch):
    _require(monkeypatch, min_robots=4, min_chargers=2)

    result = verify.find_reduction(_FakeEvaluator(), _N0, _C0, _K_GROWTH, _TOL)

    assert result == (4, 2)


def test_charger_reduction_does_not_depend_on_prices(monkeypatch):
    _require(monkeypatch, min_robots=4, min_chargers=2)
    ev = _FakeEvaluator()

    result = verify.find_reduction(ev, _N0, _C0, _K_GROWTH, _TOL)

    assert not hasattr(ev, "b")
    assert result is not None
    assert result[1] == 2


def test_charger_kept_when_one_less_fails(monkeypatch):
    _require(monkeypatch, min_robots=4, min_chargers=_C0)

    result = verify.find_reduction(_FakeEvaluator(), _N0, _C0, _K_GROWTH, _TOL)

    assert result == (4, _C0)


def test_charger_reduction_stops_at_one_station(monkeypatch):
    _require(monkeypatch, min_robots=4, min_chargers=0)

    result = verify.find_reduction(_FakeEvaluator(), _N0, _C0, _K_GROWTH, _TOL)

    assert result == (4, 1)


def test_reduction_is_none_when_original_fleet_fails(monkeypatch):
    _require(monkeypatch, min_robots=_N0 + 1, min_chargers=1)

    result = verify.find_reduction(_FakeEvaluator(), _N0, _C0, _K_GROWTH, _TOL)

    assert result is None


def test_min_passing_walks_up_when_start_fails():
    result = verify._min_passing(  # pylint: disable=protected-access
        lambda v: v >= 7, start=3, lo=1, hi=10
    )

    assert result == 7


def test_min_passing_returns_hi_when_nothing_passes():
    result = verify._min_passing(  # pylint: disable=protected-access
        lambda v: False, start=3, lo=1, hi=10
    )

    assert result == 10


def test_min_passing_stops_at_lo_when_everything_passes():
    result = verify._min_passing(  # pylint: disable=protected-access
        lambda v: True, start=8, lo=3, hi=10
    )

    assert result == 3
