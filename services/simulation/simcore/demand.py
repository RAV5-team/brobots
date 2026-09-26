"""Спрос: генератор заявок и пиковые окна профиля нагрузки.

Профиль нагрузки по часам строит расписание сценария (simcore.schedule).
Заявки прибывают по пуассоновскому процессу (экспоненциальные интервалы) с
интенсивностью, зависящей от текущего часа. Тип заявки (приёмка или отгрузка)
выбирается по доле приёмки в этом часе.
"""

from __future__ import annotations

from collections.abc import Generator
import dataclasses
import random
from typing import Any

import simpy

from simcore import models


@dataclasses.dataclass
class Task:
    """Одна заявка на перемещение паллеты.

    Attributes:
        id: Номер заявки.
        origin: Узел, откуда забрать паллету.
        dest: Узел, куда её отвезти.
        t_created: Когда заявка появилась, с от начала прогона.
        t_pickup: Когда началась погрузка; None — ещё не забрана.
        t_done: Когда паллета доставлена; None — ещё не доставлена.
    """

    id: int
    origin: str
    dest: str
    t_created: float
    t_pickup: float | None = None
    t_done: float | None = None

    @property
    def wait_s(self) -> float | None:
        """Ожидание от создания заявки до начала погрузки, с."""
        return None if self.t_pickup is None else self.t_pickup - self.t_created


def peak_windows(profile: list[float]) -> list[tuple]:
    """Пиковые часы: интервалы (t0, t1) в секундах.

    Пиком считается нагрузка не ниже 95 % максимальной.
    """
    mx = max(profile)
    wins, cur = [], None
    for h, m in enumerate(profile):
        if m >= 0.95 * mx - 1e-9:
            cur = (
                (h * 3600, (h + 1) * 3600)
                if cur is None
                else (cur[0], (h + 1) * 3600)
            )
        elif cur is not None:
            wins.append(cur)
            cur = None
    if cur is not None:
        wins.append(cur)
    return wins


class TaskGenerator:
    """Процесс SimPy: порождает задачи и отдаёт их диспетчеру."""

    def __init__(
        self,
        env: simpy.Environment,
        site: models.WarehouseSite,
        a: models.SimAssumptions,
        layout,
        dispatcher,
        rng: random.Random,
        profile: list[float],
        demand_k: float = 1.0,
        in_share: list[float] | None = None,
    ):
        """Готовит генератор и запускает его процесс в среде env.

        Args:
            env: Среда SimPy.
            site: Склад: средний поток рейсов.
            a: Допущения: ABC-слотирование и доля приёмки вне окна.
            layout: Схема склада: доки и точки хранения.
            dispatcher: Диспетчер, которому отдаются заявки.
            rng: ГСЧ прогона.
            profile: Нагрузка по часам относительно среднего часа.
            demand_k: Множитель объёма.
            in_share: Доля приёмки в каждом часе.
        """
        self.env, self.site, self.a, self.lay, self.disp, self.rng = (
            env,
            site,
            a,
            layout,
            dispatcher,
            rng,
        )
        self.profile = profile
        # Доля приёмки по часам (расписание); None → a.inbound_share.
        self.in_share = in_share
        self.demand_k = demand_k
        self.lam_avg = (
            site.avg_trips_h * demand_k / 3600.0
        )  # задач/с в средний час
        self.tasks: list[Task] = []
        self._id = 0
        self.hours = len(profile)
        # ABC-слотирование: доля рейсов в ближние точки (по расстоянию до
        # ближайшего дока)
        if a.abc_share_a_cells > 0:
            anchor = layout.docks_in[0]
            ranked = sorted(
                layout.storage, key=lambda n: layout.dist(anchor, n)
            )
            k = max(1, int(0.2 * len(ranked)))
            self.cells_a, self.cells_rest = ranked[:k], ranked[k:]
        else:
            self.cells_a, self.cells_rest = [], layout.storage
        env.process(self.run())

    def rate_at(self, t: float) -> float:
        """Интенсивность заявок в момент t, заявок/с; 0 после рабочего дня."""
        h = int(t // 3600)
        if h >= self.hours:
            return 0.0
        return self.lam_avg * self.profile[h]

    def _pick_cell(self) -> str:
        """Случайная точка хранения с учётом ABC-слотирования."""
        if self.cells_a and self.rng.random() < self.a.abc_share_a_cells:
            return self.rng.choice(self.cells_a)
        return self.rng.choice(self.cells_rest)

    def run(self) -> Generator[simpy.Event, Any, None]:
        """Процесс SimPy: порождает заявки до конца горизонта."""
        while True:
            lam = self.rate_at(self.env.now)
            if lam <= 0:
                # рабочий день закончился — ждём до конца горизонта (дренаж)
                yield self.env.timeout(3600)
                continue
            dt = self.rng.expovariate(lam)
            # Интенсивность меняется по часам. Благодаря отсутствию памяти у
            # экспоненты корректно ждать не более 60 с и перерисовывать интервал
            # с актуальной λ.
            if dt > 60.0:
                yield self.env.timeout(60.0)
                continue
            yield self.env.timeout(dt)
            self._id += 1
            h = int(self.env.now // 3600)
            share = (
                self.in_share[h]
                if self.in_share and h < len(self.in_share)
                else self.a.inbound_share
            )
            if self.rng.random() < share:
                t = Task(
                    self._id,
                    self.rng.choice(self.lay.docks_in),
                    self._pick_cell(),
                    self.env.now,
                )
            else:
                t = Task(
                    self._id,
                    self._pick_cell(),
                    self.rng.choice(self.lay.docks_out),
                    self.env.now,
                )
            self.tasks.append(t)
            self.disp.add_task(t)
