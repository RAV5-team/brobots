"""Движок имитации (SimPy).

Робот — конечный автомат с учётом времени по состояниям:
  idle          — свободен, ждёт задачу
  to_pickup     — порожний пробег к точке загрузки
  loading       — погрузка (у дока/ячейки, ресурс ограниченной ёмкости)
  to_drop       — пробег с грузом
  unloading     — разгрузка
  blocked       — ждёт освобождения ребра (полосы проезда) — трафик
  queue         — ждёт освобождения точки операции (дока/ячейки)
  to_charger    — едет на зарядку
  wait_charger  — ждёт свободную станцию
  charging      — заряжается
  down          — отказ: стоит на месте и держит ребро или точку, блокируя
                  проход
  towed         — эвакуация после полного разряда

Энергия: «ёмкость» АКБ = автономность (ч) × 3600 активных секунд; активные
состояния расходуют 1 ед./с, простой — idle_power_factor; зарядка линейная за
charge_time_min.
"""

from __future__ import annotations

import collections
from collections.abc import Generator
import dataclasses
import math
import random
from typing import Any

import networkx as nx
import simpy

from simcore import demand
from simcore import layout as layout_lib
from simcore import models

ACTIVE_STATES = {"to_pickup", "to_drop", "loading", "unloading", "to_charger"}
PRODUCTIVE_STATES = {"to_pickup", "to_drop", "loading", "unloading"}
# Процесс SimPy: генератор событий среды.
Process = Generator[simpy.Event, Any, Any]

STATES = [
    "idle",
    "to_pickup",
    "loading",
    "to_drop",
    "unloading",
    "blocked",
    "queue",
    "to_charger",
    "wait_charger",
    "charging",
    "down",
    "towed",
]


