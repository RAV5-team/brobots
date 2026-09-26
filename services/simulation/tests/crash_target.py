"""Расчёты-заглушки для тестов воркера.

Отдельный модуль без зависимостей: дочерний процесс (spawn) импортирует его
по имени.
"""

import os
import time


def explode(
    request: dict, scenario: dict, simulation_id: str, progress: object
) -> None:
    """Имитирует сбой расчёта исключением."""
    del request, scenario, simulation_id, progress
    raise RuntimeError("расчёт упал")


def die(
    request: dict, scenario: dict, simulation_id: str, progress: object
) -> None:
    """Имитирует аварийное завершение процесса без итога."""
    del request, scenario, simulation_id, progress
    os._exit(3)  # pylint: disable=protected-access


def slow(request: dict, scenario: dict, simulation_id: str, progress) -> None:
    """Считает очень долго — для проверки прерывания."""
    del request, scenario, simulation_id
    progress.put("медленный расчёт начат")
    time.sleep(120)
