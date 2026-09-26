"""Предлагаемые поправки к входам следующего шага (adjusted_input_set).

Состав парка заменяет результат формулы подбора (override). Измеренные
коэффициенты — калибровка расчёта (calibration): по умолчанию не выбраны.
"""

from __future__ import annotations

import dataclasses

from simcore import models


@dataclasses.dataclass(frozen=True)
class _Kind:
    """Описание поправки для интерфейса."""

    code: str
    label: str
    unit: str
    note: str
    fleet: bool = False


_KINDS = (
    _Kind(
        "robot_count",
        "Роботов",
        "шт.",
        "Фиксированное значение: заменяет результат формулы подбора.",
        fleet=True,
    ),
    _Kind(
        "charger_count",
        "Зарядных станций",
        "шт.",
        "Фиксированное значение.",
        fleet=True,
    ),
    _Kind(
        "n_kv",
        "Эксплуатационная скорость к максимальной (норматив 7)",
        "коэф.",
        "Фактическая средняя скорость в движении с учётом поворотов, помех и "
        "ожидания проездов.",
    ),
    _Kind(
        "n_util",
        "Коэффициент загрузки робота (норматив 4)",
        "коэф.",
        "Доля полезной работы во времени, когда робот не простаивает без "
        "заявок и не в ремонте.",
    ),
    _Kind(
        "n_avail",
        "Коэффициент технической готовности (норматив 5)",
        "коэф.",
        "1 − доля времени в ремонте.",
    ),
    _Kind("route_len_m", "Длина рейса в одну сторону", "м", ""),
    _Kind("cycle_s", "Время цикла", "с", "Полезное время на один рейс."),
    _Kind(
        "eff_prod",
        "Эффективная производительность робота",
        "рейс/ч",
        "Циклов в час × загрузка × готовность.",
    ),
)


def _values(
    calc: models.CalcTrace, k: dict, fleet: tuple[int, int, int, int]
) -> dict[str, tuple[float | None, float | None]]:
    """Значения «подбор → симуляция» для каждой поправки."""
    n0, c0, n1, c1 = fleet
    cycle_meas = k.get("cycles_h_measured")
    return {
        "robot_count": (n0, n1),
        "charger_count": (c0, c1),
        "n_kv": (calc.n_kv, k["kv_measured"]),
        "n_util": (calc.n_util, k["util_measured"]),
        "n_avail": (calc.n_avail, k["avail_measured"]),
        "route_len_m": (
            calc.route_len_m,
            (k["route_len_loaded_m"] + k["route_len_empty_m"]) / 2,
        ),
        "cycle_s": (
            3600.0 / calc.cycles_h if calc.cycles_h else None,
            3600.0 / cycle_meas if cycle_meas else None,
        ),
        "eff_prod": (calc.eff_prod, k["eff_prod_measured"]),
    }


def _item(kind: _Kind, base, simulated, note: str, tol: float) -> dict:
    """Поправка с относительным отклонением и признаком значимости."""
    delta = (
        (simulated - base) / base if (base and simulated is not None) else None
    )
    changed_fleet = kind.fleet and simulated != base
    return {
        "code": kind.code,
        "group": "fleet" if kind.fleet else "coefficient",
        "label": kind.label,
        "base": base,
        "simulated": simulated,
        "unit": kind.unit,
        "apply": "override" if kind.fleet else "calibration",
        "note": note,
        "delta_rel": delta,
        "significant": changed_fleet
        or (delta is not None and abs(delta) > tol),
        "source": "simulation",
        "default_selected": changed_fleet,
    }


def proposed(
    calc: models.CalcTrace,
    kpis: dict,
    fleet: tuple[int, int, int, int],
    tol: float,
) -> list[dict]:
    """Собирает предлагаемые поправки.

    Args:
        calc: След расчёта подбора — значения «было».
        kpis: KPI прогона рекомендуемого состава — значения «стало».
        fleet: (роботов было, станций было, роботов стало, станций стало).
        tol: Допуск: отклонение коэффициента больше него значимо.

    Returns:
        Поправки в порядке показа.
    """
    values = _values(calc, kpis, fleet)
    route_note = (
        f"Среднее груженого ({kpis["route_len_loaded_m"]:.0f} м) и порожнего "
        f"({kpis["route_len_empty_m"]:.0f} м) пробега на схеме."
    )
    return [
        _item(
            kind,
            *values[kind.code],
            route_note if kind.code == "route_len_m" else kind.note,
            tol,
        )
        for kind in _KINDS
    ]
