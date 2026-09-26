"""Тексты вердикта шага «Симуляция»: заголовок, обоснование, диагноз.

Только формулировки по уже посчитанным прогонам: решений о составе парка здесь
нет, денег тоже.
"""

from __future__ import annotations

import dataclasses

from simcore import scenario as scenario_lib
from simcore import text


def diagnosis(b: scenario_lib.Built, r: dict, chk: dict, n: int) -> list[str]:
    """Объясняет, почему не работает (или где тонко), по исходному составу.

    Args:
        b: Собранные модели сценария.
        r: Прогон исходного состава.
        chk: Результат проверки этого прогона.
        n: Роботов в исходном составе.

    Returns:
        Тексты диагноза; пустой список, если сказать нечего.
    """
    out = []
    hr = r["hourly"]
    hours = b.schedule.hours
    worst = min(
        range(hours),
        key=lambda i: hr[i]["on_time"] if hr[i]["on_time"] is not None else 1,
    )
    hw = hr[worst]
    hour_from = b.schedule.clock(worst)
    hour_to = (hour_from + 1) % 24
    if hw["on_time"] is not None and hw["on_time"] < b.case.on_time_target:
        out.append(
            f"Хуже всего в "
            f"{hour_from:02d}:00–{hour_to:02d}:00: "
            f"в срок только {text.pp(hw["on_time"])} паллет, роботы заняты "
            f"работой {hw["util"]:.0%} времени, "
            f"на зарядке {text.num(hw["charge"])} и ждут станцию "
            f"{text.num(hw["wait_charger"])}."
        )
    if r["charge_peak"] > max(0.5, 0.05 * n):
        out.append(
            f"В пиковые часы в среднем {text.num(r["charge_peak"])} робота на "
            f"зарядке или в очереди к станции — "
            f"они не успевают зарядиться вне пика."
        )
    if r["depleted"] >= 0.5:
        out.append(
            f"Роботы разряжаются в работе ({text.num(r["depleted"])} раза за "
            f"сутки) — станций не хватает."
        )
    if chk["layout_flag"]:
        out.append(
            f"{chk["blocked_share"]:.0%} времени роботы ждут проезд или место "
            f"у ворот — узкое место планировки: "
            f"добавление роботов помогает слабо."
        )
    if not out and r["util_peak"] > 0.85:
        out.append(
            f"В пиковые часы роботы заняты работой {r["util_peak"]:.0%} "
            f"времени — запаса почти нет."
        )
    return out


def _reduce_title(n0: int, c0: int, n1: int, c1: int) -> str:
    """Возвращает заголовок вердикта «можно меньше»."""
    if c1 == c0:
        return (
            f"Можно меньше: {text.robots(n1)} вместо {n0}, "
            f"станций столько же ({c0})"
        )
    if n1 == n0:
        return (
            f"Можно меньше станций: {c1} вместо {c0}, роботов столько же ({n0})"
        )
    return (
        f"Можно меньше: {text.robots(n1)} и {text.chargers(c1)} "
        f"вместо {n0} и {c0}"
    )


def _failure_detail(below: dict, row: dict | None) -> str:
    """Описывает, чем проваливается состав с одной станцией меньше.

    Args:
        below: Прогон с одной станцией меньше.
        row: Прогон с выбранным числом станций; None, если его нет.

    Returns:
        «в худший день в срок X» и, если очередь на зарядку выросла,
        «в пик на зарядке Y робота».
    """
    detail = f"в худший день в срок {text.pp(below["on_time_min"])}"
    if row is None or below["charge_peak"] > row["charge_peak"]:
        detail += (
            f", в пик на зарядке {text.num(below["charge_peak"], 2)} робота"
        )
    return detail


def _station_justification(
    stations: list[dict], c0: int, c1: int, vol: str
) -> str | None:
    """Объясняет, почему станций столько, по строке, где требования ломаются.

    Args:
        stations: Прогоны при рекомендуемом числе роботов, по одной строке на
            число станций (см. verify._station_rows).
        c0: Станций в исходной конфигурации.
        c1: Станций в рекомендуемом составе.
        vol: Объём проверки словами («при росте объёма на 20 %»).

    Returns:
        Текст обоснования; None, если сказать нечего.
    """
    st = {r["c"]: r for r in stations}
    below = st.get(c1 - 1)
    if below is not None and below["ok"]:
        below = None  # на одну станцию меньше тоже работает — нечем объяснять
    if c1 < c0:
        reason = (
            f"Станции: {c1} вместо {c0} — при {text.at_stations(c1)} "
            f"требования {vol} выполняются"
        )
        if below is not None:
            reason += (
                f"; при {text.at_stations(c1 - 1)} — нет: "
                f"{_failure_detail(below, st.get(c1))}"
            )
        return reason + "."
    if c1 == c0 and below is not None:
        return (
            f"Станции оставляем {c0}: при {text.at_stations(c0 - 1)} "
            f"требования {vol} не выполняются — "
            f"{_failure_detail(below, st.get(c0))}."
        )
    return None


