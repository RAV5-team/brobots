"""Оценка конфигурации по дням с кэшем прогонов.

Прогон суток, почасовая статистика и кэш по (роботы, станции, объём).

Требование должно выполняться в КАЖДЫЙ смоделированный день: у границы мощности
очередь растёт лавинообразно, и среднее по дням скрывает дни-провалы. Поэтому
«день» — это отдельное зерно ГСЧ, а решение принимается по худшему дню.
"""

from __future__ import annotations

from collections.abc import Callable
import math
import statistics
import time

from simcore import demand
from simcore import engine
from simcore import layout
from simcore import metrics
from simcore import scenario
from simcore import schedule

WORK = ("to_pickup", "loading", "to_drop", "unloading", "blocked", "queue")
CHARGE = ("to_charger", "charging")
SEEDS = (100, 101)  # рабочие дни для поиска
SEEDS_CONFIRM = (100, 101, 102, 103)  # подтверждение итоговой конфигурации


def _fmean(xs, default=0.0):
    xs = [
        x
        for x in xs
        if x is not None and not (isinstance(x, float) and math.isnan(x))
    ]
    return statistics.fmean(xs) if xs else default


# ----------------------------------------------------------------------------
# Почасовая статистика одного прогона
# ----------------------------------------------------------------------------
def _task_counts(
    res: engine.RunResult, hours: int, wait_limit_s: float
) -> list[dict]:
    """Заявки по часу создания и выполненные рейсы по часу завершения."""
    rows = [
        {"created": 0, "done": 0, "on_time": 0, "wait_sum": 0.0, "picked": 0}
        for _ in range(hours)
    ]
    for t in res.tasks:
        i = int(t.t_created // 3600)
        if i < hours:
            r = rows[i]
            r["created"] += 1
            if t.t_pickup is not None:
                r["picked"] += 1
                r["wait_sum"] += t.t_pickup - t.t_created
                if t.t_pickup - t.t_created <= wait_limit_s:
                    r["on_time"] += 1
        if t.t_done is not None:
            j = int(t.t_done // 3600)
            if j < hours:
                rows[j]["done"] += 1
    return rows


def _share(points: list[dict], states: tuple[str, ...]) -> float:
    """Средняя по точкам доля парка в перечисленных состояниях."""
    return _fmean([sum(p[f"s_{k}"] for k in states) for p in points])


def _hour_row(r: dict, pts: list[dict], n: int, c: int) -> dict:
    """Строка часа: спрос, срок, состояния парка, очередь, станции."""
    work = _share(pts, WORK)
    return {
        "demand": r["created"],
        "done": r["done"],
        "on_time": (r["on_time"] / r["created"]) if r["created"] else None,
        "wait_mean_min": (
            r["wait_sum"] / r["picked"] / 60.0 if r["picked"] else None
        ),
        "work": work,
        "charge": _share(pts, CHARGE),
        "wait_charger": _share(pts, ("wait_charger",)),
        "down": _share(pts, ("down", "towed")),
        "idle": _share(pts, ("idle",)),
        "util": work / n if n else 0.0,
        "backlog_max": max((p["backlog"] for p in pts), default=0),
        "chargers_busy": (
            _fmean([p["chargers_busy"] for p in pts]) / max(1, c)
        ),
    }


def hourly_stats(
    res: engine.RunResult, hours: int, n: int, c: int, wait_limit_s: float
) -> list[dict]:
    """Считает почасовую статистику прогона по рабочим часам.

    Args:
        res: Результат прогона.
        hours: Рабочих часов.
        n: Роботов.
        c: Станций.
        wait_limit_s: Норматив ожидания паллеты, с.

    Returns:
        Строки по часам: спрос, выполнение, срок, состояния парка.
    """
    by_h: dict[int, list] = {}
    for s in res.series:
        i = int(s["t"] // 3600)
        if i < hours:
            by_h.setdefault(i, []).append(s)
    return [
        _hour_row(r, by_h.get(i, []), n, c)
        for i, r in enumerate(_task_counts(res, hours, wait_limit_s))
    ]


def _avg_hourly(runs: list[list[dict]]) -> list[dict]:
    out = []
    for i in range(len(runs[0])):
        row = {}
        for k in runs[0][i]:
            row[k] = _fmean([r[i][k] for r in runs], default=None)
        out.append(row)
    return out


# ----------------------------------------------------------------------------
# Оценка конфигурации (кэш по n, c, объёму, дню)
# ----------------------------------------------------------------------------
class CaseEvaluator:
    """Оценщик конфигураций сценария с кэшем по (n, c, объём, день).

    Каждый «день» — отдельное зерно ГСЧ. Требование должно выполняться в
    КАЖДЫЙ смоделированный день: у границы мощности очередь растёт
    лавинообразно, и среднее по дням скрывает дни-провалы.
    """

    def __init__(self, b: scenario.Built, progress: Callable[[str], None]):
        """Строит схему склада сценария и пустые кэши.

        Args:
            b: Собранные модели сценария.
            progress: Приёмник сообщений о прогонах.
        """
        self.b, self.progress = b, progress
        self.lay = layout.build_warehouse_layout(b.site, b.robot, b.a)
        self.raw: dict[tuple[int, int, float, int], dict] = {}
        self.cache: dict[tuple[int, int, float, int], dict] = {}
        self.runs = 0
        self.run_time = 0.0
        self.peak_idx: set[int] = set()
        for w0, w1 in demand.peak_windows(b.profile):
            self.peak_idx.update(range(int(w0 // 3600), int(w1 // 3600)))

    def _one(self, n: int, c: int, k: float, seed: int) -> dict:
        """Прогоняет один день состава (n, c) на объёме × k (с кэшем)."""
        key = (n, c, round(k, 3), seed)
        if key in self.raw:
            return self.raw[key]
        b, hours = self.b, self.b.schedule.hours
        lim = b.case.wait_limit_min * 60.0
        t0 = time.time()
        res = engine.Simulation(
            b.site,
            b.robot,
            b.a,
            self.lay,
            n,
            c,
            seed=seed,
            profile=b.profile,
            demand_k=k,
            in_share=b.in_share,
        ).run()
        self.run_time += time.time() - t0
        self.runs += 1
        tasks = res.tasks
        r = dict(
            kpis=metrics.compute_kpis(res, b.site, b.a),
            hourly=hourly_stats(res, hours, n, c, lim),
            on_time=sum(
                1
                for t in tasks
                if t.t_pickup is not None and t.t_pickup - t.t_created <= lim
            )
            / max(1, len(tasks)),
            completion=sum(1 for t in tasks if t.t_done is not None)
            / max(1, len(tasks)),
        )
        self.raw[key] = r
        return r

    def eval(
        self, n: int, c: int, k: float = 1.0, seeds: tuple[int, ...] = SEEDS
    ) -> dict:
        """Оценивает состав по нескольким дням (с кэшем).

        Имя повторяет «оценить», а не встроенный eval.

        Args:
            n: Роботов.
            c: Станций.
            k: Множитель объёма.
            seeds: Зёрна ГСЧ — смоделированные дни.

        Returns:
            Итог по дням: срок в среднем и в худший день, загрузка, почасовые
            строки, KPI и признак ok.
        """
        key = (n, c, round(k, 3), len(seeds))
        if key in self.cache:
            return self.cache[key]
        rs = [self._one(n, c, k, s) for s in seeds]
        b = self.b
        k_avg = metrics.average_kpis([r["kpis"] for r in rs])
        hourly = _avg_hourly([r["hourly"] for r in rs])
        peak_rows = [
            hourly[i] for i in self.peak_idx if i < len(hourly)
        ] or hourly
        days = [r["on_time"] for r in rs]
        r = dict(
            n=n,
            c=c,
            k=k,
            days=len(seeds),
            on_time=_fmean(days),
            on_time_min=min(days),
            completion=min(x["completion"] for x in rs),
            depleted=k_avg["battery_depleted"],
            queue_peak=_fmean([h["wait_charger"] for h in peak_rows]),
            charge_peak=_fmean(
                [h["charge"] + h["wait_charger"] for h in peak_rows]
            ),
            util_peak=_fmean([h["util"] for h in peak_rows]),
            util_day=_fmean([h["util"] for h in hourly]),
            hourly=hourly,
            kpis=k_avg,
        )
        r["ok"] = (
            r["on_time_min"] >= b.case.on_time_target - 1e-9
            and r["completion"] >= 0.99
            and r["depleted"] < 0.5
        )
        self.cache[key] = r
        self.progress(
            f"{n} роботов, {c} станций, объём "
            f"{"+" + format(k - 1, ".0%") if k > 1 else "базовый"}: "
            f"в срок {r["on_time"]:.1%} "
            f"(худший из {len(seeds)} дней {r["on_time_min"]:.1%})"
            f"{" ✓" if r["ok"] else " ✗"}"
        )
        return r


# ----------------------------------------------------------------------------
# Почасовые строки для ответа
# ----------------------------------------------------------------------------


def hourly_out(r: dict, sch: schedule.Schedule) -> list[dict]:
    """Почасовые строки прогона для ответа сервиса.

    Часы приведены к стенным.
    """
    return [dict(clock=sch.clock(i), **h) for i, h in enumerate(r["hourly"])]
