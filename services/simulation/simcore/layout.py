"""Планировка объекта как граф.

Универсальная часть: класс Layout (узлы с координатами и типом, рёбра с длиной и
числом полос, кэш кратчайших путей, фабрика ресурсов SimPy). Доменная часть:
build_warehouse_layout() — синтетический склад по параметрам датасета. Для
аэропорта/медучреждения пишется свой build_*_layout(), ядро не меняется.

Модель трафика: ребро = проезд с ограниченным числом полос
(simpy.Resource(capacity=lanes)). Узел = перекрёсток/карман неограниченной
ёмкости (роботы ждут входа в занятое ребро). Это осознанное упрощение: разъезд
роботов происходит в узлах, поэтому тупики (deadlock) невозможны, а очереди в
проходах измеряются как время ожидания ребра. Точки выполнения операций (доки,
ячейки) — ресурсы с ограниченной ёмкостью.
"""

from __future__ import annotations

import dataclasses
import math

import networkx as nx
import simpy

from simcore import models

EdgeKey = tuple[str, str]

# Доворот меньше этого угла считается сглаживанием траектории, а не поворотом.
MIN_TURN_DEG = 30.0
# Отступ дока от фронтального проезда, м.
_DOCK_DEPTH_M = 6.0
# Отступ зарядной зоны от последнего прохода, м.
_CHARGER_OFFSET_M = 8.0


def is_turn(
    h0: tuple[float, float],
    h1: tuple[float, float],
    min_deg: float = MIN_TURN_DEG,
) -> bool:
    """Проверяет, что смена направления h0 → h1 — реальный поворот.

    Args:
        h0: единичное направление до узла.
        h1: единичное направление после узла.
        min_deg: порог угла, градусы; меньший доворот поворотом не считается.

    Returns:
        True, если угол между направлениями не меньше min_deg.
    """
    cos_between = h0[0] * h1[0] + h0[1] * h1[1]
    return cos_between < math.cos(math.radians(min_deg))


def ekey(u: str, v: str) -> EdgeKey:
    """Ключ неориентированного ребра: узлы по порядку."""
    return (u, v) if u <= v else (v, u)


@dataclasses.dataclass
class Layout:
    """Граф проездов объекта с кэшем кратчайших путей и ресурсами SimPy."""

    graph: nx.Graph
    docks_in: list[str] = dataclasses.field(default_factory=list)
    docks_out: list[str] = dataclasses.field(default_factory=list)
    storage: list[str] = dataclasses.field(default_factory=list)
    charger_node: str = "CHG"
    charger_slots_xy: list[tuple[float, float]] = dataclasses.field(
        default_factory=list
    )
    width_m: float = 0.0
    depth_m: float = 0.0
    meta: dict = dataclasses.field(default_factory=dict)

    # --- кэш путей -------------------------------------------------------
    _dist: dict[str, dict[str, float]] = dataclasses.field(
        default_factory=dict, repr=False
    )
    _paths: dict[str, dict[str, list[str]]] = dataclasses.field(
        default_factory=dict, repr=False
    )

    def _ensure_source(self, s: str) -> None:
        """Считает кратчайшие пути из узла s, если их ещё нет в кэше."""
        if s not in self._dist:
            d, p = nx.single_source_dijkstra(self.graph, s, weight="length")
            self._dist[s], self._paths[s] = d, p

    def path(self, u: str, v: str) -> list[str]:
        """Кратчайший путь по длине рёбер: список узлов от u до v."""
        self._ensure_source(u)
        return self._paths[u][v]

    def dist(self, u: str, v: str) -> float:
        """Длина кратчайшего пути от u до v, м."""
        self._ensure_source(u)
        return self._dist[u][v]

    def heading(self, u: str, w: str) -> tuple[float, float]:
        """Единичный вектор направления от u к w."""
        (x0, y0), (x1, y1) = self.xy(u), self.xy(w)
        d = math.hypot(x1 - x0, y1 - y0) or 1.0
        return (x1 - x0) / d, (y1 - y0) / d

    def xy(self, n: str) -> tuple[float, float]:
        """Координаты узла, м."""
        d = self.graph.nodes[n]
        return d["x"], d["y"]

    # --- ресурсы SimPy ---------------------------------------------------
    def build_resources(
        self, env: simpy.Environment, a: models.SimAssumptions, n_chargers: int
    ) -> tuple[
        dict[EdgeKey, simpy.Resource], dict[str, simpy.Resource], simpy.Resource
    ]:
        """Создаёт ресурсы SimPy: полосы рёбер, места у доков и ячеек, станции.

        Returns:
            (рёбра, узлы операций, зарядные станции).
        """
        edge_res: dict[EdgeKey, simpy.Resource] = {}
        for u, v, d in self.graph.edges(data=True):
            edge_res[ekey(u, v)] = simpy.Resource(env, capacity=int(d["lanes"]))
        node_res: dict[str, simpy.Resource] = {}
        for n in self.docks_in + self.docks_out:
            node_res[n] = simpy.Resource(env, capacity=a.dock_bays)
        for n in self.storage:
            node_res[n] = simpy.Resource(env, capacity=a.cell_capacity)
        chargers = simpy.Resource(env, capacity=max(1, n_chargers))
        return edge_res, node_res, chargers

    # --- экспорт для визуализации ----------------------------------------
    def to_json(self) -> dict:
        """Схема для плеера: узлы, рёбра, доки, зарядная зона."""
        nodes = [
            dict(id=n, x=d["x"], y=d["y"], type=d["type"])
            for n, d in self.graph.nodes(data=True)
        ]
        edges = [
            dict(u=u, v=v, length=d["length"], lanes=d["lanes"], kind=d["kind"])
            for u, v, d in self.graph.edges(data=True)
        ]
        return dict(
            nodes=nodes,
            edges=edges,
            docks_in=self.docks_in,
            docks_out=self.docks_out,
            storage=self.storage,
            charger_node=self.charger_node,
            charger_slots=self.charger_slots_xy,
            width=self.width_m,
            depth=self.depth_m,
            meta=self.meta,
        )


