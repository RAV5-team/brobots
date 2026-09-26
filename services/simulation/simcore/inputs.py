"""Разбор запроса шага «Симуляция» в модели имитации.

Вход — конфигурация из подбора (робот, состав парка, след расчёта), площадка,
задача и один сценарий. Параметры сценария разбирает и проверяет sim_params;
здесь проверяются остальные блоки и собирается scenario.Built. Поля, которых
сервис не знает (например, денежные поля шага «Подбор»), игнорируются.
"""

from __future__ import annotations

import dataclasses

from simcore import models
from simcore import scenario as scenario_lib
from simcore import schedule
from simcore import sim_params

# Доля от расчётного пика, ниже которой пик сценария считается заметно ниже.
_PEAK_MISMATCH_SHARE = 0.97
# Допуск сверки среднего потока задачи со следом расчёта.
_AVG_MISMATCH_SHARE = 0.01


class RequestError(ValueError):
    """Ошибка входных данных: возвращается клиенту как 422 со списком полей.

    Attributes:
        errors: Ошибки вида {"field": путь, "message": текст}.
    """

    def __init__(self, errors: list[dict]):
        super().__init__(
            "; ".join(f"{e["field"]}: {e["message"]}" for e in errors)
        )
        self.errors = errors


@dataclasses.dataclass(frozen=True)
class NumberRule:
    """Правило для числового поля: обязательность, умолчание и диапазон."""

    required: bool = False
    default: float | None = None
    lo: float | None = None
    hi: float | None = None
    doc: str | None = None


FLEET = {
    "robot_count": NumberRule(required=True, lo=1, hi=500),
    "charger_count": NumberRule(required=True, lo=0, hi=500),
}
ROBOT = {
    "v_max": NumberRule(required=True, lo=0.1, hi=10),
    "autonomy_h": NumberRule(required=True, lo=0.5, hi=48),
    "charge_time_min": NumberRule(required=True, lo=1, hi=600),
    "t_load_s": NumberRule(required=True, lo=0, hi=1800),
    "t_unload_s": NumberRule(required=True, lo=0, hi=1800),
    "width_mm": NumberRule(required=True, lo=200, hi=4000),
}
LOCATION = {
    "active_area_m2": NumberRule(default=10000, lo=100),
    "aisle_main_m": NumberRule(default=3.5, lo=0.8),
    "aisle_rack_m": NumberRule(default=2.8, lo=0.8),
    "speed_limit_m_s": NumberRule(default=1.5, lo=0.1),
}
# След расчёта: от него зависят вердикт и поправки, поэтому значений по
# умолчанию нет. Время цикла — cycle_s или cycles_h, проверяется отдельно.
CALC = {
    "peak_trips_h": NumberRule(required=True, lo=0),
    "avg_trips_h": NumberRule(
        lo=0, doc="Средний поток; для сверки с задачей (порог 1 %)."
    ),
    "route_len_m": NumberRule(required=True, lo=1),
    "cycle_s": NumberRule(
        lo=1, doc="Время цикла, с. Нужно cycle_s либо cycles_h."
    ),
    "cycles_h": NumberRule(lo=0.1, doc="Циклов в час. Альтернатива cycle_s."),
    "eff_prod": NumberRule(required=True, lo=0.01),
    "n_util": NumberRule(required=True, lo=0.01, hi=1.0),
    "n_kv": NumberRule(required=True, lo=0.01, hi=1.0),
    "n_avail": NumberRule(required=True, lo=0.5, hi=0.999),
    "n_reserve": NumberRule(required=True, lo=0, hi=2.0),
}

TASK_KEYS = frozenset(
    spec["task"] for spec in sim_params.FIELDS.values() if spec.get("task")
)
# Допустимые поля каждого блока: всё остальное — ошибка «неизвестное поле».
_KEYS = {
    "": frozenset({"configuration", "location", "task"}),
    "configuration": frozenset(FLEET) | {"configuration_id", "robot", "calc"},
    "configuration.robot": frozenset(ROBOT) | {"name"},
    "configuration.calc": frozenset(CALC),
    "location": frozenset(LOCATION),
    "task": TASK_KEYS,
}


def _unknown(block: dict, path: str, errors: list[dict]) -> None:
    """Дописывает ошибку на каждое поле блока, которого нет в контракте."""
    for key in sorted(set(block) - _KEYS[path]):
        field = f"{path}.{key}" if path else key
        errors.append({"field": field, "message": "неизвестное поле"})


def _object(src: dict, key: str, path: str, errors: list[dict]) -> dict:
    """Возвращает вложенный блок; не объект — ошибка, нет блока — {}."""
    value = src.get(key)
    if value is None:
        return {}
    if not isinstance(value, dict):
        errors.append({"field": path, "message": "должен быть объектом"})
        return {}
    _unknown(value, path, errors)
    return value


