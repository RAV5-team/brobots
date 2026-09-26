"""KPI прогона: симуляция измеряет то, что расчёт подбора предполагает.

Соответствие допущений расчёта подбора измеряемым величинам:
  N_util → util_measured: продуктивное время / (всё − простой без задач −
    отказы).
  N_avail → avail_measured: (всё − отказы) / всё.
  N_kv → kv_measured: средняя скорость в движении / min(v_max, лимит).
  cycles_h → cycles_h_measured: рейсов / продуктивных часов парка.
  Skl_L → route_len_measured: средняя длина пробега с грузом.
  N_charger_ratio → robots_per_charger_eff: роботов на станцию при измеренной
    загрузке станций.
"""

from __future__ import annotations

import math
import statistics

from simcore import demand
from simcore import engine
from simcore import models

_NAN = float("nan")
# Станция «выдерживает» столько роботов, сколько даёт её загрузка до этого
# уровня.
_CHARGER_UTIL_CAP = 0.7
_TOP_BOTTLENECKS = 5


def _pct(vals: list[float], p: float) -> float:
    """Возвращает p-й перцентиль (0…1) по ближайшему рангу; NaN, если пусто."""
    if not vals:
        return _NAN
    s = sorted(vals)
    k = max(0, min(len(s) - 1, int(math.ceil(p * len(s))) - 1))
    return s[k]


def _in_windows(t: float, wins: list[tuple[float, float]]) -> bool:
    return any(w0 <= t < w1 for w0, w1 in wins)


def _wait_kpis(done: list, tasks: list, sla_wait_min: float) -> dict:
    """Ожидание паллет и доля выполненных заявок."""
    waits = [t.wait_s / 60.0 for t in done]
    if not waits:
        return {
            "completion_share": len(done) / len(tasks) if tasks else _NAN,
            "wait_mean_min": _NAN,
            "wait_p95_min": _NAN,
            "sla_share": _NAN,
        }
    return {
        "completion_share": len(done) / len(tasks),
        "wait_mean_min": statistics.fmean(waits),
        "wait_p95_min": _pct(waits, 0.95),
        "sla_share": sum(1 for w in waits if w <= sla_wait_min) / len(waits),
    }


def _peak_kpis(res: engine.RunResult, tasks: list, done: list) -> dict:
    """Пропускная способность и занятость парка в пиковые окна.

    Первое окно частично попадает в разогрев — берутся все окна.
    """
    wins = demand.peak_windows(res.profile)
    peak_hours = sum((w1 - w0) for w0, w1 in wins) / 3600.0
    done_in_peak = sum(1 for t in done if _in_windows(t.t_done, wins))
    created_in_peak = sum(1 for t in tasks if _in_windows(t.t_created, wins))
    thr_peak = done_in_peak / peak_hours if peak_hours else _NAN
    created_rate = created_in_peak / peak_hours if peak_hours else _NAN
    peak_pts = [s for s in res.series if _in_windows(s["t"], wins)]
    busy_peak = (
        statistics.fmean(
            (res.n_robots - s["s_idle"]) / res.n_robots for s in peak_pts
        )
        if peak_pts
        else _NAN
    )
    return {
        "throughput_peak_trips_h": thr_peak,
        "throughput_ratio": thr_peak / created_rate if created_rate else _NAN,
        "headroom_peak": 1.0 - busy_peak,
    }


