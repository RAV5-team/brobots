"""Описание полей формы параметров шага для экрана (/api/meta)."""

from __future__ import annotations

from simcore import sim_params

OPTION_LABELS = {
    "traffic": {
        "none": "нет — зона только для роботов",
        "low": "редко",
        "mid": "умеренно",
        "high": "часто",
    },
    "abc": {
        "none": "нет, места случайные",
        "part": "частично",
        "full": "да, ходовые паллеты у ворот",
    },
    "fleet_policy": {
        "add_and_reduce": "докупка и обоснованное уменьшение",
        "add_only": "только докупка",
    },
    "design_volume": {
        "current": "текущий объём задачи",
        "growth": "объём с учётом роста",
    },
}
HELP = {
    "wait_limit_min": (
        "От появления паллеты у ворот или заявки на отгрузку до момента, "
        "когда робот её забрал."
    ),
    "on_time_target": (
        "95 % — 19 паллет из 20 должны уложиться в срок в каждый "
        "смоделированный день."
    ),
    "growth": (
        "Уменьшение парка предлагается, только если меньший парк выдерживает "
        "и такой рост."
    ),
    "traffic": (
        "Робот останавливается перед человеком; чем чаще, тем медленнее рейс."
    ),
    "abc": "Если востребованные паллеты стоят у ворот, рейсы короче.",
    "mttr_h": (
        "Сколько часов робот простаивает после отказа — по договору сервиса."
    ),
    "tolerance": (
        "Норматив 34: расчёт подтверждён, если в пик вывезено не меньше "
        "потребности минус допуск."
    ),
    "fleet_policy": "Разрешить ли симуляции рекомендовать меньший парк.",
    "design_volume": (
        "На что считать докупку, если конфигурация не справляется."
    ),
    "peak_k": "Во сколько раз пиковый час больше среднего.",
    "manual_share": "Негабарит, который робот не возьмёт.",
}
PCT_KEYS = {"on_time_target", "growth", "tolerance", "manual_share"}


def params_spec() -> list:
    """Описание полей simulation_params для формы интерфейса.

    Для каждого поля: группа, тип, диапазон, варианты, значение по
    умолчанию и откуда оно берётся из задачи.
    """
    out = []
    for (g, f), sp in sim_params.FIELDS.items():
        key = f or g
        d = dict(
            group=g,
            key=key,
            type=sp["type"],
            label=sp["label"],
            default=sp.get("default"),
            task=sp.get("task"),
            help=HELP.get(key),
            pct=key in PCT_KEYS,
        )
        for k in ("min", "max"):
            if k in sp:
                d[k] = sp[k]
        if sp["type"] == "enum":
            d["options"] = [
                dict(value=o, label=OPTION_LABELS.get(key, {}).get(o, o))
                for o in sp["options"]
            ]
        out.append(d)
    return out
