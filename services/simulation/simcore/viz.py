"""Визуализация прогона для фронтенда.

export_trace() — трасса для 2D-плеера экрана шага: планировка (узлы и рёбра),
кадры с позициями и состояниями роботов, временные ряды KPI, профиль спроса,
сводка. Формат: JSON, координаты в метрах.
"""

from __future__ import annotations

import collections

from simcore import engine

STATE_COLORS = {
    "idle": "#9aa0a6",
    "to_pickup": "#4f8ef7",
    "loading": "#1f6feb",
    "to_drop": "#0b8a3a",
    "unloading": "#0b8a3a",
    "blocked": "#e0a800",
    "queue": "#e0a800",
    "to_charger": "#a259ff",
    "wait_charger": "#ff7f0e",
    "charging": "#a259ff",
    "down": "#d62728",
    "towed": "#d62728",
}
STATE_RU = {
    "idle": "свободен",
    "to_pickup": "порожний пробег",
    "loading": "погрузка",
    "to_drop": "с грузом",
    "unloading": "разгрузка",
    "blocked": "ждёт проезд",
    "queue": "очередь у дока/ячейки",
    "to_charger": "едет на зарядку",
    "wait_charger": "ждёт станцию",
    "charging": "заряжается",
    "down": "отказ",
    "towed": "эвакуация",
}

DEFAULT_STEP_S = 15.0


_Seg = tuple[float, float, str, str, str]  # (начало, конец, u, v, состояние)
_CHARGE_STATES = ("charging", "wait_charger")


def _segments(
    trace: list[tuple], t0: float, t1: float
) -> dict[int, list[_Seg]]:
    """Участки движения каждого робота, пересекающие окно [t0, t1]."""
    segs: dict[int, list[_Seg]] = collections.defaultdict(list)
    for rid, s0, s1, u, v, st in trace:
        if s1 < t0 or s0 > t1:
            continue
        segs[rid].append((s0, s1, u, v, st))
    for rid in segs:
        segs[rid].sort()
    return segs


def _position(
    moves: list[_Seg], p: int, t: float, xy: dict, charger_node: str
) -> tuple[float, float, str]:
    """Координаты и состояние робота в момент t по его участкам.

    Args:
        moves: Участки робота по времени.
        p: Индекс первого участка, который ещё не закончился к t.
        t: Момент кадра, с.
        xy: Координаты узлов схемы.
        charger_node: Узел зарядной зоны — стоянка робота без участков.

    Returns:
        (x, y, состояние).
    """
    if p >= len(moves):
        _, _, _, v, st = (
            moves[-1] if moves else (0, 0, "", charger_node, "idle")
        )
        return (*xy[v], st)
    s0, s1, u, v, st = moves[p]
    if s0 > t:  # участок ещё не начался — робот стоит в u
        return (*xy[u], "idle" if p == 0 else moves[p - 1][4])
    if u == v:
        return (*xy[u], st)
    f = (t - s0) / max(s1 - s0, 1e-9)
    (x0, y0), (x1, y1) = xy[u], xy[v]
    return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, st


class _ChargerSlots:
    """Раскладка роботов по слотам зарядки — по порядку прибытия (визуально)."""

    def __init__(self, slots: list, charger_xy: tuple[float, float]):
        self._slots = slots
        self._charger_xy = charger_xy
        self._slot_of: dict[int, int] = {}

    def place(
        self, rid: int, st: str, xy: tuple[float, float], busy: set[int]
    ) -> tuple[float, float]:
        """Возвращает координаты робота с учётом слота зарядки.

        Args:
            rid: Номер робота.
            st: Состояние робота.
            xy: Координаты по схеме.
            busy: Слоты, занятые в этом кадре; дополняется.

        Returns:
            Координаты для кадра.
        """
        if st not in _CHARGE_STATES or not self._slots:
            self._slot_of.pop(rid, None)
            return xy
        if rid not in self._slot_of:
            taken = busy | set(self._slot_of.values())
            free = [i for i in range(len(self._slots)) if i not in taken]
            self._slot_of[rid] = free[0] if free else -1
        si = self._slot_of[rid]
        if si >= 0 and st == "charging":
            busy.add(si)
            return self._slots[si]
        cx, cy = self._charger_xy
        return cx + 2 + (1.5 * rid) % 6, cy + 4


