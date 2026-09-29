"""Тестовые двойники портов прикладного слоя.

Только для тестов: в сервис не входят, режима хранения в памяти у сервиса нет.
Поведение FakeJobStore сверяется с PostgreSQL общим контрактным тестом
(test_job_queue_contract), чтобы двойник не расходился с настоящим хранилищем.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
import dataclasses
from typing import Any

from application import errors
from application import models

_INTERRUPTED = "Задание прервано: сервис перезапускался во время расчёта."
_REQUEUED = "Воркер перестал отвечать — задание возвращено в очередь."


class ManualClock:
    """Часы, которые идут только по команде теста."""

    def __init__(self, start: float = 0.0) -> None:
        self._now = start

    def __call__(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        """Переводит часы вперёд."""
        self._now += seconds


class SequentialIds:
    """Выдаёт номера 000…001, 000…002 — в формате uuid4 hex."""

    def __init__(self) -> None:
        self._count = 0

    def __call__(self) -> str:
        self._count += 1
        return f"{self._count:032x}"


@dataclasses.dataclass(frozen=True)
class _Job:
    """Строка задания в памяти двойника."""

    job_id: str
    request: Mapping[str, Any]
    scenarios: tuple[Mapping[str, Any], ...]
    simulation_version: str
    created_at: float
    status: str = "queued"
    log: tuple[str, ...] = ()
    lease: int = 0
    attempts: int = 0
    workers: int | None = None
    heartbeat_at: float | None = None
    finished_at: float | None = None
    error: str | None = None
    errors: tuple[Mapping[str, str], ...] | None = None
    detail: str | None = None
    owner_sub: str | None = None


class FakeJobStore:
    """Двойник хранилища: очередь заданий, прогоны и трассы в словарях.

    Соблюдает ограждение токеном владения так же, как PostgreSQL: захват
    увеличивает lease и attempts, запись с чужим lease отклоняется.

    Attributes:
        ready: Что вернёт is_ready().
    """

    def __init__(self, clock: Callable[[], float] | None = None) -> None:
        self._clock = clock or ManualClock()
        self._jobs: dict[str, _Job] = {}
        self._runs: dict[str, tuple[str, models.FinishedRun]] = {}
        self.ready = True

    # --- JobSubmission ---------------------------------------------------
    def create_job(
        self,
        job_id: str,
        request: Mapping[str, Any],
        scenarios: Sequence[Mapping[str, Any]],
        simulation_version: str,
        *,
        owner_sub: str | None = None,
    ) -> None:
        if job_id in self._jobs:
            raise ValueError(f"задание уже есть: {job_id=}")
        self._jobs[job_id] = _Job(
            job_id=job_id,
            request=request,
            scenarios=tuple(scenarios),
            simulation_version=simulation_version,
            created_at=self._clock(),
            owner_sub=owner_sub,
        )

    def count_active(self, owner_sub: str) -> int:
        return sum(
            1
            for job in self._jobs.values()
            if job.owner_sub == owner_sub
            and job.status in ("queued", "running")
        )

    # --- GuestJobCleanup -------------------------------------------------
    def purge_owner(self, owner_sub: str, older_than_s: float) -> int:
        now = self._clock()
        old = [
            job.job_id
            for job in self._jobs.values()
            if job.owner_sub == owner_sub
            and job.status != "running"
            and job.created_at <= now - older_than_s
        ]
        for job_id in old:
            del self._jobs[job_id]
        self._runs = {
            sid: run for sid, run in self._runs.items() if run[0] not in old
        }
        return len(old)

    # --- JobQueue --------------------------------------------------------
    def claim_next_job(self, worker_id: str) -> models.ClaimedJob | None:
        del worker_id
        queued = [j for j in self._jobs.values() if j.status == "queued"]
        if not queued:
            return None
        job = min(queued, key=lambda j: (j.created_at, j.job_id))
        job = self._put(
            job,
            status="running",
            lease=job.lease + 1,
            attempts=job.attempts + 1,
            heartbeat_at=self._clock(),
        )
        return models.ClaimedJob(
            job_id=job.job_id,
            lease=job.lease,
            request=job.request,
            scenarios=job.scenarios,
        )

    def heartbeat(
        self,
        job_id: str,
        lease: int,
        lines: Sequence[str] = (),
        workers: int | None = None,
    ) -> bool:
        job = self._owned(job_id, lease)
        if job is None:
            return False
        self._put(
            job,
            heartbeat_at=self._clock(),
            log=job.log + tuple(lines),
            workers=job.workers if workers is None else workers,
        )
        return True

    def finish_job(
        self,
        job_id: str,
        lease: int,
        runs: Sequence[models.FinishedRun],
        lines: Sequence[str] = (),
    ) -> bool:
        job = self._owned(job_id, lease)
        if job is None:
            return False
        for run in runs:
            self._runs[run.simulation_id] = (job_id, run)
        self._put(
            job,
            status="done",
            finished_at=self._clock(),
            log=job.log + tuple(lines),
        )
        return True

    def fail_job(
        self,
        job_id: str,
        lease: int,
        error: str,
        field_errors: Sequence[Mapping[str, str]] | None,
        detail: str | None,
    ) -> bool:
        job = self._owned(job_id, lease)
        if job is None:
            return False
        self._put(
            job,
            status="error",
            finished_at=self._clock(),
            error=error,
            errors=None if field_errors is None else tuple(field_errors),
            detail=detail,
        )
        return True

    def release_job(self, job_id: str, lease: int) -> bool:
        job = self._owned(job_id, lease)
        if job is None:
            return False
        self._put(
            job, status="queued", attempts=job.attempts - 1, heartbeat_at=None
        )
        return True

    def requeue_stale(self, stale_after_s: float, max_attempts: int) -> int:
        deadline = self._clock() - stale_after_s
        stale = [
            j
            for j in self._jobs.values()
            if j.status == "running"
            and j.heartbeat_at is not None
            and j.heartbeat_at <= deadline
        ]
        for job in stale:
            if job.attempts >= max_attempts:
                self._put(
                    job,
                    status="error",
                    error=_INTERRUPTED,
                    finished_at=self._clock(),
                    heartbeat_at=None,
                    log=job.log + (_INTERRUPTED,),
                )
            else:
                self._put(
                    job,
                    status="queued",
                    heartbeat_at=None,
                    log=job.log + (_REQUEUED,),
                )
        return len(stale)

    # --- ResultReader ----------------------------------------------------
    def _visible(self, job_id: str, viewer: str | None) -> _Job | None:
        """Задание, если viewer — его владелец; без владельца — никому."""
        job = self._jobs.get(job_id)
        if job is None or job.owner_sub is None or job.owner_sub != viewer:
            return None
        return job

    def get_job(
        self, job_id: str, *, viewer: str | None = None
    ) -> models.JobSnapshot | None:
        job = self._visible(job_id, viewer)
        if job is None:
            return None
        end = job.finished_at if job.finished_at is not None else self._clock()
        runs = sorted(
            (run for owner, run in self._runs.values() if owner == job_id),
            key=lambda r: r.scenario_index,
        )
        done = job.status == "done"
        return models.JobSnapshot(
            job_id=job.job_id,
            status=job.status,
            log=job.log,
            elapsed_s=end - job.created_at,
            workers=job.workers,
            error=job.error,
            errors=job.errors,
            simulation_ids=tuple(r.simulation_id for r in runs) if done else (),
            runs=tuple(r.result for r in runs) if done else (),
        )

    def _visible_run(
        self, simulation_id: str, viewer: str | None
    ) -> models.FinishedRun | None:
        found = self._runs.get(simulation_id)
        if found is None or self._visible(found[0], viewer) is None:
            return None
        return found[1]

    def get_run(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> Mapping[str, Any] | None:
        run = self._visible_run(simulation_id, viewer)
        return run.result if run else None

    def get_traces_gz(
        self, simulation_id: str, *, viewer: str | None = None
    ) -> bytes | None:
        run = self._visible_run(simulation_id, viewer)
        return run.traces.gzip_json if run else None

    # --- StorageHealth ---------------------------------------------------
    def is_ready(self) -> bool:
        return self.ready

    # --- для проверок в тестах ---------------------------------------------
    def attempts(self, job_id: str) -> int:
        """Сколько попыток потрачено на задание."""
        return self._jobs[job_id].attempts

    def detail(self, job_id: str) -> str | None:
        """Трассировка стека, сохранённая при ошибке."""
        return self._jobs[job_id].detail

    def _owned(self, job_id: str, lease: int) -> _Job | None:
        job = self._jobs.get(job_id)
        if job is None or job.lease != lease or job.status != "running":
            return None
        return job

    def _put(self, job: _Job, **changes: Any) -> _Job:
        updated = dataclasses.replace(job, **changes)
        self._jobs[job.job_id] = updated
        return updated


def output(task: models.ScenarioTask) -> models.ScenarioOutput:
    """Итог сценария, который вернул бы расчёт: прогон с номером задачи."""
    run = {
        "simulation_id": task.simulation_id,
        "scenario": {"name": task.scenario.get("name", "")},
        "status": "confirmed",
    }
    return models.ScenarioOutput(
        run=run, traces=models.PackedTraces(gzip_json=b"gz", raw_bytes=2)
    )


class ScriptedRunner:
    """Двойник ScenarioRunner: проигрывает заданный сценарий расчёта.

    Перед каждым вызовом tick вызывается before_tick(номер вызова); так тест
    двигает часы или отпускает задание посреди расчёта.

    Attributes:
        calls: Аргументы вызовов run: (request, tasks, parallelism).
    """

    def __init__(
        self,
        ticks: Sequence[Sequence[str]] = (),
        *,
        error: Exception | None = None,
        trailing: Sequence[str] = (),
        before_tick: Callable[[int], None] | None = None,
    ) -> None:
        self._ticks = ticks
        self._error = error
        self._trailing = tuple(trailing)
        self._before_tick = before_tick
        self.calls: list[tuple] = []

    def run(
        self,
        request: Mapping[str, Any],
        tasks: Sequence[models.ScenarioTask],
        parallelism: int,
        tick: Callable[[Sequence[str]], bool],
    ) -> models.RunnerOutcome | None:
        self.calls.append((request, tuple(tasks), parallelism))
        for i, lines in enumerate(self._ticks):
            if self._before_tick is not None:
                self._before_tick(i)
            if not tick(lines):
                return None
        if self._error is not None:
            raise self._error
        return models.RunnerOutcome(
            outputs=tuple(output(t) for t in tasks),
            trailing_lines=self._trailing,
        )


class FakeTokenVerifier:
    """Проверка токенов по словарю «токен → вызывающий».

    Attributes:
        tokens: Принимаемые токены; любой другой — InvalidTokenError.
        ready: Что отвечает is_ready.
        calls: Сколько раз вызывался verify.
    """

    def __init__(
        self, tokens: Mapping[str, models.Principal] | None = None
    ) -> None:
        self.tokens = dict(tokens or {})
        self.ready = True
        self.calls = 0

    def verify(self, token: str) -> models.Principal:
        """Вызывающий по токену или отказ."""
        self.calls += 1
        if token not in self.tokens:
            raise errors.InvalidTokenError("неизвестный токен")
        return self.tokens[token]

    def is_ready(self) -> bool:
        """Ключи «загружены», пока ready."""
        return self.ready


def principal(sub: str, *roles: str, azp: str = "rav5-web") -> models.Principal:
    """Вызывающий для тестов доступа."""
    return models.Principal(
        sub=sub, email=f"{sub}@example.com", roles=frozenset(roles), azp=azp
    )
