"""Вход имитации одного сценария: справочники условий, кейс и собранные модели.

Модели собирает simcore.inputs.build. Формул подбора здесь нет: состав парка и
след расчёта приходят из шага «Подбор». Денежных величин сервис не принимает и
не считает.
"""

from __future__ import annotations

import dataclasses

from simcore import models
from simcore import schedule as schedule_lib

# Люди и ручная техника в проездах роботов → помех на 100 м пути.
TRAFFIC = {"none": 0.0, "low": 0.3, "mid": 0.6, "high": 1.2}
# Ходовые паллеты у ворот → доля рейсов в ближние 20 % мест хранения.
ABC = {"none": 0.0, "part": 0.4, "full": 0.7}


@dataclasses.dataclass
class UserCase:
    """Требования сценария, по которым выносится вердикт.

    Attributes:
        name: Название сценария.
        wait_limit_min: За сколько минут паллета должна быть забрана.
        on_time_target: Требуемая доля паллет, забранных в срок.
        growth: Запас на рост объёма, доля.
        mttr_h: Время ремонта робота после отказа, ч.
    """

    name: str
    wait_limit_min: float
    on_time_target: float
    growth: float
    mttr_h: float


@dataclasses.dataclass
class Built:
    """Собранные модели одного сценария — готовый вход имитации.

    Attributes:
        case: Требования сценария.
        robot: Паспорт робота.
        schedule: Рабочее окно и пики сценария.
        site: Склад: геометрия, режим работы, объёмы.
        a: Допущения имитации.
        rate_in: Рейсов приёмки по часам рабочего окна.
        rate_out: Рейсов отгрузки по часам рабочего окна.
        profile: Нагрузка по часам относительно среднего часа.
        in_share: Доля приёмки в каждом часе.
        schedule_warnings: Предупреждения о расписании для пользователя.
        calc: След расчёта шага «Подбор».
        tolerance: Допуск по пропускной способности (норматив 34).
        params: Итоговые параметры сценария по именам sim_params.FLAT.
        resolved: Значение и источник каждого параметра для ответа.
    """

    case: UserCase
    robot: models.RobotSpec
    schedule: schedule_lib.Schedule
    site: models.WarehouseSite
    a: models.SimAssumptions
    rate_in: list[float]
    rate_out: list[float]
    profile: list[float]
    in_share: list[float]
    schedule_warnings: list[str]
    calc: models.CalcTrace
    tolerance: float
    params: dict
    resolved: dict