@dataclasses.dataclass(frozen=True)
class Outcome:
    """Итог проверки сценария — всё, из чего строится текст вердикта.

    Attributes:
        status: confirmed, can_reduce, needs_additions, layout_bottleneck или
            not_achievable.
        n0: Роботов в исходном составе.
        c0: Станций в исходном составе.
        n1: Роботов в рекомендуемом составе.
        c1: Станций в рекомендуемом составе.
        base: Прогон исходного состава на расчётном объёме.
        chk0: Проверка исходного состава.
        final: Подтверждающий прогон рекомендуемого состава.
        chk1: Проверка рекомендуемого состава.
        final_base: Прогон рекомендуемого состава на текущем объёме.
        growth_check: Проверка роста объёма; None, если не проводилась.
        evidence: Кривая по роботам и строки по станциям.
        tol: Допуск по пропускной способности.
    """

    status: str
    n0: int
    c0: int
    n1: int
    c1: int
    base: dict
    chk0: dict
    final: dict
    chk1: dict
    final_base: dict
    growth_check: dict | None
    evidence: dict
    tol: float


RISKS = (
    "Скорость робота с паллетой и число остановок из-за людей сильнее всего "
    "влияют на результат — каждое может сдвинуть потребность на ±1 робота. "
    "Проверьте на пилоте.",
    "Схема склада построена по площади и ширине проездов из локации; реальная "
    "схема ворот и стеллажей может изменить длину рейсов.",
)


def _headline(b: scenario_lib.Built, o: Outcome) -> str:
    """Первая строка вердикта: пропускная способность и срок исходного парка."""
    t0 = o.chk0["throughput"]
    return (
        f"Симуляция вывезла {t0["served_h"]:.0f} из {t0["required_h"]:.0f} "
        f"паллет/ч в пиковые часы "
        f"({text.pp(t0["ratio"])}, допуск ±{o.tol:.0%}); в срок "
        f"{b.case.wait_limit_min:g} мин — {text.pp(o.base["on_time"])} "
        f"паллет, в худший день {text.pp(o.base["on_time_min"])}."
    )


def _additions_title(o: Outcome) -> str:
    """Заголовок «докупить»: сколько роботов и станций добавить."""
    parts = []
    if o.n1 > o.n0:
        word = text.plural(o.n1 - o.n0, "робот", "робота", "роботов")
        parts.append(f"+{o.n1 - o.n0} {word}")
    if o.c1 > o.c0:
        word = text.plural(
            o.c1 - o.c0,
            "зарядную станцию",
            "зарядные станции",
            "зарядных станций",
        )
        parts.append(f"+{o.c1 - o.c0} {word}")
    return "Чтобы работало, докупить " + " и ".join(parts)


def _additions_lines(o: Outcome) -> list[str]:
    """Что не выполнено и как работает состав с докупкой."""
    failed = [x["name"].lower() for x in o.chk0["checks"] if not x["ok"]]
    t1 = o.chk1["throughput"]
    return [
        "Не выполнено: " + "; ".join(failed) + ".",
        f"С докупкой — {text.robots(o.n1)} и {text.chargers(o.c1)}: "
        f"{t1["served_h"]:.0f} из {t1["required_h"]:.0f} паллет/ч "
        f"({text.pp(t1["ratio"])}), в срок в худший из {o.final["days"]} "
        f"дней — {text.pp(o.final["on_time_min"])}.",
    ]


def _title_and_lines(o: Outcome) -> tuple[str, list[str]]:
    """Заголовок по статусу и пояснения к нему."""
    if o.status == "confirmed":
        return (
            f"Конфигурация подтверждена: {text.robots(o.n0)} и "
            f"{text.chargers(o.c0)}",
            [
                f"В пиковые часы роботы заняты работой "
                f"{o.base["util_peak"]:.0%} времени."
            ],
        )
    if o.status == "can_reduce":
        return _reduce_title(o.n0, o.c0, o.n1, o.c1), []
    if o.status == "needs_additions":
        return _additions_title(o), _additions_lines(o)
    if o.status == "layout_bottleneck":
        return "Не работает: узкое место планировки", []
    return "Не работает даже с докупкой до +15 роботов", []