class Robot:
    """Один робот на смене: везёт заявки, ждёт проезда, ездит заряжаться."""

    def __init__(self, sim: Simulation, rid: int, start_node: str):
        """Ставит робота в узел с полным зарядом и запускает его процесс.

        Args:
            sim: Прогон, которому принадлежит робот.
            rid: Номер робота.
            start_node: Узел старта.
        """
        self.sim, self.env, self.a, self.spec = sim, sim.env, sim.a, sim.robot
        self.rng = sim.rng
        self.id = rid
        self.node = start_node
        self.state = "idle"
        self.capacity = self.spec.autonomy_h * 3600.0
        self.energy = self.a.soc_start * self.capacity
        self.charge_rate = self.capacity / max(
            self.spec.charge_time_min * 60.0, 1.0
        )
        self.v_eff = min(self.spec.v_max, sim.site.speed_cap)
        self.task: demand.Task | None = None
        self.wake: simpy.Event | None = None
        self.buckets: dict[str, float] = collections.defaultdict(float)
        self.dist_loaded = 0.0
        self.dist_empty = 0.0
        self.trips = 0
        self.charge_sessions = 0
        self.depleted_events = 0
        self.breakdowns = 0
        self._depleted_now = False
        self.next_fail = self.env.now + self.rng.expovariate(
            1.0 / (self.a.mtbf_h * 3600.0)
        )
        self.env.process(self.run())

    # ---- учёт --------------------------------------------------------------
    @property
    def soc(self) -> float:
        """Заряд АКБ, доля от ёмкости."""
        return self.energy / self.capacity

    def _acc(
        self,
        state: str,
        dt: float,
        u: str | None = None,
        v: str | None = None,
        energy: bool = True,
    ) -> None:
        """Учитывает dt секунд в состоянии: время, расход заряда, трассу."""
        if dt <= 0:
            return
        self.buckets[state] += dt
        if energy:
            rate = 1.0 if state in ACTIVE_STATES else self.a.idle_power_factor
            self.energy -= rate * dt
            if self.energy <= 0:
                self.energy = 0.0
                if not self._depleted_now:
                    self._depleted_now = True
                    self.depleted_events += 1
        self.sim.trace_seg(
            self.id,
            self.env.now - dt,
            self.env.now,
            u or self.node,
            v or self.node,
            state,
        )

    # ---- отказы ------------------------------------------------------------
    def _fail_due(self) -> bool:
        """Наступил ли очередной отказ по потоку отказов."""
        return self.env.now >= self.next_fail

    def _schedule_next_fail(self) -> None:
        """Планирует следующий отказ: экспоненциальная наработка на отказ."""
        self.next_fail = self.env.now + self.rng.expovariate(
            1.0 / (self.a.mtbf_h * 3600.0)
        )

    def repair(self, dt: float) -> Process:
        """Ремонт в кармане узла (ресурсы не удерживаются)."""
        prev = self.state
        self.state = "down"
        yield self.env.timeout(dt)
        self._acc("down", dt)
        self.state = prev

    # ---- движение по графу --------------------------------------------------
    def travel(self, dest: str, purpose: str) -> Process:
        """Ведёт робота по кратчайшему пути до узла.

        Если проезд занят дольше reroute_after_s — перестроение маршрута с
        обходом занятого ребра (динамическая маршрутизация FMS). Отказ на
        проезде блокирует его на evacuation_min, затем робот освобождает ребро
        и дорабатывает ремонт (MTTR − эвакуация) в кармане следующего узла.

        Args:
            dest: Узел назначения.
            purpose: Состояние в пути: to_pickup, to_drop или to_charger.
        """
        path = self.sim.lay.path(self.node, dest)
        loaded = purpose == "to_drop"
        v = self.v_eff * (self.a.loaded_speed_factor if loaded else 1.0)
        i, reroutes = 0, 0
        heading = None  # None = старт с места (разгон)
        while self.node != dest:
            u, w = self.node, path[i + 1]
            req, alt = yield from self._request_edge(u, w, dest, reroutes)
            if alt is not None:
                path, i, reroutes = alt, 0, reroutes + 1
                continue
            st = self.sim.edge_stats[layout_lib.ekey(u, w)]
            self.state = purpose
            repair_left = yield from self._fail_on_edge(purpose, st)
            heading = yield from self._drive(u, w, v, heading, purpose, st)
            self.sim.edge_res[layout_lib.ekey(u, w)].release(req)
            self.node = w
            i += 1
            if repair_left > 0:
                yield from self.repair(repair_left)

    def _request_edge(
        self, u: str, w: str, dest: str, reroutes: int
    ) -> Process:
        """Занимает ребро u–w; при долгом ожидании ищет обход.

        Returns:
            (запрос ресурса ребра, None) — ребро занято роботом; или
            (None, обходной путь) — ожидание отменено ради обхода.
        """
        res = self.sim.edge_res[layout_lib.ekey(u, w)]
        t0 = self.env.now
        self.state = "blocked"
        req = res.request()
        got = yield req | self.env.timeout(self.a.reroute_after_s)
        if req not in got:
            if reroutes < self.a.max_reroutes:
                alt = self.sim.alt_path(u, dest, avoid=(u, w))
                if alt is not None and alt[1] != w:
                    req.cancel()
                    self._acc("blocked", self.env.now - t0)
                    return None, alt
            yield req
        wait = self.env.now - t0
        if wait > 0:
            self._acc("blocked", wait)
        st = self.sim.edge_stats[layout_lib.ekey(u, w)]
        st["wait"] += wait
        st["n"] += 1
        return req, None

    def _fail_on_edge(self, purpose: str, st: dict) -> Process:
        """Отказ на проезде: робот блокирует ребро на время эвакуации.

        Returns:
            Сколько ремонта осталось доработать в кармане узла, с.
        """
        if not self._fail_due():
            return 0.0
        self.breakdowns += 1
        mttr = self.a.mttr_h * 3600.0
        block = min(mttr, self.a.evacuation_min * 60.0)
        self.state = "down"
        yield self.env.timeout(block)
        self._acc("down", block)
        st["busy"] += block
        self._schedule_next_fail()
        self.state = purpose
        return mttr - block

    def _drive(
        self,
        u: str,
        w: str,
        v: float,
        heading: tuple[float, float] | None,
        purpose: str,
        st: dict,
    ) -> Process:
        """Проезжает ребро u–w со штрафом за манёвр и случайными помехами.

        Returns:
            Направление движения после ребра.
        """
        lay = self.sim.lay
        d = lay.graph[u][w]["length"]
        # Штраф — только на старт с места и реальный поворот (>30°), а не на
        # каждое ребро: иначе время пути зависело бы от разрешения графа
        # (шага точек хранения).
        h = lay.heading(u, w)
        dt = d / v
        if heading is None or layout_lib.is_turn(heading, h):
            dt += self.a.turn_penalty_s
        # Помехи — пуассоновский поток на пройденные метры (не на ребро).
        if self.a.interference_per_100m > 0:
            lam = self.a.interference_per_100m * d / 100.0
            if self.rng.random() < 1.0 - math.exp(-lam):
                dt += self.a.interference_s
        yield self.env.timeout(dt)
        self._acc(purpose, dt, u, w)
        st["busy"] += dt
        if purpose == "to_drop":
            self.dist_loaded += d
        else:
            self.dist_empty += d
        return h

    def handle(self, node: str, t_s: float, state: str) -> Process:
        """Операция в узле: очередь к доку или ячейке, затем t_s секунд работы.

        Args:
            node: Узел операции.
            t_s: Длительность операции, с.
            state: Состояние во время операции: loading или unloading.
        """
        if self._fail_due():
            self.breakdowns += 1
            self._schedule_next_fail()
            yield from self.repair(self.a.mttr_h * 3600.0)
        res = self.sim.node_res[node]
        t0 = self.env.now
        self.state = "queue"
        with res.request() as req:
            yield req
            wait = self.env.now - t0
            if wait > 0:
                self._acc("queue", wait)
            self.state = state
            if state == "loading" and self.task is not None:
                self.task.t_pickup = self.env.now
                self.sim.disp.on_pickup()
            yield self.env.timeout(t_s)
            self._acc(state, t_s)

    # ---- зарядка -----------------------------------------------------------
    def go_charge(self, travel: bool = True) -> Process:
        """Отправляет робота на зарядку; travel=False — он уже у станции."""
        if travel:
            yield from self.travel(self.sim.lay.charger_node, "to_charger")
        t0 = self.env.now
        self.state = "wait_charger"
        with self.sim.chargers.request() as req:
            yield req
            wait = self.env.now - t0
            if wait > 0:
                self._acc("wait_charger", wait)
            self.state = "charging"
            self.charge_sessions += 1
            target = self.a.soc_target * self.capacity
            while self.energy < target:
                dt = min(
                    self.a.charge_poll_s,
                    (target - self.energy) / self.charge_rate,
                )
                yield self.env.timeout(dt)
                self.energy = min(
                    self.capacity, self.energy + self.charge_rate * dt
                )
                self._acc("charging", dt, energy=False)
                self.sim.charger_busy_total += dt
                # FMS отпускает робота под задачу, как только заряда хватает на
                # работу (и после принудительной зарядки тоже) — иначе в пик
                # парк синхронно «выпадает» на час.
                if (
                    self.sim.disp.pending
                    and self.soc >= self.a.soc_dispatch_min
                ):
                    break
        self._depleted_now = False

    def tow_and_charge(self) -> Process:
        """Эвакуация разряженного робота к станции и зарядка."""
        dt = self.a.tow_time_min * 60.0
        self.state = "towed"
        yield self.env.timeout(dt)
        u = self.node
        self.node = self.sim.lay.charger_node
        self._acc("towed", dt, u, self.node, energy=False)
        yield from self.go_charge(travel=False)

    # ---- выполнение задачи ---------------------------------------------------
    def execute(self, task: demand.Task) -> Process:
        """Выполняет заявку: подъезд, погрузка, рейс с грузом, выгрузка."""
        yield from self.travel(task.origin, "to_pickup")
        yield from self.handle(task.origin, self.spec.t_load_s, "loading")
        yield from self.travel(task.dest, "to_drop")
        yield from self.handle(task.dest, self.spec.t_unload_s, "unloading")
        task.t_done = self.env.now
        self.trips += 1
        self.task = None
        self.sim.disp.on_done()
        if self._depleted_now:
            yield from self.tow_and_charge()

    # ---- главный цикл --------------------------------------------------------
    def run(self) -> Process:
        """Главный цикл робота: зарядка по порогам, ожидание и заявки."""
        while True:
            if self.soc < self.a.soc_forced:
                yield from self.go_charge()
                continue
            if self.soc < self.a.soc_opportunity and not self.sim.disp.pending:
                yield from self.go_charge()
                continue
            self.state = "idle"
            self.wake = self.env.event()
            self.sim.disp.robot_idle(self)
            t0 = self.env.now
            yield self.wake | self.env.timeout(600.0)
            self._acc("idle", self.env.now - t0)
            if self.task is None:
                self.sim.disp.robot_leave_idle(self)
                continue
            yield from self.execute(self.task)


