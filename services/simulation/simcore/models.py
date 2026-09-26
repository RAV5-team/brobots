"""Модели данных ядра симуляции.

Три вида входов:
  * RobotSpec      — паспортные характеристики модели робота.
  * WarehouseSite  — параметры объекта: геометрия, режим работы, объёмы.
  * CalcTrace      — след расчёта шага «Подбор»: состав парка, пиковая
                     потребность и коэффициенты, которые проверяет симуляция.

И допущения имитации SimAssumptions: значения по умолчанию с единицами.
"""

from __future__ import annotations

import dataclasses


# ----------------------------------------------------------------------------
# 1. Робот
# ----------------------------------------------------------------------------
@dataclasses.dataclass
class RobotSpec:
    """Паспортные характеристики модели робота.

    Attributes:
        name: Наименование модели.
        v_max: Максимальная скорость, м/с.
        autonomy_h: Часов активной работы от одного заряда.
        charge_time_min: Минут полной зарядки 0→100 %.
        t_load_s: Подхват или сцепка груза, с.
        t_unload_s: Установка или расцепка груза, с.
        width_mm: Ширина робота, мм.
    """

    name: str
    v_max: float
    autonomy_h: float
    charge_time_min: float
    t_load_s: float
    t_unload_s: float
    width_mm: float


# ----------------------------------------------------------------------------
# 2. Объект (склад, процесс «перемещение паллет док ↔ зона хранения»)
# ----------------------------------------------------------------------------
@dataclasses.dataclass
class WarehouseSite:
    """Склад как объект автоматизации: геометрия, режим работы и объёмы.

    Значения по умолчанию — склад из датасета организатора.
    """

    s_active_m2: float = 10_000  # площадь активной (роботизируемой) зоны
    aisle_main_m: float = 3.5  # ширина главных проездов
    aisle_rack_m: float = 2.8  # ширина рабочих проходов между стеллажами
    shifts: int = 2
    shift_h: float = 11.0
    peak_k: float = 1.5  # макс. час / средний час
    in_pallets_day: float = 1000
    out_pallets_day: float = 1000
    oversize_share: float = 0.05  # остаётся ручным
    speed_cap: float = 1.5  # ограничение скорости на объекте, м/с

    @property
    def hours_day(self) -> float:
        """Рабочих часов в сутках."""
        return self.shifts * self.shift_h

    @property
    def ops_day_auto(self) -> float:
        """Рейсов в сутки, которые выполняют роботы (без негабарита)."""
        return (self.in_pallets_day + self.out_pallets_day) * (
            1 - self.oversize_share
        )

    @property
    def avg_trips_h(self) -> float:
        """Средний поток рейсов в час."""
        return self.ops_day_auto / self.hours_day

    @property
    def peak_trips_h(self) -> float:
        """Поток рейсов в пиковый час."""
        return self.avg_trips_h * self.peak_k


# ----------------------------------------------------------------------------
# 3. След расчёта шага «Подбор», который проверяет симуляция
# ----------------------------------------------------------------------------
@dataclasses.dataclass
class CalcTrace:
    """Состав парка и след расчёта, пришедшие с шага «Подбор».

    Симуляция не пересчитывает эти величины, а проверяет, работает ли
    предложенный состав, и сверяет свои замеры с этим следом.

    Attributes:
        n_robots: Роботов в конфигурации.
        n_chargers: Зарядных станций в конфигурации.
        peak_trips_h: Потребность в пиковый час, рейсов/ч.
        avg_trips_h: Средний поток, рейсов/ч.
        route_len_m: Предполагаемая длина рейса в одну сторону, м.
        cycles_h: Номинальных циклов робота в час.
        eff_prod: Эффективная производительность робота, рейсов/ч.
        n_util: Коэффициент загрузки робота (норматив 4).
        n_avail: Коэффициент технической готовности (норматив 5).
        n_kv: Эксплуатационная скорость к максимальной (норматив 7).
        n_reserve: Резерв парка.
    """

    n_robots: int
    n_chargers: int
    peak_trips_h: float
    avg_trips_h: float
    route_len_m: float
    cycles_h: float
    eff_prod: float
    n_util: float = 0.80
    n_avail: float = 0.95
    n_kv: float = 0.60
    n_reserve: float = 0.15


