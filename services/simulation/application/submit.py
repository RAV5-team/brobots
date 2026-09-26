"""Сценарий «поставить проверку в очередь»."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from application import errors
from application import input_policy
from application import ports
from simcore import inputs
from simcore import version

_MAX_SCENARIOS = 2


class SubmitVerification:
    """Проверяет вход и ставит задание проверки в очередь."""

    def __init__(
        self, jobs: ports.JobSubmission, new_id: Callable[[], str]
    ) -> None:
        """Готовит сценарий.

        Args:
            jobs: Очередь заданий.
            new_id: Выдаёт номер нового задания.
        """
        self._jobs = jobs
        self._new_id = new_id

    def __call__(self, body: Mapping[str, Any]) -> str:
        """Ставит задание в очередь.

        Args:
            body: Тело запроса: конфигурация, площадка, задача и 1–2 сценария.

        Returns:
            Номер задания.

        Raises:
            errors.InvalidSubmissionError: Вход не прошёл проверку; в
                очередь ничего не поставлено.
        """
        request = {k: v for k, v in body.items() if k != "scenarios"}
        scenarios = body.get("scenarios")
        if (
            not isinstance(scenarios, list)
            or not 1 <= len(scenarios) <= _MAX_SCENARIOS
        ):
            raise errors.InvalidSubmissionError(
                "Передайте один или два сценария.",
                [{"field": "scenarios", "message": "от 1 до 2"}],
            )
        problems = _scenario_errors(request, scenarios) + [
            {"field": path, "message": "недопустимые символы"}
            for path in input_policy.unstorable_fields(body)
        ]
        if problems:
            raise errors.InvalidSubmissionError(
                "Проверьте входные данные.", problems
            )
        job_id = self._new_id()
        self._jobs.create_job(job_id, request, scenarios, version.SIM_VERSION)
        return job_id


def _scenario_errors(
    request: dict[str, Any], scenarios: Sequence[Any]
) -> list[dict[str, str]]:
    """Проверяет вход каждого сценария до постановки в очередь.

    Returns:
        Ошибки с путём от корня запроса: scenarios[i].<поле>.
    """
    found = []
    for i, scenario in enumerate(scenarios):
        try:
            inputs.build(request, scenario)
        except inputs.RequestError as e:
            found += [
                {
                    "field": f"scenarios[{i}].{x["field"]}",
                    "message": x["message"],
                }
                for x in e.errors
            ]
    return found