class Dispatcher:
    """Очередь задач FIFO, назначение ближайшему свободному роботу."""

    def __init__(self, sim: Simulation):
        self.sim = sim
        self.pending: collections.deque = collections.deque()
        self.idle: dict[int, Robot] = {}
        self.assigned_not_picked = 0
        self.done = 0

    def add_task(self, t: demand.Task) -> None:
        """Ставит заявку в очередь и пробует назначить."""
        self.pending.append(t)
        self._dispatch()

    def robot_idle(self, r: Robot) -> None:
        """Отмечает робота свободным и пробует назначить заявку."""
        self.idle[r.id] = r
        self._dispatch()

    def robot_leave_idle(self, r: Robot) -> None:
        """Снимает робота из свободных (ушёл заряжаться по таймауту)."""
        self.idle.pop(r.id, None)

    def on_pickup(self) -> None:
        """Заявка забрана: она больше не ждёт робота."""
        self.assigned_not_picked -= 1

    def on_done(self) -> None:
        """Заявка выполнена."""
        self.done += 1

    @property
    def backlog(self) -> int:
        """Заявок в очереди и назначенных, но ещё не забранных."""
        return len(self.pending) + self.assigned_not_picked

    def _dispatch(self) -> None:
        """Назначает заявки из головы очереди свободным роботам."""
        lay = self.sim.lay
        while self.pending and self.idle:
            t = self.pending[0]
            if self.sim.a.dispatch_policy == "nearest_idle":
                r = min(
                    self.idle.values(),
                    key=lambda rb: lay.dist(rb.node, t.origin),
                )
            else:
                r = next(iter(self.idle.values()))
            self.pending.popleft()
            del self.idle[r.id]
            r.task = t
            self.assigned_not_picked += 1
            if r.wake is None:
                raise RuntimeError(f"робот {r.id} свободен, но не ждёт заявку")
            r.wake.succeed()