def _fleet_kpis(res: engine.RunResult) -> dict:
    """Время парка по состояниям и измеренные коэффициенты подбора."""
    fleet: dict[str, float] = {s: 0.0 for s in engine.STATES}
    for r in res.robots:
        for s, v in r["buckets"].items():
            fleet[s] = fleet.get(s, 0.0) + v
    total = sum(fleet.values()) or 1.0
    shares = {s: fleet[s] / total for s in engine.STATES}
    productive = sum(fleet[s] for s in engine.PRODUCTIVE_STATES)
    loss_base = total - fleet["idle"] - fleet["down"]
    util = productive / loss_base if loss_base > 0 else _NAN
    avail = (total - fleet["down"]) / total
    move_time = fleet["to_pickup"] + fleet["to_drop"] + fleet["to_charger"]
    dist_total = sum(r["dist_loaded"] + r["dist_empty"] for r in res.robots)
    v_actual = dist_total / move_time if move_time > 0 else _NAN
    trips = sum(r["trips"] for r in res.robots)
    cycles_h = trips / (productive / 3600.0) if productive > 0 else _NAN
    return {
        "fleet_shares": shares,
        "blocked_share": shares["blocked"] + shares["queue"],
        "util_measured": util,
        "avail_measured": avail,
        "kv_measured": v_actual / res.v_cap if res.v_cap else _NAN,
        "cycles_h_measured": cycles_h,
        # Пересчёт числа роботов по этой производительности — работа шага
        # «Подбор»: формулы подбора в симуляции нет.
        "eff_prod_measured": cycles_h * util * avail,
        "route_len_loaded_m": (
            sum(r["dist_loaded"] for r in res.robots) / trips if trips else _NAN
        ),
        "route_len_empty_m": (
            sum(r["dist_empty"] for r in res.robots) / trips if trips else _NAN
        ),
        "charger_wait_share": fleet["wait_charger"] / total,
    }


def _charging_kpis(res: engine.RunResult) -> dict:
    """Загрузка станций, сессии зарядки, разряды и отказы."""
    n_ch = max(1, res.n_chargers)
    charger_util = res.charger_busy_total / (n_ch * res.horizon_s)
    return {
        "charger_util": charger_util,
        "charger_queue_max": res.charger_queue_max,
        "charge_sessions": sum(r["charge_sessions"] for r in res.robots),
        "battery_depleted": sum(r["depleted"] for r in res.robots),
        "breakdowns": sum(r["breakdowns"] for r in res.robots),
    }


def _bottlenecks(res: engine.RunResult) -> list[dict]:
    """Рёбра схемы с наибольшим суммарным ожиданием."""
    rows = [
        {
            "u": k[0],
            "v": k[1],
            "wait_h": v["wait"] / 3600.0,
            "n": v["n"],
            "wait_per_pass_s": v["wait"] / v["n"],
            "occupancy": v["busy"] / res.horizon_s,
        }
        for k, v in res.edge_stats.items()
        if v["n"] > 0
    ]
    rows.sort(key=lambda d: d["wait_h"], reverse=True)
    return rows[:_TOP_BOTTLENECKS]


def compute_kpis(
    res: engine.RunResult, site: models.WarehouseSite, a: models.SimAssumptions
) -> dict:
    """Считает KPI одного прогона.

    Args:
        res: Результат прогона.
        site: Склад: из него берётся расчётная потребность.
        a: Допущения: разогрев и норматив ожидания.

    Returns:
        Словарь KPI: ожидание, пик, парк, зарядка, узкие места.
    """
    warm = a.warmup_min * 60.0
    tasks = [t for t in res.tasks if t.t_created >= warm]
    done = [t for t in tasks if t.t_done is not None]
    return {
        "demand_peak_trips_h": site.peak_trips_h * res.demand_k,
        "demand_avg_trips_h": site.avg_trips_h * res.demand_k,
        "top_bottlenecks": _bottlenecks(res),
        **_wait_kpis(done, tasks, a.sla_wait_min),
        **_peak_kpis(res, tasks, done),
        **_fleet_kpis(res),
        **_charging_kpis(res),
    }


def average_kpis(runs: list[dict]) -> dict:
    """Усредняет KPI по дням; NaN в отдельных днях пропускаются.

    Целочисленные счётчики тоже усредняются, поэтому результат может быть
    дробным. Нечисловые KPI берутся из первого дня.
    """
    out = dict(runs[0])
    for k, v in runs[0].items():
        if isinstance(v, (int, float)):
            vals = [
                r[k]
                for r in runs
                if r.get(k) is not None
                and not (isinstance(r[k], float) and math.isnan(r[k]))
            ]
            out[k] = statistics.fmean(vals) if vals else _NAN
    out["fleet_shares"] = {
        s: statistics.fmean(r["fleet_shares"][s] for r in runs)
        for s in engine.STATES
    }
    return out
