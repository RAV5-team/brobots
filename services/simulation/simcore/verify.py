"""Шаг 3 «Симуляция»: проверка конфигурации, выбранной на шаге «Подбор».

Шаг «Подбор» уже выбрал, сколько роботов и станций нужно
(configuration). Симуляция прогоняет рабочий день именно этой конфигурации со
сценарными переменными (расписание пиков, требование к ожиданию, условия склада)
и отвечает на два вопроса:

  1. Работает ли конфигурация? Норматив №34: расчёт подтверждён, если в
     пиковые часы симуляция вывозит не меньше (1 − допуск) от потребности,
     допуск ±10 %. Дополнительно — требование к ожиданию паллеты, выполнение
     всех рейсов за сутки и отсутствие разрядов АКБ.
  2. Что докупить, чтобы работало? Поиск только вверх от конфигурации:
     сначала роботы при станциях с запасом, затем минимальное число станций
     не меньше исходного; итог подтверждается на 4 днях.

  3. Без чего можно обойтись? Уменьшение — только до состава, который
     выполняет те же требования при росте объёма: сначала роботы, затем
     станции по одной; итог подтверждается на 4 днях.

Результат — SimulationRun: вердикт, KPI, почасовая загрузка, изменение парка и
ПРЕДЛАГАЕМЫЙ набор скорректированных входов (adjusted_input_set).

Денег модуль не принимает и не считает: цены, нормативы экономики и пересчёт в
рублях — за пределами сервиса. Решения о составе парка операционные.
"""

from __future__ import annotations

from collections.abc import Callable
import math
import time
from typing import NamedTuple

from simcore import adjustments
from simcore import engine
from simcore import evaluate
from simcore import inputs
from simcore import metrics
from simcore import scenario as scenario_lib
from simcore import verdict_text
from simcore import version
from simcore import viz


def _no_progress(_: str) -> None:
    """Приёмник сообщений о ходе расчёта, когда он никому не нужен."""


# ----------------------------------------------------------------------------
# Критерий и поиск докупки
# ----------------------------------------------------------------------------
def throughput(ev: evaluate.CaseEvaluator, r: dict) -> dict:
    """Вывезено против потребности в среднем по пиковым часам (норматив 34).

    Args:
        ev: Оценщик сценария: знает пиковые часы.
        r: Оценка состава.

    Returns:
        required_h, served_h, ratio и число пиковых часов.
    """
    rows = [
        r["hourly"][i] for i in sorted(ev.peak_idx) if i < len(r["hourly"])
    ] or r["hourly"]
    dem = sum(h["demand"] or 0 for h in rows) / len(rows)
    done = sum(h["done"] or 0 for h in rows) / len(rows)
    return dict(
        required_h=dem,
        served_h=done,
        ratio=(done / dem) if dem else 1.0,
        peak_hours=len(rows),
    )


def check(ev: evaluate.CaseEvaluator, r: dict, tol: float) -> dict:
    """Проверяет четыре условия вердикта для оценки состава.

    Args:
        ev: Оценщик сценария.
        r: Оценка состава.
        tol: Допуск по пропускной способности.

    Returns:
        ok, список проверок, пропускная способность и признак узкого места
        планировки.
    """
    t = throughput(ev, r)
    k = r["kpis"]
    checks = [
        dict(
            code="throughput",
            name="Пропускная способность в пиковые часы",
            value=t["ratio"],
            target=1 - tol,
            ok=t["ratio"] >= 1 - tol - 1e-9,
            unit="доля",
        ),
        dict(
            code="wait",
            name=f"Паллеты забраны не позже {ev.b.case.wait_limit_min:g} мин "
            f"(худший день)",
            value=r["on_time_min"],
            target=ev.b.case.on_time_target,
            ok=r["on_time_min"] >= ev.b.case.on_time_target - 1e-9,
            unit="доля",
        ),
        dict(
            code="completion",
            name="Все рейсы выполнены за сутки",
            value=r["completion"],
            target=0.99,
            ok=r["completion"] >= 0.99,
            unit="доля",
        ),
        dict(
            code="battery",
            name="Нет разрядов АКБ в работе",
            value=r["depleted"],
            target=0,
            ok=r["depleted"] < 0.5,
            unit="шт./сутки",
        ),
    ]
    return dict(
        ok=all(x["ok"] for x in checks),
        checks=checks,
        throughput=t,
        layout_flag=k["blocked_share"] > ev.b.a.blocked_share_layout_flag,
        blocked_share=k["blocked_share"],
    )