def lanes_for(
    width_m: float, robot: models.RobotSpec, a: models.SimAssumptions
) -> int:
    """Сколько роботов разъезжаются в проезде такой ширины (1…max_lanes)."""
    need = robot.width_mm / 1000.0 + a.clearance_m
    return int(max(1, min(a.max_lanes, math.floor(width_m / need))))


def _aisle_ys(
    depth_m: float, a: models.SimAssumptions
) -> tuple[list[float], list[float]]:
    """Координаты вдоль прохода: точки хранения и поперечные проезды.

    Последний поперечный проезд — задний, на глубине склада.
    """
    storage_ys = [
        (j + 0.5) * a.storage_spacing_m
        for j in range(int(depth_m // a.storage_spacing_m))
    ]
    cross_ys = []
    if a.cross_aisle_every_m > 0:
        k = 1
        while k * a.cross_aisle_every_m < depth_m - a.storage_spacing_m / 2:
            cross_ys.append(k * a.cross_aisle_every_m)
            k += 1
    cross_ys.append(depth_m)
    return storage_ys, cross_ys


def _add_aisle(
    graph: nx.Graph,
    i: int,
    x: float,
    ys: tuple[list[float], list[float]],
    lanes: int,
) -> list[str]:
    """Добавляет стеллажный проход i и возвращает его точки хранения."""
    storage_ys, cross_ys = ys
    col = [(0.0, f"J{i}")]
    graph.add_node(f"J{i}", x=x, y=0.0, type="junction")
    storage = []
    for j, y in enumerate(storage_ys):
        n = f"S{i}_{j}"
        graph.add_node(n, x=x, y=y, type="storage")
        storage.append(n)
        col.append((y, n))
    for k, y in enumerate(cross_ys):
        n = f"X{i}_{k}"
        graph.add_node(n, x=x, y=y, type="junction")
        col.append((y, n))
    col.sort(key=lambda t: t[0])
    for (y1, n1), (y2, n2) in zip(col, col[1:]):
        graph.add_edge(
            n1, n2, length=max(y2 - y1, 0.5), lanes=lanes, kind="rack"
        )
    return storage


def _add_cross_links(
    graph: nx.Graph, n_aisles: int, n_cross: int, pitch: float, lanes: int
) -> None:
    """Связывает проходы фронтальным главным и поперечными проездами."""
    for i in range(n_aisles - 1):
        graph.add_edge(
            f"J{i}", f"J{i+1}", length=pitch, lanes=lanes, kind="main"
        )
        for k in range(n_cross):
            graph.add_edge(
                f"X{i}_{k}",
                f"X{i+1}_{k}",
                length=pitch,
                lanes=lanes,
                kind="main",
            )


def _add_docks(
    graph: nx.Graph, n_in: int, n_out: int, n_aisles: int, lanes: int
) -> tuple[list[str], list[str]]:
    """Добавляет доки вдоль фронта: приёмка слева, отгрузка справа."""
    docks_in: list[str] = []
    docks_out: list[str] = []
    positions = [round(p) for p in _spread(n_in + n_out, n_aisles)]
    for idx, jpos in enumerate(positions):
        inbound = idx < n_in
        n = f"DI{idx}" if inbound else f"DO{idx - n_in}"
        graph.add_node(
            n,
            x=graph.nodes[f"J{jpos}"]["x"],
            y=-_DOCK_DEPTH_M,
            type="dock_in" if inbound else "dock_out",
        )
        graph.add_edge(
            n, f"J{jpos}", length=_DOCK_DEPTH_M, lanes=lanes, kind="dock"
        )
        (docks_in if inbound else docks_out).append(n)
    return docks_in, docks_out


def build_warehouse_layout(
    site: models.WarehouseSite,
    robot: models.RobotSpec,
    a: models.SimAssumptions,
) -> Layout:
    """Строит граф синтетического склада по параметрам датасета.

    Синтетический склад: фронтальный главный проезд с доками, перпендикулярные
    стеллажные проходы с агрегированными точками хранения, поперечные проезды и
    задний проезд, зарядная зона в конце главного проезда.

    Геометрия: фронт W = sqrt(S / aspect), глубина D = aspect × W.

    Args:
        site: Склад: площадь, ширина проездов, объёмы.
        robot: Робот: его ширина задаёт число полос.
        a: Допущения планировки.

    Returns:
        Схема склада.
    """
    front_m = math.sqrt(site.s_active_m2 / a.layout_aspect)
    depth_m = a.layout_aspect * front_m
    pitch = site.aisle_rack_m + 2 * a.rack_depth_m
    n_aisles = max(2, int(front_m // pitch))
    lanes_rack = lanes_for(site.aisle_rack_m, robot, a)
    lanes_main = lanes_for(site.aisle_main_m, robot, a)
    ys = _aisle_ys(depth_m, a)

    graph = nx.Graph()
    storage = []
    for i in range(n_aisles):
        x = pitch / 2 + i * pitch
        storage += _add_aisle(graph, i, x, ys, lanes_rack)
    _add_cross_links(graph, n_aisles, len(ys[1]), pitch, lanes_main)
    n_in = max(1, math.ceil(site.in_pallets_day / a.pallets_per_dock_day))
    n_out = max(1, math.ceil(site.out_pallets_day / a.pallets_per_dock_day))
    docks_in, docks_out = _add_docks(graph, n_in, n_out, n_aisles, lanes_main)
    # зарядная зона у правого конца фронтального проезда
    x_chg = (n_aisles - 1) * pitch + pitch / 2 + _CHARGER_OFFSET_M
    graph.add_node("CHG", x=x_chg, y=0.0, type="charger")
    graph.add_edge(
        "CHG",
        f"J{n_aisles-1}",
        length=_CHARGER_OFFSET_M,
        lanes=lanes_main,
        kind="main",
    )
    return Layout(
        graph=graph,
        docks_in=docks_in,
        docks_out=docks_out,
        storage=storage,
        charger_node="CHG",
        width_m=front_m,
        depth_m=depth_m,
        meta={
            "n_aisles": n_aisles,
            "pitch_m": pitch,
            "lanes_rack": lanes_rack,
            "lanes_main": lanes_main,
            "n_docks_in": n_in,
            "n_docks_out": n_out,
            "n_storage": len(storage),
        },
    )


def set_charger_slots(lay: Layout, n_chargers: int) -> None:
    """Раскладывает слоты станций сеткой по 4 у зарядного узла (для плеера)."""
    x0, y0 = lay.xy(lay.charger_node)
    lay.charger_slots_xy = [
        (x0 + 3.0 * (i % 4), y0 - 3.0 - 3.0 * (i // 4))
        for i in range(n_chargers)
    ]


def _spread(k: int, n: int) -> list[float]:
    """k позиций, равномерно распределённых по индексам 0..n-1."""
    if k == 1:
        return [(n - 1) / 2]
    return [i * (n - 1) / (k - 1) for i in range(k)]
