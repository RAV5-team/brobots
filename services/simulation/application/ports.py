"""Порты прикладного слоя: что сценариям нужно от внешнего мира.

Реализации — в adapters; сценарии знают только эти протоколы. Методы
хранилища при потере соединения бросают errors.StorageUnavailableError.

Владение (docs/keycloak/middleware.md): у задания пользователя владелец — его
sub, у задания гостя владельца нет. Чтение идёт от имени viewer — sub
вызывающего или None для гостя: задание с владельцем видит только он,
задание без владельца — любой, кто знает номер. Чужое неотличимо от
несуществующего (None).
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, Protocol

from application import models


class JobSubmission(Protocol):
    """Постановка заданий в очередь."""

    def create_job(
        self,
        job_id: str,
        request: Mapping[str, Any],
        scenarios: Sequence[Mapping[str, Any]],
        simulation_version: str,
        *,
        owner_sub: str | None = None,
    ) -> None:
        """Ставит задание в очередь (статус queued); owner_sub — владелец."""

    def count_active(self, owner_sub: str) -> int:
        """Сколько заданий владельца в очереди или в работе."""


class GuestJobCleanup(Protocol):
    """Удаление гостевых заданий по сроку хранения."""

    def purge_owner(self, owner_sub: str, older_than_s: float) -> int:
        """Удаляет задания владельца старше срока с прогонами и трассами.

        Задание в работе не трогается: его удалят при следующей чистке.

        Returns:
            Сколько заданий удалено.
        """


class JobQueue(Protocol):
    """Очередь заданий со стороны воркера.

    Все записи ограждены токеном владения lease: False означает, что задание
    больше не принадлежит этому захвату и ничего не записано.
    """

    def claim_next_job(self, worker_id: str) -> models.ClaimedJob | None:
        """Забирает самое старое задание; None — очередь пуста."""

    def heartbeat(
        self,
        job_id: str,
        lease: int,
        lines: Sequence[str] = (),
        workers: int | None = None,
    ) -> bool:
        """Подтверждает, что воркер жив, и дописывает журнал."""

    def finish_job(
        self,
        job_id: str,
        lease: int,
        runs: Sequence[models.FinishedRun],
        lines: Sequence[str] = (),
    ) -> bool:
        """Сохраняет прогоны и завершает задание — атомарно."""

    def fail_job(
        self,
        job_id: str,
        lease: int,
        error: str,
        field_errors: Sequence[Mapping[str, str]] | None,
        detail: str | None,
    ) -> bool:
        """Завершает задание ошибкой."""

    def release_job(self, job_id: str, lease: int) -> bool:
        """Возвращает задание в очередь, не тратя попытку."""

    def requeue_stale(self, stale_after_s: float, max_attempts: int) -> int:
        """Возвращает в очередь задания замолчавших воркеров.

        Задание, исчерпавшее попытки, завершается ошибкой. Возвращает, сколько
        заданий обработано.
        """


class ResultReader(Protocol):
    """Чтение заданий и прогонов для клиента."""

    def get_job(
        self, job_id: str, *, viewer: str | None = None
    ) -> models.JobSnapshot | None:
        """Задание; None — нет, помечено удалённым или чужое."""

    def get_run(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> Mapping[str, Any] | None:
        """SimulationRun; None — нет, скрыт мягким удалением или чужой."""

    def get_traces_gz(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> bytes | None:
        """2D-трассы прогона в gzip; None — нет, скрыты или чужие."""


class StorageHealth(Protocol):
    """Готовность хранилища."""

    def is_ready(self) -> bool:
        """True — хранилище доступно и схема нужной ревизии."""


class ScenarioRunner(Protocol):
    """Расчёт сценариев задания."""

    def run(
        self,
        request: Mapping[str, Any],
        tasks: Sequence[models.ScenarioTask],
        parallelism: int,
        tick: Callable[[Sequence[str]], bool],
    ) -> models.RunnerOutcome | None:
        """Считает сценарии, не больше parallelism сразу.

        Args:
            request: Запрос без сценариев.
            tasks: Сценарии с номерами будущих прогонов.
            parallelism: Сколько сценариев считать одновременно.
            tick: Вызывается регулярно с новыми строками журнала; False —
                расчёт нужно прервать.

        Returns:
            Итоги по сценариям; None — расчёт прерван по tick.

        Raises:
            inputs.RequestError: Во входе сценария есть ошибки.
            errors.ScenarioFailedError: Расчёт сценария упал.
        """


class TokenVerifier(Protocol):
    """Проверка access token Keycloak (docs/keycloak/middleware.md).

    verify синхронный: при неизвестном kid он загружает JWKS по сети, поэтому
    из асинхронного кода его вызывают в пуле потоков.
    """

    def verify(self, token: str) -> models.Principal:
        """Проверяет токен; errors.InvalidTokenError — токен не принят."""

    def is_ready(self) -> bool:
        """Ключи Keycloak загружены хотя бы раз."""