def find_additions(
    ev: evaluate.CaseEvaluator,
    n0: int,
    c0: int,
    k_growth: float,
    tol: float,
    max_extra: int = 15,
    confirm: bool = True,
) -> tuple | None:
    """Ищет минимальную докупку (dn, dc) ≥ 0: сначала роботов, потом станции.

    Роботы подбираются при станциях с запасом, затем станций — минимум.

    Старт — оценка по недобору: если вывезено 80 % потребности, пробуем n0 / 0,8
    роботов, затем уточняем шагом ±1 (обычно 2–3 конфигурации вместо перебора с
    n0 + 1).
    """

    def ok(n: int, c: int, seeds: tuple[int, ...] = evaluate.SEEDS) -> bool:
        """Выполняет ли состав (n, c) требования на заданных днях."""
        return check(ev, ev.eval(n, c, k_growth, seeds), tol)["ok"]

    def c_gen(n: int) -> int:
        """Станции «с запасом» для n роботов: не меньше, чем было в подборе."""
        return max(c0, math.ceil(n / 3), 1)

    ratio = throughput(ev, ev.eval(n0, c0, k_growth))["ratio"]
    n = min(n0 + max_extra, max(n0, math.ceil(n0 / max(ratio, 0.3))))
    if ok(n, c_gen(n)):
        while n > n0 and ok(n - 1, c_gen(n - 1)):
            n -= 1
    else:
        while n < n0 + max_extra and not ok(n, c_gen(n)):
            n += 1
        if not ok(n, c_gen(n)):
            return None
    c = c0
    while c < c_gen(n) and not ok(n, c):
        c += 1
    if not confirm:
        return n - n0, c - c0
    for dn, dc in ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1)):
        if ok(n + dn, c + dc, evaluate.SEEDS_CONFIRM):
            return n + dn - n0, c + dc - c0
    return None


# Порог загрузки в пик для первой оценки числа роботов при уменьшении.
_UTIL_PEAK_TARGET = 0.85
# Меньше одной станции парк не оставляем.
_MIN_CHARGERS = 1
# Если итог не прошёл подтверждение на 4 днях: сначала возвращаем станцию,
# затем робота.
_REDUCE_CONFIRM_STEPS = ((0, 0), (0, 1), (1, 0), (1, 1), (2, 1))


def _min_passing(
    passes: Callable[[int], bool], start: int, lo: int, hi: int
) -> int:
    """Ищет наименьшее значение в [lo, hi], при котором passes истинно.

    Идёт шагом 1 от start: вниз, пока проходит, или вверх, пока не пройдёт.
    Предполагает, что passes монотонно по значению.

    Args:
        passes: Проверка требований для значения.
        start: Первая оценка.
        lo: Нижняя граница поиска.
        hi: Верхняя граница поиска.

    Returns:
        Найденное значение; hi, если не прошло ни одно.
    """
    v = start
    if passes(v):
        while v > lo and passes(v - 1):
            v -= 1
        return v
    while v < hi and not passes(v):
        v += 1
    return v