# ----------------------------------------------------------------------------
# 4. Допущения симуляции (новые относительно расчёта подбора)
# ----------------------------------------------------------------------------
@dataclasses.dataclass
class SimAssumptions:
    """Допущения имитации, которых нет в расчёте подбора.

    Значения по умолчанию — допущения команды и типовые настройки FMS.

    Attributes:
        layout_aspect: Соотношение сторон активной зоны (глубина/фронт).
        rack_depth_m: Глубина стеллажного ряда (с одной стороны прохода), м.
        storage_spacing_m: Шаг агрегированных точек хранения вдоль прохода, м.
        cross_aisle_every_m: Шаг поперечных проездов (0 = нет), м.
        pallets_per_dock_day: Пропускная способность одного дока, паллет/сут.
        dock_bays: Мест одновременной погрузки/выгрузки у одного дока, шт.
        cell_capacity: Роботов одновременно у точки хранения, шт.
        clearance_m: Запас по ширине проезда для безопасного движения, м.
        max_lanes: Максимум полос на проезд, шт.
        loaded_speed_factor: Скорость с грузом / без груза, коэф.
        turn_penalty_s: Потеря времени на манёвр (старт с места, поворот >30°),
            с.
        interference_per_100m: Частота помех (люди, ручная техника), на 100 м.
        interference_s: Длительность остановки при помехе, с.
        reroute_after_s: Тайм-аут ожидания занятого проезда до перестроения
            маршрута, с.
        max_reroutes: Макс. число перестроений маршрута на один пробег, шт.
        soc_start: Начальный заряд роботов, доля.
        soc_forced: Порог принудительной зарядки, доля.
        soc_opportunity: Порог оппортунистической зарядки в простое, доля.
        soc_target: Целевой уровень заряда, доля.
        soc_dispatch_min: Мин. заряд для досрочного выхода с зарядки под задачу,
            доля.
        idle_power_factor: Потребление в простое / в работе, коэф.
        tow_time_min: Время эвакуации робота при полном разряде, мин.
        charge_poll_s: Шаг проверки состояния на зарядке, с.
        mtbf_h: Наработка на отказ (MTBF), ч.
        mttr_h: Время восстановления (MTTR), ч.
        evacuation_min: Время уборки отказавшего робота с проезда, мин.
        inbound_share: Доля рейсов приёмки (док → хранение), доля.
        abc_share_a_cells: Доля рейсов в ближние (A) точки; 0 = равномерно,
            доля.
        dispatch_policy: Политика назначения задач.
        sla_wait_min: Норматив ожидания паллеты до начала рейса, мин.
        blocked_share_layout_flag: Порог доли времени в блокировках → «узкое
            место планировки», доля.
        warmup_min: Разогрев модели (исключается из метрик), мин.
        drain_h: Время дренажа очереди после конца рабочего дня, ч.
        monitor_step_s: Шаг записи временных рядов KPI, с.
    """

    # --- Планировка (карты объекта нет → синтетическая) ---
    layout_aspect: float = 2.0
    rack_depth_m: float = 1.1
    storage_spacing_m: float = 10.0
    cross_aisle_every_m: float = 50.0
    pallets_per_dock_day: float = 400.0
    dock_bays: int = 2
    cell_capacity: int = 1
    clearance_m: float = 0.6
    max_lanes: int = 2
    # --- Движение ---
    loaded_speed_factor: float = 0.8
    turn_penalty_s: float = 4.0
    interference_per_100m: float = 0.6
    interference_s: float = 10.0
    reroute_after_s: float = 45.0
    max_reroutes: int = 3
    # --- Энергия ---
    soc_start: float = 1.0
    soc_forced: float = 0.20
    soc_opportunity: float = 0.60
    soc_target: float = 0.90
    soc_dispatch_min: float = 0.45
    idle_power_factor: float = 0.15
    tow_time_min: float = 15.0
    charge_poll_s: float = 60.0
    # --- Надёжность ---
    mtbf_h: float = 38.0
    mttr_h: float = 2.0
    evacuation_min: float = 10.0
    # --- Спрос ---
    inbound_share: float = 0.5
    abc_share_a_cells: float = 0.0  # 0 = равномерное распределение ячеек
    # --- Диспетчеризация ---
    dispatch_policy: str = "nearest_idle"
    # --- Уровень сервиса / критерии вердикта ---
    sla_wait_min: float = 15.0
    blocked_share_layout_flag: float = 0.10
    # --- Прогон ---
    warmup_min: float = 30.0
    drain_h: float = 1.0
    monitor_step_s: float = 60.0
