"""Данные, которыми обмениваются сценарии и порты.

Неизменяемые датаклассы. Вложенные словари неизменяемыми не становятся,
поэтому поля объявлены как Mapping и Sequence, а сценарии их не меняют.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
import dataclasses
from typing import Any

# Владелец заданий, которые api ставит за гостя демо-проекта (роли, §5). sub
# Keycloak — UUID, поэтому с этой меткой он не совпадает. Такие задания видны
# только внутренним путям и удаляются по сроку хранения.
GUEST_OWNER = "guest"


@dataclasses.dataclass(frozen=True)
class ClaimedJob:
    """Задание, которое воркер забрал из очереди.

    Attributes:
        job_id: Номер задания.
        lease: Токен владения этим захватом.
        request: Запрос без сценариев.
        scenarios: Сценарии проверки.
    """

    job_id: str
    lease: int
    request: Mapping[str, Any]
    scenarios: Sequence[Mapping[str, Any]]


@dataclasses.dataclass(frozen=True)
class PackedTraces:
    """2D-трассы прогона, готовые к хранению и отдаче.

    Attributes:
        gzip_json: gzip компактного JSON.
        raw_bytes: Размер JSON до сжатия, байт.
    """

    gzip_json: bytes
    raw_bytes: int


@dataclasses.dataclass(frozen=True)
class ScenarioTask:
    """Сценарий, который нужно посчитать.

    Attributes:
        simulation_id: Номер будущего прогона.
        scenario: Сценарий проверки.
    """

    simulation_id: str
    scenario: Mapping[str, Any]


@dataclasses.dataclass(frozen=True)
class ScenarioOutput:
    """Итог расчёта одного сценария.

    Attributes:
        run: SimulationRun, пригодный для JSON (без NaN).
        traces: 2D-трассы прогона.
    """

    run: Mapping[str, Any]
    traces: PackedTraces


@dataclasses.dataclass(frozen=True)
class RunnerOutcome:
    """Итог расчёта всех сценариев задания.

    Attributes:
        outputs: Итоги в порядке сценариев.
        trailing_lines: Строки журнала, пришедшие после последнего
            подтверждения; сохраняются вместе с итогом.
    """

    outputs: tuple[ScenarioOutput, ...]
    trailing_lines: tuple[str, ...]


@dataclasses.dataclass(frozen=True)
class FinishedRun:
    """Посчитанный прогон сценария для сохранения.

    Attributes:
        simulation_id: Номер прогона.
        scenario_index: Номер сценария в задании (0 или 1).
        result: SimulationRun без NaN.
        traces: 2D-трассы прогона.
    """

    simulation_id: str
    scenario_index: int
    result: Mapping[str, Any]
    traces: PackedTraces


@dataclasses.dataclass(frozen=True)
class JobSnapshot:
    """Состояние задания для клиента.

    Attributes:
        job_id: Номер задания.
        status: queued, running, done или error.
        log: Журнал хода расчёта.
        elapsed_s: Секунд от создания до завершения или до текущего момента.
        workers: Сколько сценариев считается параллельно; None — ещё не
            начато.
        error: Текст ошибки; None, если её нет.
        errors: Ошибки входа по полям; None, если ошибка не во входе.
        simulation_ids: Номера прогонов (только у done).
        runs: Прогоны по порядку сценариев (только у done).
    """

    job_id: str
    status: str
    log: Sequence[str]
    elapsed_s: float
    workers: int | None
    error: str | None
    errors: Sequence[Mapping[str, str]] | None
    simulation_ids: tuple[str, ...]
    runs: tuple[Mapping[str, Any], ...]


@dataclasses.dataclass(frozen=True)
class Principal:
    """Вызывающий из проверенного access token Keycloak.

    Attributes:
        sub: Неизменный ID пользователя или сервисного аккаунта.
        email: Почта — только для отображения, пользователь может её сменить.
        roles: Роли realm (realm_access.roles).
        azp: Клиент, которому выдан токен: rav5-web — браузер,
            rav5-api-internal — сервисный.
    """

    sub: str
    email: str | None
    roles: frozenset[str]
    azp: str | None

    @property
    def is_service(self) -> bool:
        """Сервисный токен (client credentials), а не пользователь."""
        return "service" in self.roles

    def has_role(self, role: str) -> bool:
        """Есть ли у вызывающего роль realm."""
        return role in self.roles