def find_reduction(
    ev: evaluate.CaseEvaluator, n0: int, c0: int, k_growth: float, tol: float
) -> tuple[int, int] | None:
    """Ищет минимальный состав (n ≤ n0, c ≤ c0), выдерживающий объём × K.

    Роботы — от оценки по загрузке в пик, шагом 1 при станциях из подбора.
    Затем станции снимаются по одной, пока парк из n роботов выполняет те же
    требования на том же объёме. Цены не участвуют: решение операционное.
    Итог подтверждается на 4 днях; если какой-то день провален, возвращаем
    станцию, затем робота.

    Args:
        ev: Оценщик прогонов сценария.
        n0: Роботов в исходной конфигурации.
        c0: Станций в исходной конфигурации.
        k_growth: Множитель объёма (1 + запас на рост).
        tol: Допуск по пропускной способности.

    Returns:
        (роботов, станций) после уменьшения; None, если исходный состав не
        выдерживает объём × K.
    """

    def ok(n: int, c: int, seeds: tuple[int, ...] = evaluate.SEEDS) -> bool:
        """Выполняет ли состав (n, c) требования на заданных днях."""
        return check(ev, ev.eval(n, c, k_growth, seeds), tol)["ok"]

    r0 = ev.eval(n0, c0, k_growth)
    if not check(ev, r0, tol)["ok"]:
        return None
    n_start = min(
        n0, max(1, math.ceil(n0 * r0["util_peak"] / _UTIL_PEAK_TARGET))
    )
    n = _min_passing(lambda v: ok(v, c0), n_start, lo=1, hi=n0)
    c = _min_passing(lambda v: ok(n, v), c0, lo=min(_MIN_CHARGERS, c0), hi=c0)
    for dn, dc in _REDUCE_CONFIRM_STEPS:
        nn, cc = min(n0, n + dn), min(c0, c + dc)
        if ok(nn, cc, evaluate.SEEDS_CONFIRM):
            return nn, cc
    return n0, c0


def _evidence_curve(
    ev: evaluate.CaseEvaluator, k_growth: float, c: int, tol: float
) -> list[dict]:
    """Точки «число роботов → результат» при фиксированных станциях.

    Используются для графика обоснования.
    """
    best: dict[int, dict] = {}
    for r in ev.cache.values():
        if (
            abs(r["k"] - k_growth) < 1e-6
            and r["c"] == c
            and (r["n"] not in best or r["days"] > best[r["n"]]["days"])
        ):
            best[r["n"]] = r
    out = []
    for n in sorted(best):
        r = best[n]
        ch = check(ev, r, tol)
        out.append(
            dict(
                n=n,
                c=c,
                days=r["days"],
                on_time=r["on_time"],
                on_time_min=r["on_time_min"],
                throughput_ratio=ch["throughput"]["ratio"],
                util_peak=r["util_peak"],
                ok=ch["ok"],
            )
        )
    return out


def _station_rows(
    ev: evaluate.CaseEvaluator, k_growth: float, n: int, tol: float
) -> list[dict]:
    """Строки «число станций → результат» при n роботах из кэша прогонов."""
    best: dict[int, dict] = {}
    for r in ev.cache.values():
        if (
            abs(r["k"] - k_growth) < 1e-6
            and r["n"] == n
            and (r["c"] not in best or r["days"] > best[r["c"]]["days"])
        ):
            best[r["c"]] = r
    return [
        dict(
            c=c,
            days=best[c]["days"],
            on_time_min=best[c]["on_time_min"],
            charge_peak=best[c]["charge_peak"],
            depleted=best[c]["depleted"],
            ok=check(ev, best[c], tol)["ok"],
        )
        for c in sorted(best)
    ]


# ----------------------------------------------------------------------------
# Прогон одного сценария
# ----------------------------------------------------------------------------
_TRACE_SEED = evaluate.SEEDS[0]