@dataclasses.dataclass
class RunResult:
    """Результат одного прогона суток.

    Заявки, ряды KPI и — если прогон снят с трассировкой — трасса.
    """

    n_robots: int
    n_chargers: int
    horizon_s: float
    profile: list[float]
    tasks: list[demand.Task]
    robots: list[dict]
    series: list[dict]
    edge_stats: dict[tuple[str, str], dict]
    charger_busy_total: float
    charger_queue_max: int
    trace: list[tuple] | None
    layout_json: dict | None = None
    v_cap: float = (
        1.5  # min(v_max робота, лимит объекта) — база для измеренного N_kv
    )
    demand_k: float = 1.0


class Simulation:
    """Прогон рабочего дня для заданного состава парка.

    Строит поток заявок по профилю спроса, запускает роботов на графе
    проездов и возвращает RunResult.
    """

    def __init__(
        self,
        site: models.WarehouseSite,
        robot: models.RobotSpec,
        a: models.SimAssumptions,
        layout: layout_lib.Layout,
        n_robots: int,
        n_chargers: int,
        profile: list[float],
        in_share: list[float],
        seed: int = 1,
        trace: bool = False,
        demand_k: float = 1.0,
    ):
        """Готовит среду SimPy, ресурсы схемы, генератор заявок и роботов.

        Args:
            site: Склад.
            robot: Паспорт робота.
            a: Допущения имитации.
            layout: Схема склада.
            n_robots: Роботов в парке.
            n_chargers: Зарядных станций.
            profile: Нагрузка по часам относительно среднего часа.
            in_share: Доля приёмки в каждом часе.
            seed: Зерно ГСЧ — «день» прогона.
            trace: Записывать ли трассу для 2D-плеера.
            demand_k: Множитель объёма (проверка роста).
        """
        self.site, self.robot, self.a, self.lay = site, robot, a, layout
        self.n_robots, self.n_chargers, self.seed = n_robots, n_chargers, seed
        self.demand_k = demand_k
        self.rng = random.Random(seed)
        self.env = simpy.Environment()
        self.profile = profile
        self.horizon = len(self.profile) * 3600.0 + a.drain_h * 3600.0
        self.edge_res, self.node_res, self.chargers = layout.build_resources(
            self.env, a, n_chargers
        )
        self.edge_stats: dict[tuple[str, str], dict] = {
            k: dict(wait=0.0, n=0, busy=0.0) for k in self.edge_res
        }
        self.charger_busy_total = 0.0
        self.charger_queue_max = 0
        self._trace_on = trace
        self._trace: list[tuple] = []
        self.series: list[dict] = []
        self.disp = Dispatcher(self)
        self.gen = demand.TaskGenerator(
            self.env,
            site,
            a,
            layout,
            self.disp,
            self.rng,
            self.profile,
            demand_k,
            in_share,
        )
        self.robots = [
            Robot(self, i, layout.charger_node) for i in range(n_robots)
        ]
        self.env.process(self._monitor())

    def alt_path(
        self, u: str, dest: str, avoid: tuple[str, str]
    ) -> list[str] | None:
        """Кратчайший путь со штрафом за занятые рёбра — для перестроения.

        Args:
            u: Откуда.
            dest: Куда.
            avoid: Ребро, которое обходим (штраф ×50).

        Returns:
            Путь по узлам или None, если пути нет.
        """
        graph = self.lay.graph
        er = self.edge_res
        av = layout_lib.ekey(*avoid)

        def wf(x: str, y: str, d: dict) -> float:
            """Длина ребра со штрафом: обходимое ×50, занятое ×10."""
            k = layout_lib.ekey(x, y)
            if k == av:
                return d["length"] * 50.0
            r = er[k]
            return d["length"] * (10.0 if r.count >= r.capacity else 1.0)

        try:
            return nx.shortest_path(graph, u, dest, weight=wf)
        except nx.NetworkXNoPath:
            return None

    def trace_seg(
        self, rid: int, t0: float, t1: float, u: str, v: str, state: str
    ) -> None:
        """Пишет участок трассы, если прогон снимается с трассировкой."""
        if self._trace_on:
            self._trace.append((rid, t0, t1, u, v, state))

    def _monitor(self) -> Process:
        """Каждые monitor_step_s пишет точку рядов KPI."""
        while True:
            counts: collections.defaultdict[str, int] = collections.defaultdict(
                int
            )
            for r in self.robots:
                counts[r.state] += 1
            q = len(self.chargers.queue)
            self.charger_queue_max = max(self.charger_queue_max, q)
            self.series.append(
                dict(
                    t=self.env.now,
                    done=self.disp.done,
                    backlog=self.disp.backlog,
                    chargers_busy=self.chargers.count,
                    charger_queue=q,
                    soc_mean=sum(r.soc for r in self.robots) / len(self.robots),
                    **{f"s_{s}": counts.get(s, 0) for s in STATES},
                )
            )
            yield self.env.timeout(self.a.monitor_step_s)

    def run(self) -> RunResult:
        """Прогоняет сутки до горизонта и собирает результат."""
        self.env.run(until=self.horizon)
        layout_lib.set_charger_slots(self.lay, self.n_chargers)
        robots = [
            {
                "buckets": dict(r.buckets),
                "dist_loaded": r.dist_loaded,
                "dist_empty": r.dist_empty,
                "trips": r.trips,
                "charge_sessions": r.charge_sessions,
                "depleted": r.depleted_events,
                "breakdowns": r.breakdowns,
            }
            for r in self.robots
        ]
        return RunResult(
            n_robots=self.n_robots,
            n_chargers=self.n_chargers,
            horizon_s=self.horizon,
            profile=self.profile,
            tasks=self.gen.tasks,
            robots=robots,
            series=self.series,
            edge_stats=self.edge_stats,
            charger_busy_total=self.charger_busy_total,
            charger_queue_max=self.charger_queue_max,
            trace=self._trace if self._trace_on else None,
            layout_json=self.lay.to_json() if self._trace_on else None,
            v_cap=min(self.robot.v_max, self.site.speed_cap),
            demand_k=self.demand_k,
        )
