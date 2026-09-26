"""Расчёт одного сценария в дочернем процессе.

Модуль не знает о базе: его импортирует дочерний процесс (запуск spawn), а
соединения родителя туда попадать не должны. Между процессами передаются
только простые данные. Результат сразу очищается от NaN
и сжимается — родитель получает ~130 КБ вместо ~1,5 МБ.
"""

from __future__ import annotations

from collections.abc import Callable
import traceback
from typing import Protocol

from adapters import json_codec
from simcore import inputs
from simcore import verify

# Шаг кадров 2D-трассы, с.
TRACE_STEP_S = 20.0

Result = tuple[dict, bytes, int]


class Progress(Protocol):
    """Приёмник сообщений о ходе расчёта (очередь между процессами)."""

    def put(self, item: str) -> None:
        """Передаёт одно сообщение."""


Target = Callable[[dict, dict, str, Progress], Result]


class Results(Protocol):
    """Приёмник итогов сценариев (очередь между процессами)."""

    def put(self, item: tuple) -> None:
        """Передаёт итог одного сценария."""


def run_scenario(
    request: dict, scenario: dict, simulation_id: str, progress: Progress
) -> Result:
    """Проверяет сценарий и готовит результат к сохранению.

    Args:
        request: Запрос без сценариев.
        scenario: Сценарий проверки.
        simulation_id: Идентификатор прогона.
        progress: Приёмник сообщений о ходе расчёта.

    Returns:
        (SimulationRun без NaN, трассы в gzip, размер трасс до сжатия).

    Raises:
        inputs.RequestError: Во входе есть ошибки.
    """
    result = verify.run_verification(
        request,
        scenario,
        progress=progress.put,
        trace_step_s=TRACE_STEP_S,
        simulation_id=simulation_id,
    )
    traces_gz, raw_bytes = json_codec.pack_traces(result.traces)
    return json_codec.json_safe(result.run), traces_gz, raw_bytes


def child_main(
    target: Target,
    index: int,
    simulation_id: str,
    request: dict,
    scenario: dict,
    progress: Progress,
    results: Results,
) -> None:
    """Точка входа дочернего процесса: итог сценария — в очередь results.

    В results кладётся кортеж (index, вид, данные), где вид:
    «ok» — результат; «request_error» — ошибки входа по полям;
    «error» — (текст ошибки, трассировка стека).

    Args:
        target: Расчёт сценария (обычно run_scenario).
        index: Номер сценария в задании.
        simulation_id: Идентификатор прогона.
        request: Запрос без сценариев.
        scenario: Сценарий проверки.
        progress: Очередь сообщений о ходе расчёта.
        results: Очередь итогов.
    """
    outcome: tuple[str, object]
    try:
        outcome = ("ok", target(request, scenario, simulation_id, progress))
    except inputs.RequestError as e:
        outcome = ("request_error", e.errors)
    # Граница изоляции: любой сбой расчёта передаётся родителю как данные,
    # а не как исключение, которое может не пережить передачу между
    # процессами.
    # pylint: disable-next=broad-exception-caught
    except Exception as e:
        outcome = (
            "error",
            (f"{type(e).__name__}: {e}", traceback.format_exc()),
        )
    results.put((index, *outcome))