def _reduce_justification(b: scenario_lib.Built, o: Outcome) -> list[str]:
    """Почему можно меньше: загрузка, проверка роста, роботы, станции."""
    g = b.case.growth
    gc = o.growth_check or {}
    vol = f"при росте объёма на {g:.0%}" if g > 0 else "на текущем объёме"
    on_time = gc.get("on_time_min", o.final_base["on_time_min"])
    ratio = gc.get("throughput_ratio", o.chk1["throughput"]["ratio"])
    why = [
        f"Подбор заложил {text.robots(o.n0)} и {text.chargers(o.c0)} (расчёт "
        f"подбора с резервом {b.calc.n_reserve:.0%}). На текущем объёме "
        f"в пиковые часы роботы заняты работой только "
        f"{o.base["util_peak"]:.0%} времени, за день — "
        f"{o.base["util_day"]:.0%}: значительная часть парка простаивает.",
        f"{text.robots(o.n1).capitalize()} и {text.chargers(o.c1)} выполняют "
        f"требования {vol}: в худший из {gc.get("days", 4)} дней в срок "
        f"{text.pp(on_time)} паллет (нужно {b.case.on_time_target:.0%}), в "
        f"пик вывозится {text.pp(ratio)} потребности. Запас на рост сохранён "
        f"— он проверен симуляцией, а не принят нормативом.",
    ]
    prev = _curve_point(o, o.n1 - 1)
    if prev and not prev["ok"]:
        why.append(
            f"Почему не меньше: при {text.at_robots(o.n1 - 1)} {vol} в "
            f"худший день в срок только {text.pp(prev["on_time_min"])}, "
            f"вывозится {text.pp(prev["throughput_ratio"])} пиковой "
            f"потребности."
        )
    station_why = _station_justification(
        o.evidence["stations"], o.c0, o.c1, vol
    )
    if station_why:
        why.append(station_why)
    return why


def _curve_point(o: Outcome, n: int) -> dict | None:
    """Точка кривой обоснования для n роботов, если она посчитана."""
    return next((p for p in o.evidence["curve"] if p["n"] == n), None)


def _confirmed_justification(b: scenario_lib.Built, o: Outcome) -> list[str]:
    """Почему меньше нельзя: провал состава на одного робота меньше."""
    prev = _curve_point(o, o.n0 - 1)
    if not prev or prev["ok"]:
        return []
    g = b.case.growth
    growth = f"при росте объёма на {g:.0%}" if g > 0 else ""
    return [
        f"Меньше нельзя: при {text.at_robots(o.n0 - 1)} {growth} в худший "
        f"день в срок только {text.pp(prev["on_time_min"])}."
    ]


def _growth_lines(o: Outcome) -> list[str]:
    """Выдерживает ли рекомендуемый состав рост объёма и что для него нужно."""
    gc = o.growth_check
    if not gc or o.status == "can_reduce":
        return []
    if gc["ok"]:
        return [f"Рост объёма на {gc["growth"]:.0%} конфигурация выдерживает."]
    if gc["extra_robots"] is None:
        return []
    extra = []
    if gc["extra_robots"]:
        word = text.plural(gc["extra_robots"], "робот", "робота", "роботов")
        extra.append(f"+{gc["extra_robots"]} {word}")
    if gc["extra_chargers"]:
        word = text.plural(
            gc["extra_chargers"], "станция", "станции", "станций"
        )
        extra.append(f"+{gc["extra_chargers"]} {word}")
    return [
        f"При росте объёма на {gc["growth"]:.0%} не хватит: в худший день в "
        f"срок {text.pp(gc["on_time_min"])}. Для роста понадобится ещё "
        f"{" и ".join(extra) or "докупка"}."
    ]


def verdict(b: scenario_lib.Built, o: Outcome) -> dict:
    """Собирает текст вердикта: заголовок, пояснения, обоснование и риски.

    Args:
        b: Собранные модели сценария.
        o: Итог проверки сценария.

    Returns:
        Словарь с ключами title, lines, justification и risks.
    """
    title, lines = _title_and_lines(o)
    if o.status == "can_reduce":
        why = _reduce_justification(b, o)
    elif o.status == "confirmed" and o.evidence["curve"]:
        why = _confirmed_justification(b, o)
    else:
        why = []
    return {
        "title": title,
        "lines": [_headline(b, o), *lines, *_growth_lines(o)],
        "justification": why,
        "risks": list(RISKS),
    }