def _summary(kpis: dict) -> dict:
    """Сводка KPI для панели плеера."""
    keys = (
        "sla_share",
        "wait_p95_min",
        "completion_share",
        "headroom_peak",
        "util_measured",
        "kv_measured",
        "avail_measured",
        "charger_util",
        "charger_wait_share",
        "battery_depleted",
        "breakdowns",
    )
    return {k: kpis[k] for k in keys}


def _series_frame(series: list[dict], i: int, t: float) -> tuple[int, dict]:
    """Сдвигает указатель ряда KPI к моменту t и возвращает его точку."""
    while i + 1 < len(series) and series[i + 1]["t"] <= t:
        i += 1
    return i, (series[i] if series else {})


def _frames(
    res: engine.RunResult,
    lay: dict,
    segs: dict[int, list[_Seg]],
    xy: dict,
    window: tuple[float, float, float],
) -> list[dict]:
    """Кадры плеера: позиции и состояния роботов, ряды KPI.

    Args:
        res: Результат прогона.
        lay: Схема склада из трассы прогона.
        segs: Участки движения роботов (см. _segments).
        xy: Координаты узлов схемы.
        window: (начало, конец, шаг) окна кадров, с.

    Returns:
        Кадры по времени.
    """
    t, t1, step = window
    state_idx = {s: i for i, s in enumerate(engine.STATES)}
    ptr = [0] * res.n_robots
    slots = _ChargerSlots(lay["charger_slots"], xy[lay["charger_node"]])
    frames, series_i = [], 0
    while t <= t1:
        pos: list[list] = []
        busy: set[int] = set()
        for rid in range(res.n_robots):
            moves = segs.get(rid, [])
            while ptr[rid] < len(moves) and moves[ptr[rid]][1] < t:
                ptr[rid] += 1
            x, y, st = _position(moves, ptr[rid], t, xy, lay["charger_node"])
            x, y = slots.place(rid, st, (x, y), busy)
            pos.append([round(x, 1), round(y, 1), state_idx[st]])
        series_i, sr = _series_frame(res.series, series_i, t)
        frames.append(
            {
                "t": round(t),
                "r": pos,
                "done": sr.get("done", 0),
                "backlog": sr.get("backlog", 0),
                "ch": sr.get("chargers_busy", 0),
                "chq": sr.get("charger_queue", 0),
                "soc": round(sr.get("soc_mean", 1.0), 3),
            }
        )
        t += step
    return frames


def export_trace(
    res: engine.RunResult,
    kpis: dict,
    name: str,
    step_s: float | None = None,
    t_from_h: float = 0.0,
    t_to_h: float | None = None,
) -> dict:
    """Собирает трассу прогона для 2D-плеера.

    Args:
        res: Результат прогона, снятый с трассировкой.
        kpis: Показатели прогона из metrics.compute_kpis.
        name: Подпись сценария в плеере.
        step_s: Шаг кадров, с; по умолчанию DEFAULT_STEP_S.
        t_from_h: Начало окна трассы, ч.
        t_to_h: Конец окна трассы, ч; по умолчанию весь горизонт.

    Returns:
        Словарь трассы: планировка, кадры, ряды KPI и сводка.

    Raises:
        ValueError: Прогон снят без трассировки.
    """
    if res.trace is None or res.layout_json is None:
        raise ValueError(
            "нет трассы прогона: запустите Simulation(..., trace=True)"
        )
    lay = res.layout_json
    xy = {n["id"]: (n["x"], n["y"]) for n in lay["nodes"]}
    step = step_s or DEFAULT_STEP_S
    t0 = t_from_h * 3600.0
    t1 = (t_to_h * 3600.0) if t_to_h else res.horizon_s
    segs = _segments(res.trace, t0, t1)
    frames = _frames(res, lay, segs, xy, (t0, t1, step))
    return {
        "name": name,
        "step_s": step,
        "n_robots": res.n_robots,
        "n_chargers": res.n_chargers,
        "profile": res.profile,
        "states": engine.STATES,
        "state_ru": STATE_RU,
        "state_colors": STATE_COLORS,
        "layout": lay,
        "frames": frames,
        "created_times": sorted(round(tt.t_created) for tt in res.tasks),
        "demand_peak_trips_h": kpis["demand_peak_trips_h"],
        "demand_avg_trips_h": kpis["demand_avg_trips_h"],
        "bottlenecks": kpis["top_bottlenecks"],
        "summary": _summary(kpis),
    }