def _decide(
    ev: evaluate.CaseEvaluator,
    n0: int,
    c0: int,
    k_design: float,
    k_reserve: float,
    progress: Callable[[str], None],
) -> tuple[str, int, int, dict, dict, dict | None]:
    """Проверяет исходный состав и ищет докупку или уменьшение.

    Args:
        ev: Оценщик прогонов сценария.
        n0: Роботов в исходной конфигурации.
        c0: Станций в исходной конфигурации.
        k_design: Множитель объёма, на который считается докупка.
        k_reserve: Множитель объёма, который должен выдержать меньший парк.
        progress: Приёмник сообщений о ходе расчёта.

    Returns:
        (статус, роботов, станций, прогон исходного состава, его проверка,
        сведения об уменьшении или None).
    """
    b, tol = ev.b, ev.b.tolerance
    base = ev.eval(n0, c0, k_design)
    chk0 = check(ev, base, tol)
    if chk0["ok"]:
        base = ev.eval(n0, c0, k_design, evaluate.SEEDS_CONFIRM)
        chk0 = check(ev, base, tol)
    if not chk0["ok"]:
        progress("конфигурация не проходит — ищу, что докупить")
        add = find_additions(ev, n0, c0, k_design, tol)
        if add is None:
            status = (
                "layout_bottleneck"
                if chk0["layout_flag"]
                else ("not_achievable")
            )
            return status, n0, c0, base, chk0, None
        return "needs_additions", n0 + add[0], c0 + add[1], base, chk0, None
    if b.params["fleet_policy"] != "add_and_reduce":
        return "confirmed", n0, c0, base, chk0, None
    progress(
        f"проверяю, можно ли меньше без потери запаса на рост "
        f"{b.case.growth:.0%}"
    )
    red = find_reduction(ev, n0, c0, k_reserve, tol)
    status, n1, c1 = "confirmed", n0, c0
    if red and (red[0] < n0 or red[1] < c0):
        status, n1, c1 = "can_reduce", red[0], red[1]
    reduction = {
        "target_volume": k_reserve,
        "checked": True,
        "possible": status == "can_reduce",
        "original_passes_growth": red is not None,
    }
    return status, n1, c1, base, chk0, reduction


def _growth_check(
    ev: evaluate.CaseEvaluator,
    status: str,
    n1: int,
    c1: int,
    k_reserve: float,
) -> dict | None:
    """Проверяет рекомендуемый состав на объёме с запасом на рост.

    Returns:
        Итог проверки и, если рост не выдерживается, нужная докупка; None,
        если роста нет или состав не работает и на текущем объёме.
    """
    growth, tol = ev.b.case.growth, ev.b.tolerance
    if growth <= 0 or status in ("layout_bottleneck", "not_achievable"):
        return None
    seeds = evaluate.SEEDS_CONFIRM if status == "can_reduce" else evaluate.SEEDS
    g = ev.eval(n1, c1, k_reserve, seeds)
    gchk = check(ev, g, tol)
    extra = (
        (0, 0)
        if gchk["ok"]
        else find_additions(
            ev, n1, c1, k_reserve, tol, max_extra=6, confirm=False
        )
    )
    extra_robots, extra_chargers = extra or (None, None)
    return {
        "growth": growth,
        "ok": gchk["ok"],
        "on_time_min": g["on_time_min"],
        "days": g["days"],
        "throughput_ratio": gchk["throughput"]["ratio"],
        "extra_robots": extra_robots,
        "extra_chargers": extra_chargers,
    }


def _evidence(
    ev: evaluate.CaseEvaluator,
    status: str,
    c0: int,
    n1: int,
    k_design: float,
    k_reserve: float,
) -> dict:
    """Кривая по роботам и таблица станций вокруг рекомендации."""
    b, tol = ev.b, ev.b.tolerance
    near = status in ("can_reduce", "confirmed")
    k_ev = k_reserve if near and b.case.growth > 0 else k_design
    if near and b.params["fleet_policy"] == "add_and_reduce" and n1 > 1:
        ev.eval(n1 - 1, c0, k_ev)  # точка «на одного меньше» для кривой
    curve_c = c0 if near else max(c0, math.ceil(n1 / 3), 1)
    return {
        "volume_k": k_ev,
        "curve": _evidence_curve(ev, k_ev, curve_c, tol),
        "stations": _station_rows(ev, k_ev, n1, tol),
    }


def _kpis(ev: evaluate.CaseEvaluator, run: dict) -> dict:
    """KPI рекомендуемого состава на текущем объёме."""
    k = run["kpis"]
    return {
        "on_time": run["on_time"],
        "on_time_min": run["on_time_min"],
        "completion": run["completion"],
        "util_peak": run["util_peak"],
        "util_day": run["util_day"],
        "charge_peak": run["charge_peak"],
        "queue_peak": run["queue_peak"],
        "depleted": run["depleted"],
        "blocked_share": k["blocked_share"],
        "throughput": check(ev, run, ev.b.tolerance)["throughput"],
        "fleet_shares": k["fleet_shares"],
        "breakdowns": k["breakdowns"],
        "charger_util": k["charger_util"],
    }