def _number(
    src: dict, key: str, path: str, rule: NumberRule, errors: list[dict]
) -> float | None:
    """Читает число по правилу; ошибку дописывает в errors.

    Args:
        src: Блок запроса.
        key: Имя поля в блоке.
        path: Путь к блоку для сообщения об ошибке.
        rule: Правило поля.
        errors: Список, куда дописываются ошибки.

    Returns:
        Значение поля; умолчание, если поля нет или оно не число.
    """
    field = f"{path}.{key}"
    raw = src.get(key)
    if raw is None:
        if rule.required:
            errors.append({"field": field, "message": "обязательное поле"})
        return rule.default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        errors.append({"field": field, "message": "должно быть числом"})
        return rule.default
    too_low = rule.lo is not None and value < rule.lo
    too_high = rule.hi is not None and value > rule.hi
    if too_low or too_high:
        errors.append(
            {"field": field, "message": f"вне диапазона {rule.lo}…{rule.hi}"}
        )
    return value


def _numbers(
    src: dict, path: str, rules: dict[str, NumberRule], errors: list[dict]
) -> dict[str, float | None]:
    """Читает все поля блока по таблице правил."""
    return {k: _number(src, k, path, r, errors) for k, r in rules.items()}


def _schedule(params: dict) -> schedule.Schedule:
    """Строит расписание сценария: свои пики или как в расчёте подбора."""
    shape = (
        params["shift_start_h"],
        params["shifts"],
        params["shift_h"],
        params["peak_k"],
    )
    if params["peaks"]:
        peaks = [schedule.PeakWindow(**p) for p in params["peaks"]]
        return schedule.Schedule(*shape, peaks)
    return schedule.dataset_schedule(*shape)


def _calc_trace(
    calc: dict, fleet: dict, avg_trips_h: float, errors: list[dict]
) -> models.CalcTrace:
    """Собирает след расчёта подбора и проверяет время цикла.

    Args:
        calc: Разобранные поля configuration.calc.
        fleet: Разобранные robot_count и charger_count.
        avg_trips_h: Средний поток по задаче — если в следе его нет.
        errors: Список, куда дописываются ошибки.

    Returns:
        След расчёта.
    """
    cycle_s, cycles_h = calc["cycle_s"], calc["cycles_h"]
    if cycle_s is None and cycles_h is None:
        errors.append(
            {
                "field": "configuration.calc.cycle_s",
                "message": "обязательное поле (или cycles_h)",
            }
        )
    avg = calc["avg_trips_h"]
    return models.CalcTrace(
        n_robots=int(fleet["robot_count"] or 0),
        n_chargers=int(fleet["charger_count"] or 0),
        peak_trips_h=calc["peak_trips_h"],
        avg_trips_h=avg_trips_h if avg is None else avg,
        route_len_m=calc["route_len_m"],
        cycles_h=(3600.0 / cycle_s) if cycle_s else cycles_h,
        eff_prod=calc["eff_prod"],
        n_util=calc["n_util"],
        n_avail=calc["n_avail"],
        n_kv=calc["n_kv"],
        n_reserve=calc["n_reserve"],
    )


def _assumptions(params: dict, n_avail: float) -> models.SimAssumptions:
    """Допущения имитации из условий склада сценария.

    Готовность N_avail и время ремонта задают наработку на отказ:
    MTBF = MTTR × N_avail / (1 − N_avail).
    """
    mttr_h = params["mttr_h"]
    return models.SimAssumptions(
        interference_per_100m=scenario_lib.TRAFFIC[params["traffic"]],
        abc_share_a_cells=scenario_lib.ABC[params["abc"]],
        mttr_h=mttr_h,
        mtbf_h=mttr_h * n_avail / (1 - n_avail),
        sla_wait_min=params["wait_limit_min"],
    )


def _site(params: dict, loc: dict, hours: int) -> models.WarehouseSite:
    """Склад сценария: площадка из запроса, режим и объёмы из параметров.

    Рабочее окно сценария сведено в одну «смену» длиной hours.
    """
    return models.WarehouseSite(
        s_active_m2=loc["active_area_m2"],
        aisle_main_m=loc["aisle_main_m"],
        aisle_rack_m=loc["aisle_rack_m"],
        shifts=1,
        shift_h=hours,
        peak_k=params["peak_k"],
        in_pallets_day=params["in_per_day"],
        out_pallets_day=params["out_per_day"],
        oversize_share=params["manual_share"],
        speed_cap=loc["speed_limit_m_s"],
    )


def _rates(
    sch: schedule.Schedule, params: dict
) -> tuple[list[float], list[float], list[str]]:
    """Рейсы роботов по часам; непригодное расписание — ошибка запроса.

    Returns:
        (приёмка по часам, отгрузка по часам, предупреждения расписания).

    Raises:
        RequestError: Пики не помещаются в рабочее окно.
    """
    auto = 1.0 - params["manual_share"]
    rin, rout, errors, warnings = sch.hourly(
        params["in_per_day"] * auto, params["out_per_day"] * auto
    )
    if errors:
        raise RequestError(
            [
                {
                    "field": "simulation_params.schedule.peaks",
                    "message": " ".join(errors),
                }
            ]
        )
    return rin, rout, warnings


