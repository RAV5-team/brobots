"""Демо-вход шага «Симуляция»: так выглядит результат шага «Подбор».

Данные, не формулы. В продукте конфигурацию присылает оркестратор, и этот
модуль не используется. Здесь готовый результат подбора лежит в
demo_input.json, чтобы сервис можно было показать отдельно. Кроме полей
контракта в нём есть поля для экрана (robot_id, note, robots_per_charger …);
экран отправляет только поля из схемы запроса.
"""

from __future__ import annotations

import copy
import functools
import json
import pathlib

_FIXTURE = pathlib.Path(__file__).with_name("demo_input.json")


@functools.cache
def _data() -> dict:
    """Читает демо-вход один раз за процесс."""
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def location() -> dict:
    """Возвращает площадку демо-склада.

    Returns:
        Копия блока location: вызывающий может её менять.
    """
    return copy.deepcopy(_data()["location"])


def task() -> dict:
    """Возвращает задачу демо-склада: потоки и режим смен.

    Returns:
        Копия блока task.
    """
    return copy.deepcopy(_data()["task"])


def demo_configurations() -> list[dict]:
    """Возвращает конфигурации, выбранные на шаге «Подбор».

    Returns:
        Копии конфигураций: робот, число роботов и станций, след расчёта.
    """
    return copy.deepcopy(_data()["configurations"])