def _kpis_before(o: verdict_text.Outcome) -> dict:
    """KPI исходного состава."""
    base = o.base
    return {
        "on_time": base["on_time"],
        "on_time_min": base["on_time_min"],
        "util_peak": base["util_peak"],
        "util_day": base["util_day"],
        "charge_peak": base["charge_peak"],
        "queue_peak": base["queue_peak"],
        "depleted": base["depleted"],
        "throughput": o.chk0["throughput"],
        "fleet_shares": base["kpis"]["fleet_shares"],
    }


def _demand(b: scenario_lib.Built) -> dict:
    """Потребность по часам сценария и пик из расчёта подбора."""
    sch = b.schedule
    return {
        "hours": [sch.clock(i) for i in range(sch.hours)],
        "rate_in": b.rate_in,
        "rate_out": b.rate_out,
        "peak_in": sch.peak_mask("in"),
        "peak_out": sch.peak_mask("out"),
        "calc_peak_trips_h": b.calc.peak_trips_h,
    }


def _traces(
    ev: evaluate.CaseEvaluator,
    o: verdict_text.Outcome,
    step_s: float,
    to_h: float | None,
) -> list[dict]:
    """Записывает 2D-трассы: состав из подбора и, если он другой, итоговый."""
    b = ev.b
    fleets = [(f"Из подбора: {o.n0}/{o.c0}", o.n0, o.c0)]
    if (o.n1, o.c1) != (o.n0, o.c0):
        rec = "Рекомендация" if o.status == "can_reduce" else "С докупкой"
        fleets.append((f"{rec}: {o.n1}/{o.c1}", o.n1, o.c1))
    traces = []
    for title, n, c in fleets:
        res = engine.Simulation(
            b.site,
            b.robot,
            b.a,
            ev.lay,
            n,
            c,
            seed=_TRACE_SEED,
            trace=True,
            profile=b.profile,
            in_share=b.in_share,
        ).run()
        kpis = metrics.compute_kpis(res, b.site, b.a)
        tr = viz.export_trace(res, kpis, title, step_s=step_s, t_to_h=to_h)
        tr["clock_offset_h"] = b.schedule.start_h
        traces.append(tr)
    return traces


def _outcome(
    ev: evaluate.CaseEvaluator,
    n0: int,
    c0: int,
    progress: Callable[[str], None],
) -> tuple[verdict_text.Outcome, dict | None]:
    """Проверяет сценарий и собирает итог для ответа и текстов.

    Returns:
        (итог проверки, сведения об уменьшении или None).
    """
    b = ev.b
    growth = b.case.growth
    k_design = 1.0 + growth if b.params["design_volume"] == "growth" else 1.0
    k_reserve = 1.0 + growth  # меньший парк должен выдержать рост
    status, n1, c1, base, chk0, reduction = _decide(
        ev, n0, c0, k_design, k_reserve, progress
    )
    final = ev.eval(n1, c1, k_design, evaluate.SEEDS_CONFIRM)
    final_base = ev.eval(n1, c1, 1.0, evaluate.SEEDS_CONFIRM)
    if growth > 0 and status not in ("layout_bottleneck", "not_achievable"):
        progress(f"проверяю рост объёма на {growth:.0%}")
    outcome = verdict_text.Outcome(
        status=status,
        n0=n0,
        c0=c0,
        n1=n1,
        c1=c1,
        base=base,
        chk0=chk0,
        final=final,
        chk1=check(ev, final, b.tolerance),
        final_base=final_base,
        growth_check=_growth_check(ev, status, n1, c1, k_reserve),
        evidence=_evidence(ev, status, c0, n1, k_design, k_reserve),
        tol=b.tolerance,
    )
    return outcome, reduction