def _case(params: dict) -> scenario_lib.UserCase:
    """Требования сценария для вердикта."""
    return scenario_lib.UserCase(
        name=params["name"],
        wait_limit_min=params["wait_limit_min"],
        on_time_target=params["on_time_target"],
        growth=params["growth"],
        mttr_h=params["mttr_h"],
    )


def _raw_blocks(req: dict, errors: list[dict]) -> dict[str, dict]:
    """Проверяет структуру запроса: блоки — объекты, полей вне контракта нет.

    Args:
        req: Запрос без сценариев.
        errors: Список, куда дописываются ошибки.

    Returns:
        Блоки запроса: configuration, robot, calc, location, task.
    """
    if not isinstance(req, dict):
        errors.append({"field": "body", "message": "должно быть объектом"})
        req = {}
    _unknown(req, "", errors)
    cfg = _object(req, "configuration", "configuration", errors)
    if req.get("configuration") is None:
        errors.append(
            {"field": "configuration", "message": "обязательный блок"}
        )
    return {
        "configuration": cfg,
        "robot": _object(cfg, "robot", "configuration.robot", errors),
        "calc": _object(cfg, "calc", "configuration.calc", errors),
        "location": _object(req, "location", "location", errors),
        "task": _object(req, "task", "task", errors),
    }


def _blocks(raw: dict[str, dict], errors: list[dict]) -> dict[str, dict]:
    """Читает числовые поля блоков по таблицам правил."""
    return {
        "fleet": _numbers(raw["configuration"], "configuration", FLEET, errors),
        "robot": _numbers(raw["robot"], "configuration.robot", ROBOT, errors),
        "location": _numbers(raw["location"], "location", LOCATION, errors),
        "calc": _numbers(raw["calc"], "configuration.calc", CALC, errors),
    }


def build(req: dict, scenario: dict) -> scenario_lib.Built:
    """Собирает модели имитации из запроса и одного сценария.

    Args:
        req: Запрос без сценариев: конфигурация из подбора, площадка и
            задача. Поля вне контракта — ошибка.
        scenario: Один сценарий проверки ({name, simulation_params}).

    Returns:
        Собранные модели сценария — готовый вход имитации.

    Raises:
        RequestError: Во входе есть ошибки; список полей — в errors.
    """
    errors: list[dict] = []
    raw = _raw_blocks(req, errors)
    params, resolved, scenario_errors = sim_params.resolve(
        scenario, raw["task"]
    )
    errors += scenario_errors
    blocks = _blocks(raw, errors)
    if errors:
        raise RequestError(errors)
    sch = _schedule(params)
    site = _site(params, blocks["location"], sch.hours)
    calc = _calc_trace(
        blocks["calc"], blocks["fleet"], site.avg_trips_h, errors
    )
    if errors:
        raise RequestError(errors)
    rin, rout, warnings = _rates(sch, params)
    total = [i + o for i, o in zip(rin, rout)]
    avg = site.avg_trips_h or 1.0
    robot_name = raw["robot"].get("name", "Робот")
    return scenario_lib.Built(
        case=_case(params),
        robot=models.RobotSpec(name=str(robot_name), **blocks["robot"]),
        schedule=sch,
        site=site,
        a=_assumptions(params, calc.n_avail),
        rate_in=rin,
        rate_out=rout,
        profile=[t / avg for t in total],
        in_share=[(i / t if t > 0 else 0.5) for i, t in zip(rin, total)],
        schedule_warnings=warnings,
        calc=calc,
        tolerance=params["tolerance"],
        params=params,
        resolved=resolved,
    )


def consistency_warnings(req: dict, b: scenario_lib.Built) -> list[str]:
    """Сверяет вход симуляции со следом расчёта: одни и те же ли объём и пик.

    Args:
        req: Запрос на проверку конфигурации.
        b: Собранные модели сценария.

    Returns:
        Тексты предупреждений; пустой список, если расхождений нет.
    """
    warnings = []
    calc = (req.get("configuration") or {}).get("calc") or {}
    calc_avg = float(calc.get("avg_trips_h") or 0)
    if calc_avg and (
        abs(b.site.avg_trips_h - calc_avg) > _AVG_MISMATCH_SHARE * calc_avg
    ):
        warnings.append(
            f"Средний поток по задаче {b.site.avg_trips_h:.1f} рейса/ч, а в "
            f"расчёте конфигурации {calc_avg:.1f}. Проверьте, что симуляция и "
            f"подбор считают одну задачу."
        )
    peak = max((i + o for i, o in zip(b.rate_in, b.rate_out)), default=0)
    calc_peak = b.calc.peak_trips_h
    if calc_peak and peak < calc_peak * _PEAK_MISMATCH_SHARE:
        warnings.append(
            f"По расписанию сценария самый тяжёлый час — {peak:.0f} рейсов, а "
            f"расчёт закладывал {calc_peak:.0f}: пики приёмки и отгрузки не "
            f"совпадают, нагрузка ниже расчётной."
        )
    return warnings + b.schedule_warnings