def _response(
    req: dict,
    b: scenario_lib.Built,
    ev: evaluate.CaseEvaluator,
    o: verdict_text.Outcome,
    reduction: dict | None,
    simulation_id: str,
) -> dict:
    """Собирает SimulationRun из итога проверки (без трасс и времени)."""
    cfg = req["configuration"]
    n0, c0 = o.n0, o.c0
    return {
        "simulation_id": simulation_id,
        "configuration_id": cfg.get("configuration_id"),
        "simulation_version": version.SIM_VERSION,
        "scenario": {"name": b.case.name},
        "resolved_params": b.resolved,
        "status": o.status,
        "label": (
            "обновлено по 2D-модели" if (o.n1, o.c1) != (n0, c0) else None
        ),
        "tolerance": b.tolerance,
        "fleet_policy": b.params["fleet_policy"],
        "design_volume": b.params["design_volume"],
        "verdict": verdict_text.verdict(b, o),
        "checks_before": o.chk0,
        "checks_after": o.chk1,
        "fleet_change": {
            "robots": o.n1 - n0,
            "chargers": o.c1 - c0,
            "from_": {"robots": n0, "chargers": c0},
            "to": {"robots": o.n1, "chargers": o.c1},
        },
        "diagnosis": verdict_text.diagnosis(b, o.base, o.chk0, n0),
        "reduction": reduction,
        "growth_check": o.growth_check,
        "evidence": o.evidence,
        "kpis": _kpis(ev, o.final_base),
        "kpis_before": _kpis_before(o),
        "hourly_before": evaluate.hourly_out(o.base, b.schedule),
        "hourly_after": evaluate.hourly_out(o.final_base, b.schedule),
        "demand": _demand(b),
        "adjusted_input_set": {
            "items": adjustments.proposed(
                b.calc,
                o.final_base["kpis"],
                (n0, c0, o.n1, o.c1),
                b.tolerance,
            ),
        },
        "warnings": inputs.consistency_warnings(req, b),
        "timing": {
            "total_s": None,
            "runs": ev.runs,
            "per_run_s": ev.run_time / max(1, ev.runs),
            "configs": len(ev.cache),
        },
    }


class VerificationResult(NamedTuple):
    """Итог проверки сценария.

    Attributes:
        run: SimulationRun — ответ сервиса по сценарию.
        traces: 2D-трассы: «из подбора» и, если состав изменился, итоговая.
    """

    run: dict
    traces: list[dict]


def run_verification(
    req: dict,
    scenario: dict,
    progress: Callable[[str], None] | None = None,
    with_trace: bool = True,
    trace_step_s: float = 15.0,
    trace_to_h: float | None = None,
    *,
    simulation_id: str,
) -> VerificationResult:
    """Проверяет конфигурацию из подбора в одном сценарии.

    Args:
        req: Запрос: конфигурация из подбора, площадка и задача.
        scenario: Сценарий проверки ({name, simulation_params}).
        progress: Приёмник сообщений о ходе расчёта.
        with_trace: Записывать ли 2D-трассы.
        trace_step_s: Шаг кадров трассы, с.
        trace_to_h: До какого часа записывать трассу; None — весь день.
        simulation_id: Идентификатор прогона; выдаёт вызывающий.

    Returns:
        Прогон (вердикт, изменение парка, KPI, почасовая загрузка,
        обоснование, поправки) и его 2D-трассы.

    Raises:
        inputs.RequestError: Во входе есть ошибки.
    """
    t0 = time.time()
    b = inputs.build(req, scenario)
    name = b.case.name
    report = progress or _no_progress

    def step(message: str) -> None:
        """Сообщение о ходе расчёта с названием сценария."""
        report(f"{name}: {message}")

    cfg = req["configuration"]
    n0, c0 = int(cfg["robot_count"]), int(cfg["charger_count"])
    ev = evaluate.CaseEvaluator(b, step)
    step(f"прогоняю конфигурацию из подбора — {n0} роботов, {c0} станций")
    o, reduction = _outcome(ev, n0, c0, step)
    out = _response(req, b, ev, o, reduction, simulation_id)
    traces = []
    if with_trace:
        step("записываю 2D-визуализацию")
        traces = _traces(ev, o, trace_step_s, trace_to_h)
    out["timing"]["total_s"] = time.time() - t0
    step(f"готово за {out["timing"]["total_s"]:.0f} с")
    return VerificationResult(run=out, traces=traces)
