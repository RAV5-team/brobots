"""Complete source reference for the FCBAS economic workbook v1.1.

For the short reading version, start with economic_inputs.py.

Start with the three dictionaries below:
    raw_inputs        recorded site/catalog data and user selections
    assumptions       norms, team estimates and scenario choices
    calculated_inputs formula definitions grouped by purpose

This is documentation expressed as Python, not a calculation engine. Formula
expressions are strings; importing this module neither reads Excel nor runs them.
No third-party packages are required (Python 3.10+).

Input.example contains the workbook's illustrative value, NOT a production
default. Robot examples are keyed by solution code. None means missing, not zero.
Source labels/notes and units remain in Russian for comparison with Excel.
English keys explain each field; symbol preserves its original workbook name.
Bounds reproduce source Min/Max, not newly validated operating limits.

Formula notation: warehouse/airport/hospital/norms refer to fields across their
subgroups; site is the selected facility, robot the selected catalog record,
scenario the three multipliers, selection the user choices. Bare names refer to
other candidate formulas. replacement_by_handling maps вилы/платформа/буксировка/
кузов to the selected site's four labor_replacement_* assumptions. sqrt, ceil,
floor, min/max and sums have their usual mathematical meaning. Some descriptive
rules use prose. Expressions are not a runnable API and must not be eval'd.

Examples:
    raw_inputs["warehouse"]["location"]["active_area_m2"].example
    assumptions["norms"]["operations"]["operating_speed_factor"].example
    calculated_inputs["candidate"]["productivity"]["cycle_seconds"].expression

See SOURCE_NOTES for workbook limitations and differences from the methodology.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Input:
    """One recorded input or assumption, with its illustrative source value."""

    example: Any
    unit: str
    source: str
    label: str
    symbol: str = ""
    bounds: tuple[float | None, float | None] | None = None
    note: str = ""
    origin: str = ""


@dataclass(frozen=True)
class Formula:
    """A readable relationship plus the original Excel formula where available."""

    expression: str
    unit: str
    source: str
    label: str
    symbol: str = ""
    note: str = ""
    excel: str = ""


WORKBOOK = "ФЦБАС_Экономическая_модель_v1_1.xlsx"
METHODOLOGY = "Методика_экономической_модели_v1_1.docx"
RANKING_NOTE = "Алгоритм_ранжирования_роботов_v1_1.docx"

SOURCE_NOTES = (
    'Source references without a filename point to WORKBOOK. Upstream dataset, CSV, requirements and vendor documents named in its notes are not included in this repository and were not independently verified.',
    'Scope: all named inputs in the three facility blocks, all 32 global norms, all 33 catalog columns (10 products), scenario selections/multipliers and the shared economic relationships. Comparison, sensitivity and summary sheets reuse these definitions.',
    'A formula can depend on an assumption: warehouse route = sqrt(active area), airport route = 2 * sqrt(apron area), fleet salaries equal selected staff salaries, and hospital laundry salary uses orderly salary. These are modeling choices, not new measurements.',
    'Robot estimates follow yellow catalog cells plus explicit notes (including Cognitive working speed and EVOCARGO speed/autonomy). Some fields marked yellow also cite organizer data: they remain unconfirmed here. A Да row flag does not override an estimated field.',
    'Workbook feasibility omits an explicit missing-price check. Methodology section 6 and ranking note section 2 require a catalog price. PUDUBOT-2 has None for price. A future engine must exclude or mark this unresolved before economics, never substitute zero.',
    'Workbook environment check tests minimum temperature only for outdoor work; maximum temperature, noise, turning radius and lift geometry are not checked. These recorded fields must not be interpreted as passed constraints. Handling expression here uses exact tokens; Excel uses substring SEARCH.',
    'Budget and available charging power are warnings in this workbook, not hard exclusions. The separate ranking workbook has an optional hard-budget setting; it is not silently applied here.',
    'Catalog labor replacement is legacy reference data. The selected task and handling method own the calculation coefficient; zero is the workbook fallback for an unknown handling method.',
    'Workbook ROI = cumulative operating benefit / CAPEX, without subtracting initial CAPEX in the numerator. Retained as workbook_roi, not redefined as conventional net-investment ROI. Ratios are fractions (0.10 = 10%).',
    'RaaS includes chargers, service, software, battery replacement and repair in the source cost structure; customer site preparation, integration, training, setup, energy, connectivity and fleet staff remain separate. Depreciation is zero for RaaS in this prototype.',
    'Energy uses a literal 365 days even though warehouse working_days_per_year exists. Baseline OPEX includes target-process payroll only. Debt cost is average-balance interest, not a principal repayment schedule; it repeats in annual OPEX across the horizon.',
    'The source sizes at least one robot for any feasible candidate, even at zero demand; divisible-load trips use max(payload, 1). These are workbook conventions, not recommended missing-data handling. Positive hours, speed, cycle and financing/battery periods are prerequisites for the corresponding formulas.',
    'Battery replacement excludes the final horizon year. ROI/TCO use the resulting count. Cash flow has ten year columns; NPV uses that schedule. Workbook horizon input bounds allow 3 years although methodology requests TCO of at least 5 years; resolve before implementing validation.',
    'The stepwise workbook adds IRR and residual value, and the ranking workbook adds weights/scores. These are extensions, not inputs or formulas silently merged into this economic-workbook dictionary. Ranking note title says v1.1 but its version line says v1.0.',
    'Simulation runs after candidate selection, receiving route, speed, load/unload/lift times, fleet/chargers, autonomy/charging and demand profile. Methodology section 11.3 uses 10% tolerance. Simulation observations remain separate from raw inputs and never overwrite assumptions without user confirmation.',
)


raw_inputs = {
    'warehouse': {
        'location': {
            'total_area_m2': Input(
                example=20000, unit='м²', source='Склад!D6', label='Общая площадь склада', symbol='Skl_S_total',
                bounds=(10000, 100000), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'active_area_m2': Input(
                example=10000, unit='м²', source='Склад!D7', label='Площадь активной (роботизируемой) зоны',
                symbol='Skl_S_active', bounds=(5000, 50000), note='Датасет, лист «Склад» (50% общей площади)',
                origin='датасет',
            ),
            'main_aisle_m': Input(
                example=3.5, unit='м', source='Склад!D8', label='Ширина главных проездов',
                symbol='Skl_aisle_main', bounds=(2.5, 6),
                note='Датасет, лист «Склад» — определяет допустимые габариты робота', origin='датасет',
            ),
            'rack_aisle_m': Input(
                example=2.8, unit='м', source='Склад!D9', label='Ширина рабочих проходов между стеллажами',
                symbol='Skl_aisle_rack', bounds=(1.5, 4.5), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'available_charging_power_kw': Input(
                example=500, unit='кВт', source='Склад!D21', label='Мощность электроснабжения (доступная)',
                symbol='Skl_power_kw', bounds=(100, 3000), note='Датасет, лист «Склад»', origin='датасет',
            ),
        },
        'operations': {
            'shifts_per_day': Input(
                example=2, unit='смен', source='Склад!D10', label='Количество рабочих смен в сутки',
                symbol='Skl_shifts', bounds=(1, 3), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'shift_hours': Input(
                example=11, unit='ч', source='Склад!D11', label='Продолжительность смены (с учётом перерывов)',
                symbol='Skl_shift_h', bounds=(10, 11), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'working_days_per_year': Input(
                example=365, unit='дн.', source='Склад!D12', label='Рабочих дней в году', symbol='Skl_days',
                bounds=(365, 365), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'peak_factor': Input(
                example=1.5, unit='коэф.', source='Склад!D13',
                label='Пиковый коэффициент нагрузки (макс. час / средний час)', symbol='Skl_peak_k',
                bounds=(1.2, 2.5), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'inbound_pallets_per_day': Input(
                example=1000, unit='поддон/сут', source='Склад!D14', label='Объём приёмки',
                symbol='Skl_in_pallets', bounds=(500, 5000), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'outbound_pallets_per_day': Input(
                example=1000, unit='поддон/сут', source='Склад!D15', label='Объём отгрузки',
                symbol='Skl_out_pallets', bounds=(500, 5000), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'oversize_load_share': Input(
                example=0.05, unit='доля', source='Склад!D20',
                label='Доля негабаритных/нестандартных грузов (остаётся ручной)', symbol='Skl_oversize_share',
                bounds=(0, 0.3), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'lift_trip_share': Input(
                example=0, unit='доля', source='Склад!D35', label='Доля рейсов через лифт/подъёмник',
                symbol='Skl_lift_share', bounds=(0, 1), note='Датасет: 1 этаж — лифты не требуются',
                origin='датасет',
            ),
            'one_way_lift_seconds': Input(
                example=0, unit='с', source='Склад!D36', label='Время ожидания + проезда лифта (в один проход)',
                symbol='Skl_lift_time', bounds=(0, 300), note='Не применяется (1 этаж)', origin='датасет',
            ),
        },
        'labor': {
            'forklift_operator_count': Input(
                example=25, unit='чел.', source='Склад!D16',
                label='Операторы погрузчиков (численность, все смены)', symbol='Skl_forklift_ops', bounds=(5, 80),
                note='Датасет, лист «Склад» — целевая функция для автономных погрузчиков', origin='датасет',
            ),
            'forklift_monthly_salary': Input(
                example=120000, unit='руб./мес.', source='Склад!D17',
                label='Средняя з/п оператора погрузчика (gross)', symbol='Skl_sal_forklift',
                bounds=(80000, 170000), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'staff_time_loss_share': Input(
                example=0.25, unit='доля', source='Склад!D18',
                label='Коэффициент потерь рабочего времени (отпуск, болезнь, текучесть)', symbol='Skl_loss_k',
                bounds=(0.15, 0.35), note='Датасет, лист «Склад»', origin='датасет',
            ),
        },
        'task_and_load': {
            'pallet_mass_kg': Input(
                example=800, unit='кг', source='Склад!D19', label='Средняя масса грузовой единицы (паллет)',
                symbol='Skl_pallet_mass', bounds=(200, 1500), note='Датасет, лист «Склад»', origin='датасет',
            ),
            'outdoor_required': Input(
                example=0, unit='1/0', source='Склад!D39', label='Требуется уличная эксплуатация (1/0)',
                symbol='Skl_outdoor_req', bounds=(0, 1), note='Склад — закрытое отапливаемое помещение',
                origin='датасет',
            ),
            'task_class': Input(
                example='транспорт', unit='', source='Склад!D40', label='Класс задачи процесса',
                symbol='Skl_task_class', note='транспорт (рейсы) / уборка (площадь)', origin='датасет',
            ),
            'indoor_required': Input(
                example=1, unit='1/0', source='Склад!D42', label='Работа внутри помещений (1/0)',
                symbol='Skl_indoor_req', bounds=(0, 1),
                note='Уличные гибриды/грузовики не допускаются в помещения', origin='датасет',
            ),
        },
        'economics': {
            'budget_million_rub': Input(
                example=80, unit='млн руб.', source='Склад!D22',
                label='Планируемый бюджет на роботизацию (CAPEX)', symbol='Skl_budget', bounds=(10, 500),
                note='Датасет, лист «Склад»', origin='датасет',
            ),
            'horizon_years': Input(
                example=5, unit='лет', source='Склад!D23', label='Горизонт расчёта окупаемости',
                symbol='Skl_horizon', bounds=(3, 10), note='Датасет, лист «Склад»', origin='датасет',
            ),
        },
    },
    'airport': {
        'location': {
            'terminal_area_m2': Input(
                example=85000, unit='м²', source='Аэропорт!D6', label='Суммарная площадь терминала(ов)',
                symbol='Aer_S_terminal', bounds=(8000, 500000), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'apron_area_m2': Input(
                example=100000, unit='м²', source='Аэропорт!D7', label='Площадь перрона и технических зон',
                symbol='Aer_S_apron', bounds=(10000, 800000), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'gate_count': Input(
                example=20, unit='шт.', source='Аэропорт!D8', label='Количество выходов на посадку',
                symbol='Aer_gates', bounds=(8, 50), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'recorded_min_temperature_c': Input(
                example=-25, unit='°C', source='Аэропорт!D16',
                label='Температура в неотапливаемых зонах (перрон, зима)', symbol='Aer_temp_min_ds',
                bounds=(-40, 0), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'noise_limit_dba': Input(
                example=70, unit='дБА', source='Аэропорт!D17', label='Ограничение по уровню шума',
                symbol='Aer_noise', bounds=(55, 80), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'available_charging_power_kw': Input(
                example=300, unit='кВт', source='Аэропорт!D18',
                label='Доступная мощность для зарядной инфраструктуры', symbol='Aer_power_kw', bounds=(50, 2000),
                note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
        },
        'operations': {
            'flights_per_day': Input(
                example=280, unit='рейсов/сут', source='Аэропорт!D9',
                label='Среднесуточное количество рейсов (взлёт+посадка)', symbol='Aer_flights_day',
                bounds=(30, 1200), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'peak_flights_per_hour': Input(
                example=32, unit='рейсов/ч', source='Аэропорт!D10', label='Пиковое количество рейсов в час',
                symbol='Aer_flights_peak_h', bounds=(4, 120), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'bags_per_day': Input(
                example=35000, unit='ед./сут', source='Аэропорт!D11', label='Объём перемещения багажа',
                symbol='Aer_bags_day', bounds=(3000, 300000), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'lift_trip_share': Input(
                example=0, unit='доля', source='Аэропорт!D34', label='Доля рейсов через лифт',
                symbol='Aer_lift_share', bounds=(0, 1), note='Не применяется (перрон)', origin='датасет',
            ),
            'one_way_lift_seconds': Input(
                example=0, unit='с', source='Аэропорт!D35', label='Время лифта', symbol='Aer_lift_time',
                bounds=(0, 300), note='Не применяется', origin='датасет',
            ),
        },
        'task_and_load': {
            'bag_mass_kg': Input(
                example=18, unit='кг', source='Аэропорт!D12', label='Средняя масса единицы багажа',
                symbol='Aer_bag_mass', bounds=(10, 35), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'outdoor_required': Input(
                example=1, unit='1/0', source='Аэропорт!D38', label='Требуется уличная эксплуатация (1/0)',
                symbol='Aer_outdoor_req', bounds=(0, 1),
                note='Перрон — открытая зона (датасет: ограничения по погоде и допускам)', origin='датасет',
            ),
            'task_class': Input(
                example='транспорт', unit='', source='Аэропорт!D39', label='Класс задачи процесса',
                symbol='Aer_task_class', note='транспорт (рейсы) / уборка (площадь)', origin='датасет',
            ),
            'indoor_required': Input(
                example=0, unit='1/0', source='Аэропорт!D41', label='Работа внутри помещений (1/0)',
                symbol='Aer_indoor_req', bounds=(0, 1),
                note='Уличные гибриды/грузовики не допускаются в помещения', origin='датасет',
            ),
        },
        'labor': {
            'ramp_staff_count': Input(
                example=320, unit='чел.', source='Аэропорт!D13',
                label='Численность персонала наземного обслуживания (рамп)', symbol='Aer_ramp_staff',
                bounds=(50, 2000), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'ramp_monthly_salary': Input(
                example=100000, unit='руб./мес.', source='Аэропорт!D14',
                label='Средняя з/п сотрудника наземного обслуживания (gross)', symbol='Aer_sal_ramp',
                bounds=(70000, 150000), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'recorded_staff_turnover': Input(
                example=0.35, unit='доля', source='Аэропорт!D15', label='Годовая текучесть персонала',
                symbol='Aer_turnover_ds', bounds=(0.15, 0.6), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
        },
        'economics': {
            'budget_million_rub': Input(
                example=120, unit='млн руб.', source='Аэропорт!D19',
                label='Планируемый бюджет на роботизацию (CAPEX)', symbol='Aer_budget', bounds=(20, 800),
                note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
            'horizon_years': Input(
                example=7, unit='лет', source='Аэропорт!D20', label='Горизонт расчёта окупаемости',
                symbol='Aer_horizon', bounds=(5, 15), note='Датасет, лист «Аэропорт»', origin='датасет',
            ),
        },
    },
    'hospital': {
        'location': {
            'total_area_m2': Input(
                example=45000, unit='м²', source='Медучреждение!D6', label='Общая площадь здания(й)',
                symbol='Med_S_total', bounds=(3000, 200000), note='Датасет, лист «Медучреждение»',
                origin='датасет',
            ),
            'floor_count': Input(
                example=9, unit='шт.', source='Медучреждение!D7', label='Количество этажей (основной корпус)',
                symbol='Med_floors', bounds=(3, 20), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'lift_count': Input(
                example=4, unit='шт.', source='Медучреждение!D8',
                label='Количество лифтов (грузовых/медицинских)', symbol='Med_lifts', bounds=(1, 12),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'bed_count': Input(
                example=650, unit='коек', source='Медучреждение!D9', label='Количество коек', symbol='Med_beds',
                bounds=(50, 2500), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'corridor_width_m': Input(
                example=2.4, unit='м', source='Медучреждение!D26', label='Ширина коридоров (основных)',
                symbol='Med_corridor', bounds=(1.8, 3.5), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'night_noise_limit_dba': Input(
                example=30, unit='дБА', source='Медучреждение!D27',
                label='Требования к уровню шума в палатах (ночь)', symbol='Med_noise', bounds=(25, 40),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'available_charging_power_kw': Input(
                example=80, unit='кВт', source='Медучреждение!D28',
                label='Доступная мощность для зарядной инфраструктуры', symbol='Med_power_kw', bounds=(15, 400),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'operating_min_temperature_c': Input(
                example=18, unit='°C', source='Медучреждение!D60', label='Минимальная температура',
                symbol='Med_temp_min', bounds=(0, 25), note='Отапливаемое здание', origin='датасет',
            ),
        },
        'operations': {
            'feedings_per_day': Input(
                example=3, unit='раз/сут', source='Медучреждение!D10', label='Количество кормлений в сутки',
                symbol='Med_feedings', bounds=(3, 5), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'food_delivery_points': Input(
                example=18, unit='шт.', source='Медучреждение!D11',
                label='Количество точек раздачи питания (отделений)', symbol='Med_food_points', bounds=(4, 60),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'food_route_m': Input(
                example=180, unit='м', source='Медучреждение!D12',
                label='Среднее расстояние от пищеблока до отделения', symbol='Med_L_food', bounds=(30, 500),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'linen_delivery_points': Input(
                example=18, unit='шт.', source='Медучреждение!D14', label='Количество точек сбора/выдачи белья',
                symbol='Med_linen_points', bounds=(4, 60), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'linen_cycles_per_day': Input(
                example=1.3, unit='раз/сут', source='Медучреждение!D15', label='Периодичность смены белья',
                symbol='Med_linen_freq', bounds=(1, 3), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'supply_trips_per_day': Input(
                example=45, unit='рейсов/сут', source='Медучреждение!D17',
                label='Объём доставки расходных материалов', symbol='Med_supplies_trips', bounds=(10, 200),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'waste_collection_points': Input(
                example=20, unit='шт.', source='Медучреждение!D18', label='Количество точек сбора отходов',
                symbol='Med_waste_points', bounds=(4, 70), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'waste_cycles_per_day': Input(
                example=2, unit='раз/сут', source='Медучреждение!D19',
                label='Периодичность вывоза отходов из отделений', symbol='Med_waste_freq', bounds=(1, 4),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'shifts_per_day': Input(
                example=3, unit='смен', source='Медучреждение!D34', label='Смен в сутки (стационар 24/7)',
                symbol='Med_shifts', bounds=(2, 3), note='Датасет: 3 смены медперсонала', origin='датасет',
            ),
        },
        'task_and_load': {
            'food_cart_mass_kg': Input(
                example=120, unit='кг', source='Медучреждение!D13',
                label='Средняя масса тележки с питанием (брутто)', symbol='Med_cart_mass', bounds=(40, 250),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'linen_container_mass_kg': Input(
                example=55, unit='кг', source='Медучреждение!D16', label='Средняя масса контейнера с бельём',
                symbol='Med_linen_mass', bounds=(20, 120), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'outdoor_required': Input(
                example=0, unit='1/0', source='Медучреждение!D52', label='Требуется уличная эксплуатация',
                symbol='Med_outdoor_req', bounds=(0, 1), note='Внутрибольничная логистика', origin='датасет',
            ),
            'task_class': Input(
                example='транспорт', unit='', source='Медучреждение!D53', label='Класс задачи процесса',
                symbol='Med_task_class', note='транспорт (рейсы) / уборка (площадь)', origin='датасет',
            ),
            'indoor_required': Input(
                example=1, unit='1/0', source='Медучреждение!D55', label='Работа внутри помещений (1/0)',
                symbol='Med_indoor_req', bounds=(0, 1),
                note='Уличные гибриды/грузовики не допускаются в помещения', origin='датасет',
            ),
        },
        'labor': {
            'orderly_count': Input(
                example=65, unit='чел.', source='Медучреждение!D20',
                label='Численность санитаров и транспортировщиков', symbol='Med_orderlies', bounds=(10, 300),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'kitchen_staff_count': Input(
                example=28, unit='чел.', source='Медучреждение!D21',
                label='Численность сотрудников пищеблока (раздача)', symbol='Med_kitchen', bounds=(5, 100),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'laundry_staff_count': Input(
                example=18, unit='чел.', source='Медучреждение!D22',
                label='Численность сотрудников прачечной (транспорт белья)', symbol='Med_laundry', bounds=(3, 60),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'orderly_monthly_salary': Input(
                example=55000, unit='руб./мес.', source='Медучреждение!D23',
                label='Средняя з/п санитара/транспортировщика (gross)', symbol='Med_sal_orderly',
                bounds=(38000, 85000), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'kitchen_monthly_salary': Input(
                example=52000, unit='руб./мес.', source='Медучреждение!D24',
                label='Средняя з/п сотрудника пищеблока (gross)', symbol='Med_sal_kitchen', bounds=(35000, 75000),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'recorded_staff_turnover': Input(
                example=0.45, unit='доля', source='Медучреждение!D25',
                label='Годовая текучесть немедицинского персонала', symbol='Med_turnover_ds', bounds=(0.2, 0.7),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
        },
        'economics': {
            'budget_million_rub': Input(
                example=35, unit='млн руб.', source='Медучреждение!D29',
                label='Планируемый бюджет на роботизацию (CAPEX)', symbol='Med_budget', bounds=(5, 200),
                note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
            'horizon_years': Input(
                example=7, unit='лет', source='Медучреждение!D30', label='Горизонт расчёта окупаемости',
                symbol='Med_horizon', bounds=(5, 15), note='Датасет, лист «Медучреждение»', origin='датасет',
            ),
        },
    },
    'robots': {
        'identity_and_price': {
            'code': Input(
                example={'DMR-CARRIER-P': 'DMR-CARRIER-P', 'AK-2000-2': 'AK-2000-2', 'RONAVI-H1500': 'RONAVI-H1500', 'RONAVI-M': 'RONAVI-M', 'MOROS-AMR800': 'MOROS-AMR800', 'RONAVI-SD': 'RONAVI-SD', 'PUDUBOT-2': 'PUDUBOT-2', 'COGNITIVE-TUG': 'COGNITIVE-TUG', 'EVOCARGO-N1': 'EVOCARGO-N1', 'MARK-2-SE': 'MARK-2-SE'},
                unit='', source='Каталог!A4:A13', label='Код решения',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'name': Input(
                example={'DMR-CARRIER-P': 'DMR Carrier P (FMR, вилочный AMR)', 'AK-2000-2': 'AK-2000-2 (FMR)', 'RONAVI-H1500': 'Ronavi H1500 (AMR, до 1500 кг)', 'RONAVI-M': 'Ronavi M (AMR для стеллажей/тележек, до 1200 кг)', 'MOROS-AMR800': 'AMR 800 (Морос, до 800 кг)', 'RONAVI-SD': 'Ronavi SD (AMR, до 10 кг)', 'PUDUBOT-2': 'PuduBot 2 (робот-доставщик)', 'COGNITIVE-TUG': 'Беспилотный тягач (Cognitive Pilot)', 'EVOCARGO-N1': 'EVOCARGO N1 (беспилотный электрогрузовик)', 'MARK-2-SE': 'MARK 2 SE (робот-уборщик)'},
                unit='', source='Каталог!B4:B13', label='Наименование',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'manufacturer': Input(
                example={'DMR-CARRIER-P': 'ООО "Диком-Сервис"', 'AK-2000-2': 'ООО "ГК Автомакон"', 'RONAVI-H1500': 'ООО "Ронави Роботикс"', 'RONAVI-M': 'ООО "Ронави Роботикс"', 'MOROS-AMR800': 'ООО "Морос"', 'RONAVI-SD': 'ООО "Ронави Роботикс"', 'PUDUBOT-2': 'Pudu Robotics (внешний)', 'COGNITIVE-TUG': 'АО "Когнитив Пилот"', 'EVOCARGO-N1': 'ООО "Эвокарго"', 'MARK-2-SE': 'ООО "Р2Б"'},
                unit='', source='Каталог!C4:C13', label='Производитель',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'type': Input(
                example={'DMR-CARRIER-P': 'Мобильные роботы', 'AK-2000-2': 'Автономные наземные ТС', 'RONAVI-H1500': 'Мобильные роботы', 'RONAVI-M': 'Мобильные роботы', 'MOROS-AMR800': 'Мобильные роботы', 'RONAVI-SD': 'Мобильные роботы', 'PUDUBOT-2': 'Мобильные роботы', 'COGNITIVE-TUG': 'Автономные наземные ТС', 'EVOCARGO-N1': 'Автономные наземные ТС', 'MARK-2-SE': 'Мобильные роботы'},
                unit='', source='Каталог!D4:D13', label='Тип',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'subtype': Input(
                example={'DMR-CARRIER-P': 'FMR', 'AK-2000-2': 'FMR', 'RONAVI-H1500': 'AMR', 'RONAVI-M': 'AMR', 'MOROS-AMR800': 'AMR', 'RONAVI-SD': 'AMR', 'PUDUBOT-2': 'Робот-доставщик', 'COGNITIVE-TUG': 'Беспилотный тягач', 'EVOCARGO-N1': 'Беспилотный грузовик', 'MARK-2-SE': 'Робот-уборщик'},
                unit='', source='Каталог!E4:E13', label='Подтип',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'catalog_scenario': Input(
                example={'DMR-CARRIER-P': 'Внутрискладская логистика', 'AK-2000-2': 'Внутрискладская логистика', 'RONAVI-H1500': 'Внутрискладская логистика', 'RONAVI-M': 'Внутрискладская логистика', 'MOROS-AMR800': 'Внутрискладская логистика', 'RONAVI-SD': 'Внутрискладская логистика', 'PUDUBOT-2': 'Доставка внутри помещений', 'COGNITIVE-TUG': 'Перевозка грузов на закрытых площадках', 'EVOCARGO-N1': 'Перевозка грузов на закрытых площадках', 'MARK-2-SE': 'Уборка помещений'},
                unit='', source='Каталог!F4:F13', label='Сценарий (каталог)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'catalog_status': Input(
                example={'DMR-CARRIER-P': 'piloting', 'AK-2000-2': 'operation', 'RONAVI-H1500': 'operation', 'RONAVI-M': 'piloting', 'MOROS-AMR800': 'operation', 'RONAVI-SD': 'piloting', 'PUDUBOT-2': 'внешний источник', 'COGNITIVE-TUG': 'operation', 'EVOCARGO-N1': 'operation', 'MARK-2-SE': 'operation'},
                unit='', source='Каталог!G4:G13', label='Статус (каталог)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'technology_readiness': Input(
                example={'DMR-CARRIER-P': 8, 'AK-2000-2': 9, 'RONAVI-H1500': 8, 'RONAVI-M': 7, 'MOROS-AMR800': 9, 'RONAVI-SD': 8, 'PUDUBOT-2': None, 'COGNITIVE-TUG': 8, 'EVOCARGO-N1': 9, 'MARK-2-SE': 9},
                unit='', source='Каталог!H4:H13', label='УГТ',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'market_potential': Input(
                example={'DMR-CARRIER-P': 4, 'AK-2000-2': 4, 'RONAVI-H1500': 4, 'RONAVI-M': 4, 'MOROS-AMR800': 4, 'RONAVI-SD': 4, 'PUDUBOT-2': None, 'COGNITIVE-TUG': 3, 'EVOCARGO-N1': 5, 'MARK-2-SE': 4},
                unit='', source='Каталог!I4:I13', label='Рын. потенциал',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'price_rub': Input(
                example={'DMR-CARRIER-P': 4300000, 'AK-2000-2': 2940000, 'RONAVI-H1500': 2700000, 'RONAVI-M': 2400000, 'MOROS-AMR800': 1800000, 'RONAVI-SD': 1400000, 'PUDUBOT-2': None, 'COGNITIVE-TUG': 4000000, 'EVOCARGO-N1': 6000000, 'MARK-2-SE': 1900000},
                unit='RUB', source='Каталог!J4:J13', label='Цена изделия, руб. (с НДС)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified. VAT included; delivery and commissioning excluded. None means no catalog price.',
                origin='catalog snapshot',
            ),
        },
        'specifications': {
            'payload_kg': Input(
                example={'RONAVI-H1500': 1500, 'RONAVI-SD': 10, 'COGNITIVE-TUG': 3000, 'EVOCARGO-N1': 2000, 'MARK-2-SE': 0},
                unit='kg', source='Каталог!K4:K13', label='Грузоподъёмность, кг',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'max_speed_mps': Input(
                example={'RONAVI-H1500': 1.5, 'RONAVI-SD': 2.5, 'MARK-2-SE': 1}, unit='m/s',
                source='Каталог!L4:L13', label='Макс. скорость, м/с',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'autonomy_hours': Input(
                example={'RONAVI-H1500': 6, 'RONAVI-SD': 10, 'COGNITIVE-TUG': 24, 'MARK-2-SE': 3}, unit='h',
                source='Каталог!M4:M13', label='Автономность, ч',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'charging_minutes': Input(
                example={'RONAVI-H1500': 18, 'RONAVI-SD': 60, 'COGNITIVE-TUG': 30, 'EVOCARGO-N1': 30, 'MARK-2-SE': 120},
                unit='min', source='Каталог!N4:N13', label='Время зарядки, мин',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'length_mm': Input(
                example={'RONAVI-H1500': 1044, 'RONAVI-SD': 420, 'COGNITIVE-TUG': 2300, 'EVOCARGO-N1': 5000, 'MARK-2-SE': 860},
                unit='mm', source='Каталог!O4:O13', label='Длина, мм',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'width_mm': Input(
                example={'RONAVI-H1500': 654, 'RONAVI-SD': 400, 'COGNITIVE-TUG': 1400, 'EVOCARGO-N1': 1800, 'MARK-2-SE': 610},
                unit='mm', source='Каталог!P4:P13', label='Ширина, мм',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'height_mm': Input(
                example={'RONAVI-H1500': 380, 'RONAVI-SD': 200, 'COGNITIVE-TUG': 1500, 'EVOCARGO-N1': 2200, 'MARK-2-SE': 980},
                unit='mm', source='Каталог!Q4:Q13', label='Высота, мм',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'min_temperature_c': Input(
                example={'RONAVI-H1500': 5, 'RONAVI-SD': 5, 'COGNITIVE-TUG': -40, 'EVOCARGO-N1': -40, 'MARK-2-SE': 5},
                unit='°C', source='Каталог!R4:R13', label='Темп. мин, °C',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'max_temperature_c': Input(
                example={'RONAVI-H1500': 25, 'RONAVI-SD': 30, 'COGNITIVE-TUG': 45, 'EVOCARGO-N1': 50, 'MARK-2-SE': 35},
                unit='°C', source='Каталог!S4:S13', label='Темп. макс, °C',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'outdoor_allowed': Input(
                example={'DMR-CARRIER-P': 0, 'AK-2000-2': 0, 'RONAVI-H1500': 0, 'RONAVI-M': 0, 'MOROS-AMR800': 0, 'RONAVI-SD': 0, 'PUDUBOT-2': 0, 'COGNITIVE-TUG': 1, 'EVOCARGO-N1': 1, 'MARK-2-SE': 0},
                unit='1/0', source='Каталог!Y4:Y13', label='Уличная эксплуатация (1/0)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'indoor_allowed': Input(
                example={'DMR-CARRIER-P': 1, 'AK-2000-2': 1, 'RONAVI-H1500': 1, 'RONAVI-M': 1, 'MOROS-AMR800': 1, 'RONAVI-SD': 1, 'PUDUBOT-2': 1, 'COGNITIVE-TUG': 0, 'EVOCARGO-N1': 0, 'MARK-2-SE': 1},
                unit='1/0', source='Каталог!Z4:Z13', label='Допуск в помещения (1/0)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'handling_method': Input(
                example={'DMR-CARRIER-P': 'вилы', 'AK-2000-2': 'вилы', 'RONAVI-H1500': 'платформа', 'RONAVI-M': 'платформа', 'MOROS-AMR800': 'платформа', 'RONAVI-SD': 'кузов', 'PUDUBOT-2': 'кузов', 'COGNITIVE-TUG': 'буксировка', 'EVOCARGO-N1': 'кузов', 'MARK-2-SE': 'щётки'},
                unit='', source='Каталог!AA4:AA13', label='Способ обработки груза',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'task_class': Input(
                example={'DMR-CARRIER-P': 'транспорт', 'AK-2000-2': 'транспорт', 'RONAVI-H1500': 'транспорт', 'RONAVI-M': 'транспорт', 'MOROS-AMR800': 'транспорт', 'RONAVI-SD': 'транспорт', 'PUDUBOT-2': 'транспорт', 'COGNITIVE-TUG': 'транспорт', 'EVOCARGO-N1': 'транспорт', 'MARK-2-SE': 'уборка'},
                unit='', source='Каталог!AB4:AB13', label='Класс задачи',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'navigation': Input(
                example={'DMR-CARRIER-P': 'SLAM (лидары)', 'AK-2000-2': 'SLAM', 'RONAVI-H1500': 'QR-метки + SLAM', 'RONAVI-M': 'QR-метки + SLAM', 'MOROS-AMR800': 'SLAM', 'RONAVI-SD': 'QR-метки', 'PUDUBOT-2': 'VSLAM + лазерный SLAM', 'COGNITIVE-TUG': 'Мультисенсорный автопилот', 'EVOCARGO-N1': 'Автопилот L4–5', 'MARK-2-SE': 'Лидар + камеры'},
                unit='', source='Каталог!AC4:AC13', label='Тип навигации',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
        },
        'reference_only': {
            'advertised_productivity': Input(
                example={'DMR-CARRIER-P': '40–60 паллет/ч (типичный проект, докс организатора)', 'AK-2000-2': 'Кейс: 67 роботов в РЦ X5 «Новая Рига»', 'RONAVI-H1500': '80–100 паллет/ч (типовая конфигурация зоны, docx)', 'RONAVI-M': '—', 'MOROS-AMR800': 'Кейс: 27 роботов на складах e-commerce', 'RONAVI-SD': '—', 'PUDUBOT-2': '10 кг на полку', 'COGNITIVE-TUG': 'Кейс: 45 тягачей для Пулково (перевозка багажа)', 'EVOCARGO-N1': '6 европаллет; запас хода 150–200 км', 'MARK-2-SE': 'до 1000 м²/ч'},
                unit='', source='Каталог!U4:U13', label='Заявленная производительность (справочно)',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
        },
        'evidence': {
            'specification_source': Input(
                example={'DMR-CARRIER-P': 'Docx организатора (пример FMR); цена — CSV каталога', 'AK-2000-2': 'ТТХ приняты по аналогу FMR (DMR Carrier P) — ТРЕБУЕТ ПРОВЕРКИ по сайту производителя', 'RONAVI-H1500': 'Docx организатора; цена — CSV каталога', 'RONAVI-M': 'Описание каталога (назначение, грузоподъёмность); остальные ТТХ по аналогу H1500 — ТРЕБУЮТ ПРОВЕРКИ', 'MOROS-AMR800': 'Описание каталога (AMR 1500: 1100×600×230, 1.5 м/с, проезд от 680 мм, 22 ч) — приняты по аналогу для AMR 800; ТРЕБУЮТ ПРОВЕРКИ', 'RONAVI-SD': 'Docx организатора (пример для медучреждения)', 'PUDUBOT-2': 'Docx организатора; цены в каталоге ФЦ БАС нет', 'COGNITIVE-TUG': 'Docx организатора; цена — CSV каталога', 'EVOCARGO-N1': 'Docx организатора; цена — CSV каталога', 'MARK-2-SE': 'Docx организатора; цена — CSV каталога'},
                unit='', source='Каталог!AD4:AD13', label='Источник ТТХ',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'confirmation_status': Input(
                example={'DMR-CARRIER-P': 'Частично', 'AK-2000-2': 'Нет', 'RONAVI-H1500': 'Да', 'RONAVI-M': 'Частично', 'MOROS-AMR800': 'Частично', 'RONAVI-SD': 'Да', 'PUDUBOT-2': 'Частично', 'COGNITIVE-TUG': 'Да', 'EVOCARGO-N1': 'Да', 'MARK-2-SE': 'Да'},
                unit='', source='Каталог!AE4:AE13', label='ТТХ подтверждены',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'updated_on': Input(
                example={'DMR-CARRIER-P': '2026-09-16', 'AK-2000-2': '2026-09-16', 'RONAVI-H1500': '2026-09-16', 'RONAVI-M': '2026-09-16', 'MOROS-AMR800': '2026-09-16', 'RONAVI-SD': '2026-09-16', 'PUDUBOT-2': '2026-09-16', 'COGNITIVE-TUG': '2026-09-16', 'EVOCARGO-N1': '2026-09-16', 'MARK-2-SE': '2026-09-16'},
                unit='', source='Каталог!AF4:AF13', label='Дата актуализации',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
            'source_notes': Input(
                example={'DMR-CARRIER-P': 'Габариты в docx даны как В×Ш×Г 2050×1975×1000 — принято: длина 1975, ширина 1000. Время зарядки, темп. диапазон, мощность, времена операций — допущения команды.', 'AK-2000-2': 'В каталоге ТТХ отсутствуют; по Дополнениям п.4 недостающие ТТХ заполняются из открытых источников. До подтверждения — решение помечается «требует проверки».', 'RONAVI-H1500': 'Робот подъёмного типа: требует передачи паллет через станции/конвейер (не забирает с пола) — отсюда коэф. замещения 0.6 и повышенная доля подготовки объекта.', 'RONAVI-M': 'Робот с поворотным кругом для транспортировки мобильных стеллажей/столиков — подходит под больничные тележки (подъезд под тележку).', 'MOROS-AMR800': 'Подходит под перевозку тележек до 800 кг.', 'RONAVI-SD': 'Мин. ширина проезда 700 мм. Применим только для лёгкой доставки (медикаменты, пробы) — исключается фильтром по грузоподъёмности для процесса «тележки».', 'PUDUBOT-2': 'Нет цены в каталоге организатора → в расчёт не включается без ввода цены; отсутствует в реестре отечественных решений.', 'COGNITIVE-TUG': 'Гибридная СУ: «энергия» смоделирована как эквивалент 6 кВт·ч/ч работы (топливо+электро) — допущение. Скорость принята рабочая 15 км/ч (4.17 м/с) из диапазона 5–25 км/ч. Время сцепки/расцепки тележек 180 с — допущение.', 'EVOCARGO-N1': 'Автономность 8 ч оценена из АКБ 36 кВт·ч при 6 кВт·ч/ч (допущение). Скорость принята 20 км/ч (5.56 м/с). Погрузка/разгрузка 240 с — допущение (перегрузка багажных контейнеров).', 'MARK-2-SE': 'Для процесса «уборка» (расчёт по площади, не по рейсам) — в демо-сценарии не используется; включён для полноты каталога и расширения модели.'},
                unit='', source='Каталог!AG4:AG13', label='Примечание / допущения',
                note='Recorded in the workbook; upstream catalog/vendor evidence has not been independently verified.',
                origin='catalog snapshot',
            ),
        },
    },
    'selection': {
        'facility_type': Input(
            example='warehouse', unit='', source='Легенда!B4',
            label='Selected facility: warehouse, airport or hospital.', origin='user selection',
        ),
        'solution_code': Input(
            example='DMR-CARRIER-P', unit='', source='Склад!E63', label='Selected catalog solution code.',
            origin='user selection',
        ),
        'acquisition_model': Input(
            example='purchase', unit='', source='Склад!E64', label='purchase or raas; maps to Покупка / RaaS.',
            origin='user selection',
        ),
    },
}


assumptions = {
    'warehouse': {
        'task_and_load': {
            'load_is_divisible': Input(
                example=0, unit='1/0', source='Склад!D32',
                label='Груз делимый на несколько рейсов (1) / неделимый (0)', symbol='Skl_divisible',
                bounds=(0, 1),
                note='Допущение: паллет неделим — при недостаточной грузоподъёмности решение исключается',
                origin='допущение',
            ),
            'allowed_handling_methods': Input(
                example='вилы;платформа', unit='', source='Склад!D41',
                label='Допустимые способы обработки груза (через ;)', symbol='Skl_handling_req',
                note='Допущение команды: паллет с пола — вилы; платформа — через станции передачи (часть труда остаётся → 0.6)',
                origin='допущение',
            ),
        },
        'operations': {
            'site_speed_limit_mps': Input(
                example=1.5, unit='м/с', source='Склад!D34', label='Ограничение скорости на объекте',
                symbol='Skl_speed_cap', bounds=(0.5, 2),
                note='Допущение: 1.5 м/с — типовой лимит для AMR/FMR в зонах с людьми', origin='допущение',
            ),
        },
        'location': {
            'aisle_clearance_m': Input(
                example=0.6, unit='м', source='Склад!D38',
                label='Запас по ширине проезда для безопасного движения', symbol='Skl_clearance', bounds=(0.3, 1),
                note='Допущение команды (по 0.3 м с каждой стороны)', origin='допущение',
            ),
            'operating_min_temperature_c': Input(
                example=5, unit='°C', source='Склад!D47', label='Минимальная температура в зоне работы',
                symbol='Skl_temp_min', bounds=(-30, 25), note='Допущение: отапливаемый склад', origin='допущение',
            ),
        },
        'labor': {
            'labor_replacement_forks': Input(
                example=0.8, unit='доля', source='Склад!D43', label='Коэф. замещения труда: вилы',
                symbol='Skl_repl_forks', bounds=(0.5, 0.9),
                note='Допущение команды: полный цикл без станций; остаются высотные/нестандартные операции',
                origin='допущение',
            ),
            'labor_replacement_platform': Input(
                example=0.6, unit='доля', source='Склад!D44',
                label='Коэф. замещения труда: платформа (подъём/станции передачи)', symbol='Skl_repl_platform',
                bounds=(0.4, 0.9), note='Допущение команды', origin='допущение',
            ),
            'labor_replacement_towing': Input(
                example=0.8, unit='доля', source='Склад!D45', label='Коэф. замещения труда: буксировка',
                symbol='Skl_repl_tow', bounds=(0.5, 0.9),
                note='Допущение команды: сцепка тележек остаётся ручной', origin='допущение',
            ),
            'labor_replacement_body': Input(
                example=0.5, unit='доля', source='Склад!D46', label='Коэф. замещения труда: кузов',
                symbol='Skl_repl_body', bounds=(0.3, 0.9),
                note='Допущение команды: ручная погрузка/выгрузка кузова', origin='допущение',
            ),
            'transport_work_share': Input(
                example=1, unit='доля', source='Склад!D49',
                label='Доля рабочего времени операторов погрузчиков, приходящаяся на перемещение паллет',
                symbol='Skl_func_share', bounds=(0.5, 1),
                note='Допущение команды: целевая функция полностью совпадает с процессом', origin='допущение',
            ),
            'annual_staff_turnover': Input(
                example=0, unit='доля', source='Склад!D53', label='Годовая текучесть целевого персонала',
                symbol='Skl_turnover', bounds=(0, 0.6),
                note='В датасете «Склад» показатель отсутствует → принято 0 (эффект не учитывается); при наличии данных — ввести',
                origin='допущение',
            ),
            'fleet_operators_per_shift': Input(
                example=1, unit='чел./смену', source='Склад!D54',
                label='Операторы флота роботов (диспетчер/техник) на смену', symbol='Skl_fleet_per_shift',
                bounds=(0, 3), note='Допущение команды', origin='допущение',
            ),
        },
        'economics': {
            'site_preparation_share': Input(
                example=0.05, unit='доля', source='Склад!D56',
                label='Подготовка объекта (разметка, QR-метки, Wi-Fi, ворота), % от стоимости парка',
                symbol='Skl_site_pct', bounds=(0.02, 0.15), note='Допущение команды', origin='допущение',
            ),
            'integration_cost': Input(
                example=2000000, unit='руб.', source='Склад!D57', label='Интеграция с WMS / 1С:ERP',
                symbol='Skl_integration', bounds=(500000, 6000000),
                note='Допущение команды (оценка рынка интеграторов; датасет: WMS есть, 1С:ERP через REST/COM)',
                origin='допущение',
            ),
            'annual_consumables_per_robot': Input(
                example=0, unit='руб./год', source='Склад!D58', label='Расходные материалы на робота в год',
                symbol='Skl_consum_per_robot', bounds=(0, 200000),
                note='Для складских AMR/FMR отдельные расходники не выделяются (учтены в сервисе)',
                origin='допущение',
            ),
            'annual_other_benefits': Input(
                example=0, unit='руб./год', source='Склад!D59',
                label='Иные измеримые эффекты (снижение ошибок, потерь, ускорение оборота)',
                symbol='Skl_other_effects', bounds=(0, None),
                note='Ввод пользователя; в датасете нет данных о стоимости ошибок → 0 (консервативно)',
                origin='допущение',
            ),
        },
    },
    'airport': {
        'operations': {
            'shifts_per_day': Input(
                example=3, unit='смен', source='Аэропорт!D24',
                label='Смен в сутки (круглосуточная работа аэропорта)', symbol='Aer_shifts', bounds=(2, 3),
                note='Допущение команды: режим 24/7, 3 смены по 8 ч', origin='допущение',
            ),
            'shift_hours': Input(
                example=8, unit='ч', source='Аэропорт!D25', label='Продолжительность смены', symbol='Aer_shift_h',
                bounds=(8, 12), note='Допущение команды', origin='допущение',
            ),
            'automatable_share': Input(
                example=0.9, unit='доля', source='Аэропорт!D29', label='Доля автоматизируемых операций',
                symbol='Aer_auto_share', bounds=(0.5, 1),
                note='Допущение: 10% рейсов (нестандартные стоянки, спецрейсы) остаются ручными',
                origin='допущение',
            ),
            'site_speed_limit_mps': Input(
                example=4.17, unit='м/с', source='Аэропорт!D33', label='Ограничение скорости на перроне',
                symbol='Aer_speed_cap', bounds=(2, 7),
                note='Допущение: 15 км/ч — типовой лимит для перронной техники', origin='допущение',
            ),
        },
        'task_and_load': {
            'load_is_divisible': Input(
                example=1, unit='1/0', source='Аэропорт!D31',
                label='Груз делимый (1): багаж рейса можно везти несколькими рейсами робота',
                symbol='Aer_divisible', bounds=(0, 1), note='Допущение', origin='допущение',
            ),
            'allowed_handling_methods': Input(
                example='буксировка;кузов', unit='', source='Аэропорт!D40',
                label='Допустимые способы обработки груза (через ;)', symbol='Aer_handling_req',
                note='Допущение команды: багажные тележки — буксировка; контейнеры — кузов', origin='допущение',
            ),
        },
        'location': {
            'minimum_aisle_m': Input(
                example=4, unit='м', source='Аэропорт!D36',
                label='Минимальная ширина проезда (служебные проезды перрона)', symbol='Aer_aisle', bounds=(3, 8),
                note='Допущение команды', origin='допущение',
            ),
            'aisle_clearance_m': Input(
                example=0.6, unit='м', source='Аэропорт!D37', label='Запас по ширине проезда',
                symbol='Aer_clearance', bounds=(0.3, 1), note='Допущение команды', origin='допущение',
            ),
        },
        'labor': {
            'labor_replacement_forks': Input(
                example=0.8, unit='доля', source='Аэропорт!D42', label='Коэф. замещения труда: вилы',
                symbol='Aer_repl_forks', bounds=(0.5, 0.9),
                note='Допущение команды: полный цикл без станций; остаются высотные/нестандартные операции',
                origin='допущение',
            ),
            'labor_replacement_platform': Input(
                example=0.6, unit='доля', source='Аэропорт!D43',
                label='Коэф. замещения труда: платформа (подъём/станции передачи)', symbol='Aer_repl_platform',
                bounds=(0.4, 0.9), note='Допущение команды', origin='допущение',
            ),
            'labor_replacement_towing': Input(
                example=0.8, unit='доля', source='Аэропорт!D44', label='Коэф. замещения труда: буксировка',
                symbol='Aer_repl_tow', bounds=(0.5, 0.9),
                note='Допущение команды: сцепка тележек остаётся ручной', origin='допущение',
            ),
            'labor_replacement_body': Input(
                example=0.8, unit='доля', source='Аэропорт!D45', label='Коэф. замещения труда: кузов',
                symbol='Aer_repl_body', bounds=(0.3, 0.9),
                note='Допущение команды: ручная погрузка/выгрузка кузова', origin='допущение',
            ),
            'driver_work_share': Input(
                example=0.2, unit='доля', source='Аэропорт!D47',
                label='Доля водителей багажных тягачей в персонале рампа', symbol='Aer_driver_share',
                bounds=(0.1, 0.35),
                note='Допущение команды (в датасете нет разбивки персонала рампа по функциям)',
                origin='допущение',
            ),
            'fleet_operators_per_shift': Input(
                example=1, unit='чел./смену', source='Аэропорт!D54', label='Операторы флота (диспетчер) на смену',
                symbol='Aer_fleet_per_shift', bounds=(0, 3), note='Допущение команды', origin='допущение',
            ),
        },
        'economics': {
            'site_preparation_share': Input(
                example=0.1, unit='доля', source='Аэропорт!D56',
                label='Подготовка объекта (разметка airside, СКУД, связь), % от стоимости парка',
                symbol='Aer_site_pct', bounds=(0.05, 0.25),
                note='Допущение команды (сертификация airside, интеграция со СКУД OSDP)', origin='допущение',
            ),
            'integration_cost': Input(
                example=3000000, unit='руб.', source='Аэропорт!D57',
                label='Интеграция с AODB/FIDS и системой обработки багажа', symbol='Aer_integration',
                bounds=(1000000, 10000000), note='Допущение команды', origin='допущение',
            ),
            'annual_consumables_per_robot': Input(
                example=0, unit='руб./год', source='Аэропорт!D58', label='Расходные материалы на робота в год',
                symbol='Aer_consum_per_robot', bounds=(0, 300000), note='Учтены в сервисе', origin='допущение',
            ),
            'annual_other_benefits': Input(
                example=0, unit='руб./год', source='Аэропорт!D59',
                label='Иные измеримые эффекты (сокращение задержек рейсов, повреждений багажа)',
                symbol='Aer_other_effects', bounds=(0, None), note='Ввод пользователя; консервативно 0',
                origin='допущение',
            ),
        },
    },
    'hospital': {
        'operations': {
            'operating_hours_per_day': Input(
                example=16, unit='ч', source='Медучреждение!D35',
                label='Часов логистической работы в сутки (окно 06:00–22:00)', symbol='Med_hours_day',
                bounds=(8, 24), note='Допущение команды: ночью доставки минимальны (шум ≤30 дБА в палатах)',
                origin='допущение',
            ),
            'peak_factor': Input(
                example=1.8, unit='коэф.', source='Медучреждение!D36',
                label='Пиковый коэффициент (пики 07–10 и 15–17 по датасету)', symbol='Med_peak_k',
                bounds=(1.2, 2.5), note='Допущение команды: два пиковых окна', origin='допущение',
            ),
            'automatable_share': Input(
                example=0.9, unit='доля', source='Медучреждение!D43', label='Доля автоматизируемых операций',
                symbol='Med_auto_share', bounds=(0.5, 1),
                note='Допущение: 10% маршрутов (реанимация, оперблок, режимные зоны) остаются ручными',
                origin='допущение',
            ),
            'site_speed_limit_mps': Input(
                example=1, unit='м/с', source='Медучреждение!D47', label='Ограничение скорости в коридорах',
                symbol='Med_speed_cap', bounds=(0.5, 1.5),
                note='Допущение: безопасность пациентов, разминовка с каталками', origin='допущение',
            ),
            'lift_trip_share': Input(
                example=0.8, unit='доля', source='Медучреждение!D48', label='Доля рейсов с использованием лифта',
                symbol='Med_lift_share', bounds=(0, 1),
                note='Допущение: 9 этажей, пищеблок/прачечная на нижних этажах', origin='допущение',
            ),
            'one_way_lift_seconds': Input(
                example=180, unit='с', source='Медучреждение!D49',
                label='Ожидание + проезд лифта (в один проход)', symbol='Med_lift_time', bounds=(60, 600),
                note='Допущение команды: 4 лифта на 9 этажей — типичное узкое место (датасет)',
                origin='допущение',
            ),
        },
        'task_and_load': {
            'load_is_divisible': Input(
                example=0, unit='1/0', source='Медучреждение!D45', label='Груз делимый (0 — тележка неделима)',
                symbol='Med_divisible', bounds=(0, 1), note='Допущение', origin='допущение',
            ),
            'allowed_handling_methods': Input(
                example='платформа;кузов', unit='', source='Медучреждение!D54',
                label='Допустимые способы обработки груза (через ;)', symbol='Med_handling_req',
                note='Допущение команды: тележки подхватываются платформой напрямую (→ 0.8); кузов — мелкие грузы',
                origin='допущение',
            ),
        },
        'location': {
            'aisle_clearance_m': Input(
                example=0.9, unit='м', source='Медучреждение!D51',
                label='Запас по ширине (разминовка с каталкой)', symbol='Med_clearance', bounds=(0.5, 1.5),
                note='Допущение: каталка ~0.7 м + зазоры', origin='допущение',
            ),
        },
        'labor': {
            'labor_replacement_forks': Input(
                example=0.8, unit='доля', source='Медучреждение!D56', label='Коэф. замещения труда: вилы',
                symbol='Med_repl_forks', bounds=(0.5, 0.9),
                note='Допущение команды: полный цикл без станций; остаются высотные/нестандартные операции',
                origin='допущение',
            ),
            'labor_replacement_platform': Input(
                example=0.8, unit='доля', source='Медучреждение!D57',
                label='Коэф. замещения труда: платформа (подъём/станции передачи)', symbol='Med_repl_platform',
                bounds=(0.4, 0.9), note='Допущение команды', origin='допущение',
            ),
            'labor_replacement_towing': Input(
                example=0.8, unit='доля', source='Медучреждение!D58', label='Коэф. замещения труда: буксировка',
                symbol='Med_repl_tow', bounds=(0.5, 0.9),
                note='Допущение команды: сцепка тележек остаётся ручной', origin='допущение',
            ),
            'labor_replacement_body': Input(
                example=0.5, unit='доля', source='Медучреждение!D59', label='Коэф. замещения труда: кузов',
                symbol='Med_repl_body', bounds=(0.3, 0.9),
                note='Допущение команды: ручная погрузка/выгрузка кузова', origin='допущение',
            ),
            'orderly_transport_share': Input(
                example=0.5, unit='доля', source='Медучреждение!D61',
                label='Доля времени санитаров/транспортировщиков на транспортировку тележек',
                symbol='Med_share_orderly', bounds=(0.3, 0.8), note='Допущение команды', origin='допущение',
            ),
            'kitchen_transport_share': Input(
                example=0.3, unit='доля', source='Медучреждение!D62',
                label='Доля времени пищеблока на транспортную функцию', symbol='Med_share_kitchen',
                bounds=(0.1, 0.5),
                note='Датасет: «частичное замещение — только транспортная функция»; величина — допущение',
                origin='допущение',
            ),
            'laundry_transport_share': Input(
                example=0.5, unit='доля', source='Медучреждение!D63',
                label='Доля времени прачечной на транспорт белья', symbol='Med_share_laundry', bounds=(0.3, 0.8),
                note='Допущение команды', origin='допущение',
            ),
            'fleet_operators_per_shift': Input(
                example=1, unit='чел./смену', source='Медучреждение!D70', label='Операторы флота на смену',
                symbol='Med_fleet_per_shift', bounds=(0, 3), note='Допущение команды', origin='допущение',
            ),
        },
        'economics': {
            'site_preparation_share': Input(
                example=0.15, unit='доля', source='Медучреждение!D72',
                label='Подготовка объекта (API лифтов, двери, СКУД, Wi-Fi), % от стоимости парка',
                symbol='Med_site_pct', bounds=(0.05, 0.3),
                note='Допущение: датасет — BMS лифтов «частично», без API лифтов AMR не работает между этажами',
                origin='допущение',
            ),
            'integration_cost': Input(
                example=2500000, unit='руб.', source='Медучреждение!D73',
                label='Интеграция с МИС (ЕМИАС) и лифтовым оборудованием', symbol='Med_integration',
                bounds=(500000, 8000000), note='Допущение команды', origin='допущение',
            ),
            'annual_other_benefits': Input(
                example=0, unit='руб./год', source='Медучреждение!D75',
                label='Иные измеримые эффекты (соблюдение нормативов доставки, снижение ВБИ)',
                symbol='Med_other_effects', bounds=(0, None), note='Консервативно 0; ввод пользователя',
                origin='допущение',
            ),
        },
    },
    'norms': {
        'labor': {
            'payroll_multiplier': Input(
                example=1.302, unit='коэф.', source='Нормативы!D4',
                label='Коэффициент начислений на ФОТ (страховые взносы)', symbol='N_fot', bounds=(1.302, 1.302),
                note='Датасет (все листы): ОПФ 22% + ОМС 5.1% + ОСС 2.9% + НСиПЗ 0.2% = 30.2%',
                origin='норматив/датасет',
            ),
            'recruitment_months_salary': Input(
                example=0.5, unit='окладов', source='Нормативы!D27',
                label='Стоимость замены одного сотрудника (подбор + адаптация), в месячных окладах',
                symbol='N_hire_cost', bounds=(0.3, 1), note='Допущение команды (HR-бенчмарк)', origin='допущение',
            ),
            'default_staff_time_loss_share': Input(
                example=0.25, unit='доля', source='Нормативы!D35',
                label='Коэффициент потерь рабочего времени персонала (отпуск, болезнь) — по умолчанию для объектов без данных',
                symbol='N_loss_k_default', bounds=(0.15, 0.35),
                note='Датасет «Склад»: 25%; для аэропорта и медучреждения применён как допущение',
                origin='допущение',
            ),
        },
        'operations': {
            'productive_time_share': Input(
                example=0.8, unit='доля', source='Нормативы!D5',
                label='Коэффициент загрузки робота (доля продуктивного времени: зарядка, ожидание, простои)',
                symbol='N_util', bounds=(0.7, 0.85), note='Датасет, лист «Легенда»: типовой KPI AMR 70–85%',
                origin='норматив/датасет',
            ),
            'technical_availability': Input(
                example=0.95, unit='доля', source='Нормативы!D6',
                label='Коэффициент технической готовности (доступности) робота', symbol='N_avail',
                bounds=(0.9, 0.98), note='Допущение команды: плановое ТО и отказы; типовой SLA вендоров 95–98%',
                origin='допущение',
            ),
            'fleet_reserve_share': Input(
                example=0.15, unit='доля', source='Нормативы!D7',
                label='Резерв парка роботов на пиковую нагрузку', symbol='N_reserve', bounds=(0.15, 0.2),
                note='Датасет, лист «Легенда»: резерв 15–20%', origin='норматив/датасет',
            ),
            'operating_speed_factor': Input(
                example=0.6, unit='коэф.', source='Нормативы!D8',
                label='Отношение средней эксплуатационной скорости к максимальной (разгон, повороты, трафик, зоны людей)',
                symbol='N_kv', bounds=(0.5, 0.8),
                note='Допущение команды (практика проектов AMR); проверяется имитацией', origin='допущение',
            ),
        },
        'charging': {
            'robots_per_charger': Input(
                example=4, unit='шт./станцию', source='Нормативы!D9', label='Роботов на одну зарядную станцию',
                symbol='N_charger_ratio', bounds=(2, 6), note='Допущение команды (opportunity charging)',
                origin='допущение',
            ),
            'charger_installed_price': Input(
                example=250000, unit='руб.', source='Нормативы!D10',
                label='Стоимость зарядной станции с монтажом', symbol='N_charger_price', bounds=(150000, 500000),
                note='Допущение команды (оценка рынка)', origin='допущение',
            ),
            'charger_power_kw': Input(
                example=5, unit='кВт', source='Нормативы!D11', label='Мощность одной зарядной станции',
                symbol='N_charger_kw', bounds=(3, 10), note='Допущение команды (типовые станции AMR 3–10 кВт)',
                origin='допущение',
            ),
        },
        'purchase_and_setup': {
            'fms_upfront_share': Input(
                example=0.1, unit='доля', source='Нормативы!D12',
                label='ПО управления флотом (FMS), разовая лицензия и внедрение, % от стоимости оборудования',
                symbol='N_sw_pct', bounds=(0.05, 0.15), note='Допущение команды', origin='допущение',
            ),
            'delivery_share': Input(
                example=0.02, unit='доля', source='Нормативы!D13',
                label='Доставка оборудования, % от стоимости оборудования', symbol='N_delivery_pct',
                bounds=(0.01, 0.05), note='Допущение команды; Дополнения п.6: доставка не включена в цену',
                origin='допущение',
            ),
            'commissioning_share': Input(
                example=0.05, unit='доля', source='Нормативы!D14',
                label='Пусконаладочные работы, % от стоимости оборудования', symbol='N_pnr_pct',
                bounds=(0.03, 0.1), note='Допущение команды; Дополнения п.6: ПНР не включены в цену',
                origin='допущение',
            ),
            'training_cost': Input(
                example=300000, unit='руб.', source='Нормативы!D15',
                label='Обучение персонала заказчика (разово на проект)', symbol='N_training',
                bounds=(100000, 1000000), note='Допущение команды', origin='допущение',
            ),
            'capex_contingency_share': Input(
                example=0.1, unit='доля', source='Нормативы!D16',
                label='Резерв на непредвиденные расходы, % от CAPEX', symbol='N_capex_reserve', bounds=(0.1, 0.1),
                note='Датасет, лист «Легенда»: резерв 10%', origin='норматив/датасет',
            ),
        },
        'running_costs': {
            'annual_service_share': Input(
                example=0.08, unit='доля/год', source='Нормативы!D17',
                label='Сервисный контракт вендора, % от стоимости оборудования в год', symbol='N_service_pct',
                bounds=(0.05, 0.1), note='Допущение команды (отраслевой диапазон 5–10%)', origin='допущение',
            ),
            'annual_license_share': Input(
                example=0.03, unit='доля/год', source='Нормативы!D18',
                label='Лицензии ПО (подписка FMS), % от стоимости оборудования в год', symbol='N_license_pct',
                bounds=(0.02, 0.05), note='Допущение команды', origin='допущение',
            ),
            'annual_repair_share': Input(
                example=0.02, unit='доля/год', source='Нормативы!D19',
                label='Внеплановый ремонт и запчасти вне контракта, % от стоимости оборудования в год',
                symbol='N_repair_pct', bounds=(0.01, 0.04), note='Допущение команды', origin='допущение',
            ),
            'electricity_price': Input(
                example=7.5, unit='руб./кВт·ч', source='Нормативы!D20', label='Тариф на электроэнергию',
                symbol='N_energy_price', bounds=(5, 10),
                note='Допущение команды (средний тариф для юрлиц; уточнить по объекту)', origin='допущение',
            ),
            'battery_life_years': Input(
                example=4, unit='лет', source='Нормативы!D21', label='Срок службы АКБ до замены',
                symbol='N_battery_life', bounds=(3, 5), note='Датасет, лист «Легенда»: замена АКБ раз в 3–5 лет',
                origin='норматив/датасет',
            ),
            'battery_replacement_share': Input(
                example=0.1, unit='доля', source='Нормативы!D22',
                label='Стоимость комплекта АКБ на замену, % от цены робота', symbol='N_battery_share',
                bounds=(0.05, 0.15), note='Допущение команды', origin='допущение',
            ),
            'annual_connectivity_cost': Input(
                example=60000, unit='руб./год', source='Нормативы!D23',
                label='Связь / поддержка Wi-Fi-инфраструктуры для флота (на объект в год)', symbol='N_connect',
                bounds=(0, 300000), note='Допущение команды', origin='допущение',
            ),
        },
        'finance': {
            'equipment_life_years': Input(
                example=7, unit='лет', source='Нормативы!D24',
                label='Срок службы оборудования (амортизационный период, линейный метод)', symbol='N_life',
                bounds=(5, 10),
                note='Дополнения п.2.2: метод и срок выбирает команда; принят линейный метод, 7 лет',
                origin='допущение',
            ),
            'discount_rate': Input(
                example=0.15, unit='доля/год', source='Нормативы!D28',
                label='Ставка дисконтирования (справочно, для NPV)', symbol='N_discount', bounds=(0.1, 0.25),
                note='Допущение команды', origin='допущение',
            ),
            'loan_share': Input(
                example=0, unit='доля', source='Нормативы!D29',
                label='Доля заёмного финансирования CAPEX (0 = собственные средства — базовый сценарий)',
                symbol='N_loan_share', bounds=(0, 1),
                note='Дополнения п.2.1: база — собственные средства; заёмные — опционально',
                origin='норматив/датасет',
            ),
            'loan_interest_rate': Input(
                example=0.2, unit='доля/год', source='Нормативы!D30',
                label='Ставка по кредиту (если используется заёмное финансирование)', symbol='N_loan_rate',
                bounds=(0.1, 0.3), note='Допущение команды — уточнить на дату расчёта', origin='допущение',
            ),
            'loan_term_years': Input(
                example=3, unit='лет', source='Нормативы!D31',
                label='Срок кредита (равные платежи по телу долга)', symbol='N_loan_years', bounds=(1, 7),
                note='Допущение команды', origin='допущение',
            ),
        },
        'raas': {
            'monthly_raas_share': Input(
                example=0.03, unit='доля/мес', source='Нормативы!D25',
                label='Ставка RaaS (аренда), % от цены робота в месяц; включает сервис, ПО и замену АКБ',
                symbol='N_raas_pct', bounds=(0.025, 0.04),
                note='Допущение команды (рыночные предложения RaaS/лизинга роботов: 2.5–4%/мес)',
                origin='допущение',
            ),
            'raas_setup_share': Input(
                example=0.05, unit='доля', source='Нормативы!D26',
                label='Установочный платёж RaaS (монтаж и запуск), % от цены оборудования', symbol='N_raas_setup',
                bounds=(0, 0.1), note='Допущение команды', origin='допущение',
            ),
        },
        'interpretation_and_sensitivity': {
            'good_payback_years': Input(
                example=3, unit='лет', source='Нормативы!D32',
                label='Граница «высокой целесообразности»: срок окупаемости до, лет', symbol='N_pb_good',
                bounds=(2, 4), note='ТЗ п.3.5.7: интервалы до 3 / 3–5 / более 5 лет', origin='норматив/датасет',
            ),
            'medium_payback_years': Input(
                example=5, unit='лет', source='Нормативы!D33',
                label='Граница «средней целесообразности»: срок окупаемости до, лет', symbol='N_pb_mid',
                bounds=(4, 7), note='ТЗ п.3.5.7', origin='норматив/датасет',
            ),
            'sensitivity_step': Input(
                example=0.2, unit='доля', source='Нормативы!D34', label='Шаг анализа чувствительности (±)',
                symbol='N_sens', bounds=(0.1, 0.3), note='Допущение команды (ТЗ п.3.5.6 — минимум 3 параметра)',
                origin='допущение',
            ),
        },
    },
    'robots': {
        'specifications': {
            'payload_kg': Input(
                example={'DMR-CARRIER-P': 1500, 'AK-2000-2': 1500, 'RONAVI-M': 1200, 'MOROS-AMR800': 800, 'PUDUBOT-2': 10},
                unit='kg', source='Каталог!K4:K13', label='Грузоподъёмность, кг',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'max_speed_mps': Input(
                example={'DMR-CARRIER-P': 1.5, 'AK-2000-2': 1.5, 'RONAVI-M': 1.5, 'MOROS-AMR800': 1.5, 'PUDUBOT-2': 1.2, 'COGNITIVE-TUG': 4.17, 'EVOCARGO-N1': 5.56},
                unit='m/s', source='Каталог!L4:L13', label='Макс. скорость, м/с',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'autonomy_hours': Input(
                example={'DMR-CARRIER-P': 10, 'AK-2000-2': 10, 'RONAVI-M': 6, 'MOROS-AMR800': 20, 'PUDUBOT-2': 12, 'EVOCARGO-N1': 8},
                unit='h', source='Каталог!M4:M13', label='Автономность, ч',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'charging_minutes': Input(
                example={'DMR-CARRIER-P': 90, 'AK-2000-2': 90, 'RONAVI-M': 18, 'MOROS-AMR800': 60, 'PUDUBOT-2': 240},
                unit='min', source='Каталог!N4:N13', label='Время зарядки, мин',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'length_mm': Input(
                example={'DMR-CARRIER-P': 1975, 'AK-2000-2': 1975, 'RONAVI-M': 1044, 'MOROS-AMR800': 1100, 'PUDUBOT-2': 580},
                unit='mm', source='Каталог!O4:O13', label='Длина, мм',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'width_mm': Input(
                example={'DMR-CARRIER-P': 1000, 'AK-2000-2': 1000, 'RONAVI-M': 654, 'MOROS-AMR800': 600, 'PUDUBOT-2': 535},
                unit='mm', source='Каталог!P4:P13', label='Ширина, мм',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'height_mm': Input(
                example={'DMR-CARRIER-P': 2050, 'AK-2000-2': 2050, 'RONAVI-M': 380, 'MOROS-AMR800': 230, 'PUDUBOT-2': 1290},
                unit='mm', source='Каталог!Q4:Q13', label='Высота, мм',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'min_temperature_c': Input(
                example={'DMR-CARRIER-P': 5, 'AK-2000-2': 5, 'RONAVI-M': 5, 'MOROS-AMR800': 5, 'PUDUBOT-2': 5},
                unit='°C', source='Каталог!R4:R13', label='Темп. мин, °C',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'max_temperature_c': Input(
                example={'DMR-CARRIER-P': 35, 'AK-2000-2': 35, 'RONAVI-M': 30, 'MOROS-AMR800': 30, 'PUDUBOT-2': 35},
                unit='°C', source='Каталог!S4:S13', label='Темп. макс, °C',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'average_power_kw': Input(
                example={'DMR-CARRIER-P': 3, 'AK-2000-2': 3, 'RONAVI-H1500': 1, 'RONAVI-M': 1, 'MOROS-AMR800': 1, 'RONAVI-SD': 0.3, 'PUDUBOT-2': 0.3, 'COGNITIVE-TUG': 6, 'EVOCARGO-N1': 6, 'MARK-2-SE': 1},
                unit='kW', source='Каталог!T4:T13', label='Ср. потребляемая мощность, кВт',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'loading_seconds': Input(
                example={'DMR-CARRIER-P': 60, 'AK-2000-2': 60, 'RONAVI-H1500': 30, 'RONAVI-M': 45, 'MOROS-AMR800': 45, 'RONAVI-SD': 20, 'PUDUBOT-2': 20, 'COGNITIVE-TUG': 180, 'EVOCARGO-N1': 240, 'MARK-2-SE': 0},
                unit='s', source='Каталог!V4:V13', label='Время загрузки, с',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
            'unloading_seconds': Input(
                example={'DMR-CARRIER-P': 60, 'AK-2000-2': 60, 'RONAVI-H1500': 30, 'RONAVI-M': 45, 'MOROS-AMR800': 45, 'RONAVI-SD': 20, 'PUDUBOT-2': 20, 'COGNITIVE-TUG': 180, 'EVOCARGO-N1': 240, 'MARK-2-SE': 0},
                unit='s', source='Каталог!W4:W13', label='Время разгрузки, с',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification.',
                origin='team estimate / unconfirmed',
            ),
        },
        'reference_only': {
            'legacy_labor_replacement': Input(
                example={'DMR-CARRIER-P': 0.8, 'AK-2000-2': 0.8, 'RONAVI-H1500': 0.6, 'RONAVI-M': 0.8, 'MOROS-AMR800': 0.8, 'RONAVI-SD': 0.5, 'PUDUBOT-2': 0.5, 'COGNITIVE-TUG': 0.8, 'EVOCARGO-N1': 0.8, 'MARK-2-SE': 0.7},
                unit='share', source='Каталог!X4:X13',
                label='Коэф. замещения (справочно; в расчёте — по паре задача×способ обработки, блок 2 листа объекта)',
                note='Unconfirmed: yellow source cells or explicit estimates in catalog notes. The row-level confirmation flag does not confirm each specification. Reference only. Calculations use task × handling replacement assumptions.',
                origin='team estimate / unconfirmed',
            ),
        },
    },
    'scenario': {
        'price_factor': Input(
            example=1.0, unit='factor', source='Склад!E65', label='Equipment price multiplier.',
            note='Base example; sensitivity uses 1 ± norms.sensitivity_step.', origin='scenario control',
        ),
        'volume_factor': Input(
            example=1.0, unit='factor', source='Склад!E66', label='Operations and baseline labor multiplier.',
            note='Base example; sensitivity uses 1 ± norms.sensitivity_step.', origin='scenario control',
        ),
        'labor_factor': Input(
            example=1.0, unit='factor', source='Склад!E67', label='Salary cost multiplier.',
            note='Base example; sensitivity uses 1 ± norms.sensitivity_step.', origin='scenario control',
        ),
    },
}


calculated_inputs = {
    'warehouse': {
        'operations': {
            'operations_per_day': Formula(
                expression='warehouse.inbound_pallets_per_day+warehouse.outbound_pallets_per_day', unit='оп./сут',
                source='Склад!D27',
                label='Объём операций процесса = приёмка + отгрузка (перемещение паллет док ↔ зона хранения)',
                symbol='Skl_ops_day', note='Формула из датасета', excel='Skl_in_pallets+Skl_out_pallets',
            ),
            'automatable_share': Formula(
                expression='1-warehouse.oversize_load_share', unit='доля', source='Склад!D28',
                label='Доля автоматизируемых операций = 1 − доля негабарита', symbol='Skl_auto_share',
                note='Формула из датасета', excel='1-Skl_oversize_share',
            ),
            'operating_hours_per_day': Formula(
                expression='warehouse.shifts_per_day*warehouse.shift_hours', unit='ч', source='Склад!D29',
                label='Часов работы процесса в сутки = смен × продолжительность смены', symbol='Skl_hours_day',
                note='Формула из датасета', excel='Skl_shifts*Skl_shift_h',
            ),
            'peak_operations_per_hour': Formula(
                expression='warehouse.operations_per_day/warehouse.operating_hours_per_day*warehouse.peak_factor',
                unit='оп./ч', source='Склад!D30',
                label='Пиковая интенсивность = объём / часов × пиковый коэффициент', symbol='Skl_peak_ops_h',
                note='Формула из датасета', excel='Skl_ops_day/Skl_hours_day*Skl_peak_k',
            ),
            'one_way_route_m': Formula(
                expression='sqrt(warehouse.active_area_m2)', unit='м', source='Склад!D33',
                label='Средняя длина маршрута (док ↔ ячейка) = √(площадь активной зоны)', symbol='Skl_L',
                note='Допущение команды: средняя дистанция перемещения ≈ корню из площади зоны (проверяется на 2D-схеме)',
                excel='SQRT(Skl_S_active)',
            ),
        },
        'task_and_load': {
            'load_unit_mass_kg': Formula(
                expression='warehouse.pallet_mass_kg', unit='кг', source='Склад!D31',
                label='Масса единицы груза (паллет)', symbol='Skl_unit_mass', note='Датасет',
                excel='Skl_pallet_mass',
            ),
        },
        'location': {
            'minimum_aisle_m': Formula(
                expression='min(warehouse.main_aisle_m,warehouse.rack_aisle_m)', unit='м', source='Склад!D37',
                label='Минимальная ширина прохода для фильтра решений', symbol='Skl_aisle',
                note='Формула из датасета', excel='MIN(Skl_aisle_main,Skl_aisle_rack)',
            ),
        },
        'labor': {
            'target_fte': Formula(
                expression='warehouse.forklift_operator_count*warehouse.transport_work_share*warehouse.automatable_share',
                unit='FTE', source='Склад!D48',
                label='Целевые FTE процесса = операторы погрузчиков × доля их функции в процессе × доля автоматизируемых операций',
                symbol='Skl_fte_target', note='Формула', excel='Skl_forklift_ops*Skl_func_share*Skl_auto_share',
            ),
            'target_annual_payroll': Formula(
                expression='warehouse.target_fte*warehouse.forklift_monthly_salary*12*norms.payroll_multiplier',
                unit='руб./год', source='Склад!D50', label='Годовой ФОТ целевых FTE (с начислениями)',
                symbol='Skl_labor_target', note='Формула', excel='Skl_fte_target*Skl_sal_forklift*12*N_fot',
            ),
            'baseline_annual_payroll': Formula(
                expression='warehouse.forklift_operator_count*warehouse.forklift_monthly_salary*12*norms.payroll_multiplier',
                unit='руб./год', source='Склад!D51', label='Годовой ФОТ всего целевого персонала процесса (база)',
                symbol='Skl_base_labor', note='Формула: численность × оклад × 12 × ФОТ-коэф.',
                excel='Skl_forklift_ops*Skl_sal_forklift*12*N_fot',
            ),
            'target_monthly_salary': Formula(
                expression='warehouse.forklift_monthly_salary', unit='руб./мес.', source='Склад!D52',
                label='Средний оклад целевого персонала (для оценки стоимости замены)', symbol='Skl_sal_target',
                note='Датасет', excel='Skl_sal_forklift',
            ),
            'fleet_operator_monthly_salary': Formula(
                expression='warehouse.forklift_monthly_salary', unit='руб./мес.', source='Склад!D55',
                label='Оклад оператора флота', symbol='Skl_fleet_sal',
                note='Допущение: на уровне оператора погрузчика', excel='Skl_sal_forklift',
            ),
        },
    },
    'airport': {
        'operations': {
            'operating_hours_per_day': Formula(
                expression='airport.shifts_per_day*airport.shift_hours', unit='ч', source='Аэропорт!D26',
                label='Часов работы процесса в сутки', symbol='Aer_hours_day', note='Формула',
                excel='Aer_shifts*Aer_shift_h',
            ),
            'operations_per_day': Formula(
                expression='airport.flights_per_day*2', unit='оп./сут', source='Аэропорт!D27',
                label='Объём операций = рейсов × 2 (доставка багажа на борт + вывоз на выдачу)',
                symbol='Aer_ops_day', note='Формула из датасета', excel='Aer_flights_day*2',
            ),
            'peak_operations_per_hour': Formula(
                expression='airport.peak_flights_per_hour*2', unit='оп./ч', source='Аэропорт!D28',
                label='Пиковая интенсивность = пиковых рейсов/ч × 2', symbol='Aer_peak_ops_h',
                note='Формула из датасета (пик задан напрямую, пиковый коэффициент не применяется)',
                excel='Aer_flights_peak_h*2',
            ),
            'one_way_route_m': Formula(
                expression='2*sqrt(airport.apron_area_m2)', unit='м', source='Аэропорт!D32',
                label='Средняя длина маршрута (сортировка багажа ↔ стоянка ВС) = 2 × √(площадь перрона)',
                symbol='Aer_L', note='Допущение команды (проверяется на схеме перрона)',
                excel='2*SQRT(Aer_S_apron)',
            ),
        },
        'task_and_load': {
            'load_unit_mass_kg': Formula(
                expression='airport.bags_per_day/airport.flights_per_day*airport.bag_mass_kg', unit='кг',
                source='Аэропорт!D30', label='Масса багажа одного рейса = багаж/сут ÷ рейсов/сут × масса единицы',
                symbol='Aer_unit_mass', note='Формула из датасета',
                excel='Aer_bags_day/Aer_flights_day*Aer_bag_mass',
            ),
        },
        'location': {
            'operating_min_temperature_c': Formula(
                expression='airport.recorded_min_temperature_c', unit='°C', source='Аэропорт!D46',
                label='Минимальная температура эксплуатации', symbol='Aer_temp_min', note='Датасет',
                excel='Aer_temp_min_ds',
            ),
        },
        'labor': {
            'target_fte': Formula(
                expression='airport.ramp_staff_count*airport.driver_work_share*airport.automatable_share',
                unit='FTE', source='Аэропорт!D48',
                label='Целевые FTE = персонал рампа × доля водителей × доля автоматизируемых операций',
                symbol='Aer_fte_target', note='Формула', excel='Aer_ramp_staff*Aer_driver_share*Aer_auto_share',
            ),
            'target_annual_payroll': Formula(
                expression='airport.target_fte*airport.ramp_monthly_salary*12*norms.payroll_multiplier',
                unit='руб./год', source='Аэропорт!D49', label='Годовой ФОТ целевых FTE (с начислениями)',
                symbol='Aer_labor_target', note='Формула', excel='Aer_fte_target*Aer_sal_ramp*12*N_fot',
            ),
            'baseline_annual_payroll': Formula(
                expression='airport.ramp_staff_count*airport.driver_work_share*airport.ramp_monthly_salary*12*norms.payroll_multiplier',
                unit='руб./год', source='Аэропорт!D50',
                label='Годовой ФОТ всего целевого персонала процесса (водители тягачей)', symbol='Aer_base_labor',
                note='Формула', excel='Aer_ramp_staff*Aer_driver_share*Aer_sal_ramp*12*N_fot',
            ),
            'target_monthly_salary': Formula(
                expression='airport.ramp_monthly_salary', unit='руб./мес.', source='Аэропорт!D51',
                label='Средний оклад целевого персонала', symbol='Aer_sal_target', note='Датасет',
                excel='Aer_sal_ramp',
            ),
            'annual_staff_turnover': Formula(
                expression='airport.recorded_staff_turnover', unit='доля', source='Аэропорт!D52',
                label='Годовая текучесть целевого персонала', symbol='Aer_turnover', note='Датасет',
                excel='Aer_turnover_ds',
            ),
            'staff_time_loss_share': Formula(
                expression='norms.default_staff_time_loss_share', unit='доля', source='Аэропорт!D53',
                label='Коэффициент потерь рабочего времени', symbol='Aer_loss_k',
                note='Нормативы (по умолчанию 25%)', excel='N_loss_k_default',
            ),
            'fleet_operator_monthly_salary': Formula(
                expression='airport.ramp_monthly_salary', unit='руб./мес.', source='Аэропорт!D55',
                label='Оклад оператора флота', symbol='Aer_fleet_sal',
                note='Допущение: на уровне персонала рампа', excel='Aer_sal_ramp',
            ),
        },
    },
    'hospital': {
        'operations': {
            'food_operations_per_day': Formula(
                expression='hospital.feedings_per_day*hospital.food_delivery_points*2', unit='оп./сут',
                source='Медучреждение!D37',
                label='Рейсы питания = кормлений × отделений × 2 (доставка + возврат тележек)',
                symbol='Med_ops_food', note='Формула из датасета', excel='Med_feedings*Med_food_points*2',
            ),
            'linen_operations_per_day': Formula(
                expression='hospital.linen_delivery_points*hospital.linen_cycles_per_day*2', unit='оп./сут',
                source='Медучреждение!D38', label='Рейсы белья = точек × периодичность × 2 (чистое + грязное)',
                symbol='Med_ops_linen', note='Формула из датасета', excel='Med_linen_points*Med_linen_freq*2',
            ),
            'waste_operations_per_day': Formula(
                expression='hospital.waste_collection_points*hospital.waste_cycles_per_day*2', unit='оп./сут',
                source='Медучреждение!D39',
                label='Рейсы отходов = точек × периодичность × 2 (вывоз + возврат тары)', symbol='Med_ops_waste',
                note='Формула из датасета', excel='Med_waste_points*Med_waste_freq*2',
            ),
            'supply_operations_per_day': Formula(
                expression='hospital.supply_trips_per_day', unit='оп./сут', source='Медучреждение!D40',
                label='Рейсы расходных материалов', symbol='Med_ops_supplies', note='Датасет',
                excel='Med_supplies_trips',
            ),
            'operations_per_day': Formula(
                expression='hospital.food_operations_per_day+hospital.linen_operations_per_day+hospital.waste_operations_per_day+hospital.supply_operations_per_day',
                unit='оп./сут', source='Медучреждение!D41',
                label='Объём операций процесса = питание + бельё + отходы + расходники', symbol='Med_ops_day',
                note='Формула', excel='Med_ops_food+Med_ops_linen+Med_ops_waste+Med_ops_supplies',
            ),
            'peak_operations_per_hour': Formula(
                expression='hospital.operations_per_day/hospital.operating_hours_per_day*hospital.peak_factor',
                unit='оп./ч', source='Медучреждение!D42',
                label='Пиковая интенсивность = объём / часов × пиковый коэффициент', symbol='Med_peak_ops_h',
                note='Формула', excel='Med_ops_day/Med_hours_day*Med_peak_k',
            ),
            'one_way_route_m': Formula(
                expression='hospital.food_route_m', unit='м', source='Медучреждение!D46',
                label='Средняя длина маршрута (пищеблок ↔ отделение)', symbol='Med_L', note='Датасет',
                excel='Med_L_food',
            ),
        },
        'task_and_load': {
            'load_unit_mass_kg': Formula(
                expression='max(hospital.food_cart_mass_kg,hospital.linen_container_mass_kg)', unit='кг',
                source='Медучреждение!D44', label='Масса единицы груза = максимальная из тележек процесса',
                symbol='Med_unit_mass', note='Формула из датасета', excel='MAX(Med_cart_mass,Med_linen_mass)',
            ),
        },
        'location': {
            'minimum_aisle_m': Formula(
                expression='hospital.corridor_width_m', unit='м', source='Медучреждение!D50',
                label='Минимальная ширина прохода', symbol='Med_aisle', note='Датасет', excel='Med_corridor',
            ),
        },
        'labor': {
            'target_fte': Formula(
                expression='(hospital.orderly_count*hospital.orderly_transport_share+hospital.kitchen_staff_count*hospital.kitchen_transport_share+hospital.laundry_staff_count*hospital.laundry_transport_share)*hospital.automatable_share',
                unit='FTE', source='Медучреждение!D64',
                label='Целевые FTE = Σ (численность × доля транспортной функции) × доля автоматизируемых',
                symbol='Med_fte_target', note='Формула',
                excel='(Med_orderlies*Med_share_orderly+Med_kitchen*Med_share_kitchen+Med_laundry*Med_share_laundry)*Med_auto_share',
            ),
            'target_annual_payroll': Formula(
                expression='(hospital.orderly_count*hospital.orderly_transport_share*hospital.orderly_monthly_salary+hospital.kitchen_staff_count*hospital.kitchen_transport_share*hospital.kitchen_monthly_salary+hospital.laundry_staff_count*hospital.laundry_transport_share*hospital.orderly_monthly_salary)*hospital.automatable_share*12*norms.payroll_multiplier',
                unit='руб./год', source='Медучреждение!D65', label='Годовой ФОТ целевых FTE (с начислениями)',
                symbol='Med_labor_target', note='Формула (з/п прачечной принята = санитара)',
                excel='(Med_orderlies*Med_share_orderly*Med_sal_orderly+Med_kitchen*Med_share_kitchen*Med_sal_kitchen+Med_laundry*Med_share_laundry*Med_sal_orderly)*Med_auto_share*12*N_fot',
            ),
            'baseline_annual_payroll': Formula(
                expression='(hospital.orderly_count*hospital.orderly_transport_share*hospital.orderly_monthly_salary+hospital.kitchen_staff_count*hospital.kitchen_transport_share*hospital.kitchen_monthly_salary+hospital.laundry_staff_count*hospital.laundry_transport_share*hospital.orderly_monthly_salary)*12*norms.payroll_multiplier',
                unit='руб./год', source='Медучреждение!D66',
                label='Годовой ФОТ персонала транспортной функции (база)', symbol='Med_base_labor',
                note='Формула',
                excel='(Med_orderlies*Med_share_orderly*Med_sal_orderly+Med_kitchen*Med_share_kitchen*Med_sal_kitchen+Med_laundry*Med_share_laundry*Med_sal_orderly)*12*N_fot',
            ),
            'target_monthly_salary': Formula(
                expression='hospital.orderly_monthly_salary', unit='руб./мес.', source='Медучреждение!D67',
                label='Средний оклад целевого персонала', symbol='Med_sal_target', note='Датасет',
                excel='Med_sal_orderly',
            ),
            'annual_staff_turnover': Formula(
                expression='hospital.recorded_staff_turnover', unit='доля', source='Медучреждение!D68',
                label='Годовая текучесть', symbol='Med_turnover', note='Датасет', excel='Med_turnover_ds',
            ),
            'staff_time_loss_share': Formula(
                expression='norms.default_staff_time_loss_share', unit='доля', source='Медучреждение!D69',
                label='Коэффициент потерь рабочего времени', symbol='Med_loss_k', note='Нормативы',
                excel='N_loss_k_default',
            ),
            'fleet_operator_monthly_salary': Formula(
                expression='hospital.orderly_monthly_salary', unit='руб./мес.', source='Медучреждение!D71',
                label='Оклад оператора флота', symbol='Med_fleet_sal', note='Допущение', excel='Med_sal_orderly',
            ),
        },
        'economics': {
            'annual_consumables_per_robot': Formula(
                expression='2*365*120', unit='руб./год', source='Медучреждение!D74',
                label='Дезинфекция робота (2 обработки/сут × 365 × стоимость обработки 120 руб.)',
                symbol='Med_consum_per_robot',
                note='Датасет: обеззараживание обязательно для Б-маршрутов; стоимость обработки — допущение',
                excel='2*365*120',
            ),
        },
    },
    'candidate': {
        'price': {
            'adjusted_robot_price': Formula(
                expression='robot.price_rub * scenario.price_factor', unit='руб.', source='Склад!E75',
                label='Цена в расчёте (с учётом k_цена)', symbol='price', excel='E74*E$65',
            ),
            'is_purchase': Formula(
                expression="int(selection.acquisition_model == 'purchase')", unit='1/0', source='Склад!E123',
                label='Модель «Покупка» (1) / «RaaS» (0)', symbol='is_purchase', excel='IF(E$64="Покупка",1,0)',
            ),
        },
        'labor': {
            'labor_replacement_share': Formula(
                expression='replacement_by_handling.get(robot.handling_method, 0)', unit='доля',
                source='Склад!E84',
                label='Коэффициент замещения труда = по паре «задача × способ обработки» (блок 2)', symbol='repl',
                excel='IF(E81="вилы",Skl_repl_forks,IF(E81="платформа",Skl_repl_platform,IF(E81="буксировка",Skl_repl_tow,IF(E81="кузов",Skl_repl_body,0))))',
            ),
            'scenario_baseline_payroll': Formula(
                expression='site.baseline_annual_payroll * scenario.labor_factor * scenario.volume_factor',
                unit='руб./год', source='Склад!E120',
                label='Годовой ФОТ целевого персонала процесса (с начислениями, × k_труд × k_объём: численность пропорциональна объёму)',
                symbol='base_labor', excel='Skl_base_labor*E$67*E$66',
            ),
            'released_fte': Formula(
                expression='site.target_fte * labor_replacement_share * workbook_feasible * scenario.volume_factor',
                unit='FTE', source='Склад!E148',
                label='Высвобождаемый персонал = целевые FTE × коэф. замещения × k_объём', symbol='fte_freed',
                excel='Skl_fte_target*E84*E95*E$66',
            ),
            'annual_payroll_saving': Formula(
                expression='site.target_annual_payroll * labor_replacement_share * scenario.labor_factor * scenario.volume_factor * workbook_feasible',
                unit='руб./год', source='Склад!E149',
                label='Экономия ФОТ (с начислениями) = целевой ФОТ × коэф. замещения × k_труд × k_объём',
                symbol='labor_saving', excel='Skl_labor_target*E84*E$67*E$66*E95',
            ),
            'remaining_annual_payroll': Formula(
                expression='scenario_baseline_payroll - annual_payroll_saving', unit='руб./год',
                source='Склад!E150', label='Остаточный ФОТ целевого персонала', symbol='labor_remaining',
                excel='E120-E149',
            ),
        },
        'applicability': {
            'task_matches': Formula(
                expression='robot.task_class == site.task_class', unit='', source='Склад!E89',
                label='Проверка класса задачи (транспорт / уборка)', symbol='chk_task',
                excel='IF(E83=Skl_task_class,"ОК","НЕТ")',
            ),
            'handling_matches': Formula(
                expression="robot.handling_method in site.allowed_handling_methods.split(';')", unit='',
                source='Склад!E90', label='Проверка способа обработки груза (в списке допустимых для задачи)',
                symbol='chk_handling', excel='IF(ISNUMBER(SEARCH(E81,Skl_handling_req)),"ОК","НЕТ")',
            ),
            'indoor_matches': Formula(
                expression='not site.indoor_required or robot.indoor_allowed', unit='', source='Склад!E91',
                label='Проверка допуска в помещения', symbol='chk_indoor',
                excel='IF(AND(Skl_indoor_req=1,E82=0),"НЕТ","ОК")',
            ),
            'payload_matches': Formula(
                expression='site.load_is_divisible or robot.payload_kg >= site.load_unit_mass_kg', unit='',
                source='Склад!E92', label='Проверка грузоподъёмности (неделимый груз: кап. ≥ масса единицы)',
                symbol='chk_cap', excel='IF(AND(Skl_divisible=0,E76<Skl_unit_mass),"НЕТ","ОК")',
            ),
            'aisle_matches': Formula(
                expression='robot.width_mm / 1000 + site.aisle_clearance_m <= site.minimum_aisle_m', unit='',
                source='Склад!E93', label='Проверка проезда (ширина робота + запас ≤ мин. ширина прохода)',
                symbol='chk_aisle', excel='IF(E85/1000+Skl_clearance<=Skl_aisle,"ОК","НЕТ")',
            ),
            'environment_matches': Formula(
                expression='not site.outdoor_required or (robot.outdoor_allowed and robot.min_temperature_c <= site.operating_min_temperature_c)',
                unit='', source='Склад!E94', label='Проверка условий эксплуатации (улица / мин. температура)',
                symbol='chk_env', excel='IF(Skl_outdoor_req=1,IF(AND(E87=1,E86<=Skl_temp_min),"ОК","НЕТ"),"ОК")',
            ),
            'workbook_feasible': Formula(
                expression='all([task_matches, handling_matches, indoor_matches, payload_matches, aisle_matches, environment_matches])',
                unit='1/0', source='Склад!E95', label='Решение применимо (1/0)', symbol='feasible',
                excel='IF(AND(E89="ОК",E90="ОК",E91="ОК",E92="ОК",E93="ОК",E94="ОК"),1,0)',
            ),
            'applicability_reasons': Formula(
                expression='list the failed checks; keep each excluded candidate visible', unit='',
                source='Склад!E96', label='Причина включения / исключения', symbol='feas_text',
                excel='IF(E95=1,"Применимо: все ключевые ограничения выполнены","Не применимо: "&IF(E89="НЕТ","класс задачи; ","")&IF(E90="НЕТ","способ обработки груза; ","")&IF(E91="НЕТ","не допущен в помещения; ","")&IF(E92="НЕТ","грузоподъёмность ниже массы единицы груза; ","")&IF(E93="НЕТ","габариты не проходят по ширине прохода; ","")&IF(E94="НЕТ","не сертифицирован для условий эксплуатации; ",""))',
            ),
            'power_sufficient': Formula(
                expression='required_charging_power_kw <= site.available_charging_power_kw', unit='',
                source='Склад!E118', label='Проверка электроснабжения', symbol='chk_power',
                excel='IF(E117<=Skl_power_kw,"ОК","Требуется усиление сети")',
            ),
            'within_budget': Formula(
                expression='total_capex <= site.budget_million_rub * 1_000_000', unit='', source='Склад!E135',
                label='Проверка бюджета заказчика', symbol='chk_budget',
                excel='IF(E134<=Skl_budget*1000000,"В бюджете","Превышает бюджет")',
            ),
        },
        'demand': {
            'scenario_operations_per_day': Formula(
                expression='site.operations_per_day * scenario.volume_factor', unit='оп./сут', source='Склад!E98',
                label='Объём операций процесса в сутки (с учётом k_объём)', symbol='ops_day',
                excel='Skl_ops_day*E$66',
            ),
            'automatable_operations_per_day': Formula(
                expression='scenario_operations_per_day * site.automatable_share', unit='оп./сут',
                source='Склад!E99', label='Из них автоматизируемых (× доля автоматизируемых операций)',
                symbol='ops_auto', excel='E98*Skl_auto_share',
            ),
            'trips_per_operation': Formula(
                expression='ceil(site.load_unit_mass_kg / max(robot.payload_kg, 1)) if site.load_is_divisible else 1',
                unit='рейсов', source='Склад!E100',
                label='Рейсов робота на 1 операцию (делимый груз: округление вверх массы/грузоподъёмность)',
                symbol='trips_per_op', excel='IF(Skl_divisible=1,ROUNDUP(Skl_unit_mass/MAX(E76,1),0),1)',
            ),
            'operating_hours_per_day': Formula(
                expression='site.operating_hours_per_day', unit='ч', source='Склад!E101',
                label='Продолжительность работы процесса в сутки', symbol='hours_day', excel='Skl_hours_day',
            ),
            'average_operations_per_hour': Formula(
                expression='automatable_operations_per_day / operating_hours_per_day', unit='оп./ч',
                source='Склад!E102', label='Среднечасовая потребность', symbol='avg_h', excel='E99/E101',
            ),
            'peak_automatable_operations_per_hour': Formula(
                expression='site.peak_operations_per_hour * scenario.volume_factor * site.automatable_share',
                unit='оп./ч', source='Склад!E103', label='Пиковая потребность (автоматизируемая)',
                symbol='peak_h', excel='Skl_peak_ops_h*E$66*Skl_auto_share',
            ),
            'peak_trips_per_hour': Formula(
                expression='peak_automatable_operations_per_hour * trips_per_operation', unit='рейсов/ч',
                source='Склад!E104', label='Пиковая потребность в рейсах робота', symbol='peak_trips',
                excel='E103*E100',
            ),
        },
        'productivity': {
            'one_way_route_m': Formula(
                expression='site.one_way_route_m', unit='м', source='Склад!E106',
                label='Средняя длина маршрута (в одну сторону)', symbol='L', excel='Skl_L',
            ),
            'operating_speed_mps': Formula(
                expression='min(robot.max_speed_mps, site.site_speed_limit_mps) * norms.operating_speed_factor',
                unit='м/с', source='Склад!E107',
                label='Эксплуатационная скорость = MIN(v_max; ограничение объекта) × k_скорости', symbol='v_eff',
                excel='MIN(E77,Skl_speed_cap)*N_kv',
            ),
            'round_trip_movement_seconds': Formula(
                expression='2 * one_way_route_m / operating_speed_mps', unit='с', source='Склад!E108',
                label='Время движения за цикл (туда-обратно)', symbol='t_move', excel='2*E106/E107',
            ),
            'round_trip_lift_seconds': Formula(
                expression='site.lift_trip_share * 2 * site.one_way_lift_seconds', unit='с', source='Склад!E109',
                label='Время ожидания/проезда лифта за цикл', symbol='t_lift',
                excel='Skl_lift_share*2*Skl_lift_time',
            ),
            'cycle_seconds': Formula(
                expression='round_trip_movement_seconds + robot.loading_seconds + robot.unloading_seconds + round_trip_lift_seconds',
                unit='с', source='Склад!E110', label='Полный цикл рейса = движение + загрузка + разгрузка + лифт',
                symbol='t_cycle', excel='E108+E78+E79+E109',
            ),
            'nominal_cycles_per_hour': Formula(
                expression='3600 / cycle_seconds', unit='рейсов/ч', source='Склад!E111',
                label='Циклов в час (номинально)', symbol='cycles_h', excel='3600/E110',
            ),
            'effective_trips_per_robot_hour': Formula(
                expression='nominal_cycles_per_hour * norms.productive_time_share * norms.technical_availability',
                unit='рейсов/ч', source='Склад!E112',
                label='Эффективная производительность одного робота = циклы × k_загрузки × k_готовности',
                symbol='eff_prod', excel='E111*N_util*N_avail',
            ),
        },
        'fleet': {
            'robot_count': Formula(
                expression='max(1, ceil(peak_trips_per_hour / effective_trips_per_robot_hour * (1 + norms.fleet_reserve_share))) if workbook_feasible else 0',
                unit='шт.', source='Склад!E113',
                label='ТРЕБУЕМОЕ КОЛИЧЕСТВО РОБОТОВ = ROUNDUP(пик. рейсов / эфф. произв. × (1 + резерв))',
                symbol='n_robots', excel='IF(E95=1,MAX(1,ROUNDUP(E104/E112*(1+N_reserve),0)),0)',
            ),
            'charger_count': Formula(
                expression='ceil(robot_count / norms.robots_per_charger)', unit='шт.', source='Склад!E114',
                label='Зарядных станций = ROUNDUP(роботов / роботов на станцию)', symbol='n_chargers',
                excel='ROUNDUP(E113/N_charger_ratio,0)',
            ),
            'fleet_peak_capacity_per_hour': Formula(
                expression='robot_count * effective_trips_per_robot_hour', unit='рейсов/ч', source='Склад!E115',
                label='Пропускная способность парка в пике (проверка ≥ пиковой потребности)', symbol='fleet_cap',
                excel='E113*E112',
            ),
            'average_fleet_utilization': Formula(
                expression='average_operations_per_hour * trips_per_operation / (robot_count * nominal_cycles_per_hour) if robot_count > 0 else 0',
                unit='%', source='Склад!E116',
                label='Расчётная загрузка парка при среднесуточном потоке (для имитации)', symbol='util_avg',
                excel='IF(E113>0,E102*E100/(E113*E111),0)',
            ),
            'required_charging_power_kw': Formula(
                expression='charger_count * norms.charger_power_kw', unit='кВт', source='Склад!E117',
                label='Требуемая мощность зарядной инфраструктуры', symbol='power_need',
                excel='E114*N_charger_kw',
            ),
        },
        'opex': {
            'baseline_annual_opex': Formula(
                expression='scenario_baseline_payroll', unit='руб./год', source='Склад!E121',
                label='OPEX базового сценария', symbol='base_opex', excel='E120',
            ),
            'annual_raas_cost': Formula(
                expression='(1 - is_purchase) * robot_count * adjusted_robot_price * norms.monthly_raas_share * 12',
                unit='руб./год', source='Склад!E137',
                label='Платёж RaaS (аренда: цена × ставка/мес × 12; включает сервис, ПО, АКБ)',
                symbol='opex_rent', excel='(1-E123)*E113*E75*N_raas_pct*12',
            ),
            'annual_service_cost': Formula(
                expression='is_purchase * equipment_capex * norms.annual_service_share', unit='руб./год',
                source='Склад!E138', label='Сервисный контракт (покупка)', symbol='opex_service',
                excel='E123*E124*N_service_pct',
            ),
            'annual_license_cost': Formula(
                expression='is_purchase * equipment_capex * norms.annual_license_share', unit='руб./год',
                source='Склад!E139', label='Лицензии ПО (покупка)', symbol='opex_license',
                excel='E123*E124*N_license_pct',
            ),
            'annual_repair_cost': Formula(
                expression='is_purchase * equipment_capex * norms.annual_repair_share', unit='руб./год',
                source='Склад!E140', label='Ремонт и запчасти вне контракта (покупка)', symbol='opex_repair',
                excel='E123*E124*N_repair_pct',
            ),
            'annual_energy_cost': Formula(
                expression='robot_count * robot.average_power_kw * operating_hours_per_day * 365 * norms.electricity_price',
                unit='руб./год', source='Склад!E141',
                label='Электроэнергия = роботов × мощность × часов/сут × 365 × тариф', symbol='opex_energy',
                excel='E113*E80*E101*365*N_energy_price',
            ),
            'annual_connectivity_cost': Formula(
                expression='norms.annual_connectivity_cost if robot_count > 0 else 0', unit='руб./год',
                source='Склад!E142', label='Связь / Wi-Fi', symbol='opex_connect',
                excel='N_connect*IF(E113>0,1,0)',
            ),
            'annual_consumables_cost': Formula(
                expression='site.annual_consumables_per_robot * robot_count', unit='руб./год',
                source='Склад!E143', label='Расходные материалы (объектная норма на робота в год)',
                symbol='opex_consum', excel='Skl_consum_per_robot*E113',
            ),
            'annual_fleet_staff_cost': Formula(
                expression='site.fleet_operators_per_shift * site.shifts_per_day * (1 + site.staff_time_loss_share) * site.fleet_operator_monthly_salary * 12 * norms.payroll_multiplier * scenario.labor_factor if robot_count > 0 else 0',
                unit='руб./год', source='Склад!E144',
                label='Персонал эксплуатации (операторы флота: чел./смену × смен × (1+потери) × оклад × 12 × ФОТ-коэф.)',
                symbol='opex_fleet',
                excel='Skl_fleet_per_shift*Skl_shifts*(1+Skl_loss_k)*Skl_fleet_sal*12*N_fot*E$67*IF(E113>0,1,0)',
            ),
            'annual_financing_cost': Formula(
                expression='is_purchase * total_capex * norms.loan_share * norms.loan_interest_rate * (norms.loan_term_years + 1) / (2 * norms.loan_term_years)',
                unit='руб./год', source='Склад!E145',
                label='Обслуживание долга (если доля заёмного финансирования > 0; средний остаток)',
                symbol='opex_loan', excel='E123*E134*N_loan_share*N_loan_rate*(N_loan_years+1)/(2*N_loan_years)',
            ),
            'annual_solution_opex': Formula(
                expression='annual_raas_cost + annual_service_cost + annual_license_cost + annual_repair_cost + annual_energy_cost + annual_connectivity_cost + annual_consumables_cost + annual_fleet_staff_cost + annual_financing_cost',
                unit='руб./год', source='Склад!E146', label='OPEX решения (дополнительный OPEX) ИТОГО',
                symbol='opex_robot', excel='E137+E138+E139+E140+E141+E142+E143+E144+E145',
            ),
            'annual_process_opex': Formula(
                expression='remaining_annual_payroll + annual_solution_opex', unit='руб./год',
                source='Склад!E151',
                label='OPEX роботизированного сценария ИТОГО (остаточный ФОТ + OPEX решения)',
                symbol='opex_new_total', excel='E150+E146',
            ),
        },
        'capex': {
            'equipment_capex': Formula(
                expression='robot_count * adjusted_robot_price * is_purchase', unit='руб.', source='Склад!E124',
                label='Оборудование = роботов × цена (только при покупке)', symbol='capex_equip',
                excel='E113*E75*E123',
            ),
            'charging_capex': Formula(
                expression='charger_count * norms.charger_installed_price * is_purchase', unit='руб.',
                source='Склад!E125', label='Инфраструктура: зарядные станции (при RaaS — включены в аренду)',
                symbol='capex_chargers', excel='E114*N_charger_price*E123',
            ),
            'site_preparation_capex': Formula(
                expression='robot_count * adjusted_robot_price * site.site_preparation_share', unit='руб.',
                source='Склад!E126',
                label='Инфраструктура: подготовка объекта (разметка, Wi-Fi, двери/лифты/СКУД), % от стоимости парка',
                symbol='capex_site', excel='E113*E75*Skl_site_pct',
            ),
            'software_capex': Formula(
                expression='equipment_capex * norms.fms_upfront_share', unit='руб.', source='Склад!E127',
                label='ПО управления флотом (разовая лицензия/внедрение)', symbol='capex_sw',
                excel='E124*N_sw_pct',
            ),
            'integration_capex': Formula(
                expression='site.integration_cost if robot_count > 0 else 0', unit='руб.', source='Склад!E128',
                label='Интеграция с ИТ-системами объекта (WMS/ERP/1С/AODB/МИС)', symbol='capex_integ',
                excel='Skl_integration*IF(E113>0,1,0)',
            ),
            'delivery_capex': Formula(
                expression='equipment_capex * norms.delivery_share', unit='руб.', source='Склад!E129',
                label='Доставка', symbol='capex_delivery', excel='E124*N_delivery_pct',
            ),
            'commissioning_capex': Formula(
                expression='equipment_capex * norms.commissioning_share + (1 - is_purchase) * robot_count * adjusted_robot_price * norms.raas_setup_share',
                unit='руб.', source='Склад!E130',
                label='Пусконаладка (при RaaS — установочный платёж провайдера)', symbol='capex_pnr',
                excel='E124*N_pnr_pct+(1-E123)*E113*E75*N_raas_setup',
            ),
            'training_capex': Formula(
                expression='norms.training_cost if robot_count > 0 else 0', unit='руб.', source='Склад!E131',
                label='Обучение персонала', symbol='capex_training', excel='N_training*IF(E113>0,1,0)',
            ),
            'capex_before_contingency': Formula(
                expression='equipment_capex + charging_capex + site_preparation_capex + software_capex + integration_capex + delivery_capex + commissioning_capex + training_capex',
                unit='руб.', source='Склад!E132', label='Итого до резерва', symbol='capex_sub',
                excel='E124+E125+E126+E127+E128+E129+E130+E131',
            ),
            'contingency_capex': Formula(
                expression='capex_before_contingency * norms.capex_contingency_share', unit='руб.',
                source='Склад!E133', label='Резерв на непредвиденные расходы', symbol='capex_reserve',
                excel='E132*N_capex_reserve',
            ),
            'total_capex': Formula(
                expression='capex_before_contingency + contingency_capex', unit='руб.', source='Склад!E134',
                label='CAPEX ИТОГО', symbol='capex_total', excel='E132+E133',
            ),
        },
        'effects': {
            'change_in_annual_opex': Formula(
                expression='annual_process_opex - baseline_annual_opex', unit='руб./год', source='Склад!E152',
                label='Изменение OPEX относительно базового сценария (минус = экономия)', symbol='delta_opex',
                excel='E151-E121',
            ),
            'annual_recruitment_saving': Formula(
                expression='released_fte * site.annual_staff_turnover * norms.recruitment_months_salary * site.target_monthly_salary * scenario.labor_factor',
                unit='руб./год', source='Склад!E153',
                label='Экономия на подборе/адаптации (текучесть × высвобожденные FTE × стоимость замены)',
                symbol='hire_saving', excel='E148*Skl_turnover*N_hire_cost*Skl_sal_target*E$67',
            ),
            'annual_other_benefits': Formula(
                expression='site.annual_other_benefits * workbook_feasible', unit='руб./год', source='Склад!E154',
                label='Иные измеримые эффекты (снижение ошибок/потерь; ввод пользователя)', symbol='other_eff',
                excel='Skl_other_effects*E95',
            ),
            'net_annual_benefit': Formula(
                expression='baseline_annual_opex - annual_process_opex + annual_recruitment_saving + annual_other_benefits',
                unit='руб./год', source='Склад!E155',
                label='ЧИСТЫЙ ГОДОВОЙ ЭКОНОМИЧЕСКИЙ ЭФФЕКТ = (OPEX база − OPEX нов.) + иные эффекты',
                symbol='effect_net', excel='E121-E151+E153+E154',
            ),
            'annual_depreciation': Formula(
                expression='total_capex / norms.equipment_life_years * is_purchase', unit='руб./год',
                source='Склад!E156', label='Амортизация CAPEX (линейно, срок службы N_life; при RaaS — 0)',
                symbol='amort', excel='E134/N_life*E123',
            ),
            'annual_benefit_after_depreciation': Formula(
                expression='net_annual_benefit - annual_depreciation', unit='руб./год', source='Склад!E157',
                label='Годовой эффект с учётом амортизации (учётный, Дополнения п.2.2)', symbol='effect_amort',
                excel='E155-E156',
            ),
        },
        'returns': {
            'simple_payback_years': Formula(
                expression='total_capex / net_annual_benefit if workbook_feasible and net_annual_benefit > 0 else None',
                unit='лет', source='Склад!E158', label='ПРОСТОЙ СРОК ОКУПАЕМОСТИ = CAPEX / чистый годовой эффект',
                symbol='payback', excel='IF(AND(E95=1,E155>0),E134/E155,"не окупается")',
            ),
            'horizon_years': Formula(
                expression='site.horizon_years', unit='лет', source='Склад!E159', label='Горизонт расчёта',
                symbol='horizon', excel='Skl_horizon',
            ),
            'battery_replacement_events': Formula(
                expression='is_purchase * floor((horizon_years - 1) / norms.battery_life_years)', unit='шт.',
                source='Склад!E160', label='Замен АКБ на горизонте = INT((горизонт−1)/срок АКБ) (покупка)',
                symbol='batt_events', excel='E123*INT((E159-1)/N_battery_life)',
            ),
            'fleet_battery_replacement_cost': Formula(
                expression='equipment_capex * norms.battery_replacement_share', unit='руб.', source='Склад!E161',
                label='Стоимость одной замены АКБ на парк', symbol='batt_cost', excel='E124*N_battery_share',
            ),
            'cumulative_operating_benefit': Formula(
                expression='net_annual_benefit * horizon_years - battery_replacement_events * fleet_battery_replacement_cost',
                unit='руб.', source='Склад!E162', label='Накопленный эффект за горизонт (за вычетом замен АКБ)',
                symbol='cum_effect', excel='E155*E159-E160*E161',
            ),
            'workbook_roi': Formula(
                expression='cumulative_operating_benefit / total_capex if total_capex > 0 else None', unit='%',
                source='Склад!E163', label='ROI = накопленный эффект за горизонт / CAPEX × 100%', symbol='roi',
                excel='IF(E134>0,E162/E134,"—")',
            ),
            'solution_tco': Formula(
                expression='total_capex + annual_solution_opex * horizon_years + battery_replacement_events * fleet_battery_replacement_cost',
                unit='руб.', source='Склад!E164',
                label='TCO решения = CAPEX + OPEX решения × горизонт + замены АКБ', symbol='tco_solution',
                excel='E134+E146*E159+E160*E161',
            ),
            'baseline_process_tco': Formula(
                expression='baseline_annual_opex * horizon_years', unit='руб.', source='Склад!E165',
                label='Совокупные затраты процесса за горизонт — базовый сценарий', symbol='tco_base',
                excel='E121*E159',
            ),
            'robotized_process_tco': Formula(
                expression='total_capex + annual_process_opex * horizon_years + battery_replacement_events * fleet_battery_replacement_cost',
                unit='руб.', source='Склад!E166',
                label='Совокупные затраты процесса за горизонт — роботизированный сценарий', symbol='tco_new',
                excel='E134+E151*E159+E160*E161',
            ),
            'change_in_process_tco': Formula(
                expression='robotized_process_tco - baseline_process_tco', unit='руб.', source='Склад!E167',
                label='Разница совокупных затрат (минус = выгода роботизации)', symbol='tco_delta',
                excel='E166-E165',
            ),
        },
        'interpretation': {
            'interpretation': Formula(
                expression='inapplicable first; then nonpositive benefit; otherwise payback <= good threshold, <= medium threshold, or above',
                unit='', source='Склад!E168', label='ИНТЕРПРЕТАЦИЯ (ТЗ п.3.5.7: не только порог окупаемости)',
                symbol='verdict',
                excel='IF(E95=0,"Не применимо",IF(E155<=0,"Не окупается: годовой эффект ≤ 0",IF(E158<=N_pb_good,"Высокая целесообразность (окупаемость до "&N_pb_good&" лет)",IF(E158<=N_pb_mid,"Средняя целесообразность ("&N_pb_good&"–"&N_pb_mid&" лет) — рекомендован пилот","Низкая целесообразность (более "&N_pb_mid&" лет) — требует уточнения данных"))))',
            ),
            'risk_notes': Formula(
                expression='catalog status != operation; confirmation != Да; over budget; inadequate power; average utilization < 0.30',
                unit='', source='Склад!E169', label='Ключевые риски и предупреждения', symbol='risks',
                excel='IF(E72<>"operation","Зрелость: статус «"&E72&"»; ","")&IF(E73<>"Да","ТТХ требуют подтверждения; ","")&IF(E135="Превышает бюджет","CAPEX выше планового бюджета; ","")&IF(E118<>"ОК","недостаточно мощности для зарядки; ","")&IF(E116<0.3,"низкая среднесуточная загрузка парка (парк рассчитан на пик) — рассмотреть частичную роботизацию или RaaS; ","")',
            ),
        },
    },
    'catalog_lookups': {
        'name': Formula(
            expression='robot.name', unit='', source='Склад!E71', label='Наименование решения', symbol='sol_name',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_name,MATCH(E$63,Cat_code,0))',
        ),
        'catalog_status': Formula(
            expression='robot.catalog_status', unit='', source='Склад!E72', label='Статус в каталоге',
            symbol='sol_status', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_status,MATCH(E$63,Cat_code,0))',
        ),
        'confirmation_status': Formula(
            expression='robot.confirmation_status', unit='', source='Склад!E73', label='ТТХ подтверждены',
            symbol='sol_conf', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_conf,MATCH(E$63,Cat_code,0))',
        ),
        'price_rub': Formula(
            expression='robot.price_rub', unit='руб.', source='Склад!E74',
            label='Цена изделия по каталогу (с НДС)', symbol='price0',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_price,MATCH(E$63,Cat_code,0))',
        ),
        'payload_kg': Formula(
            expression='robot.payload_kg', unit='кг', source='Склад!E76', label='Грузоподъёмность', symbol='cap',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_cap,MATCH(E$63,Cat_code,0))',
        ),
        'max_speed_mps': Formula(
            expression='robot.max_speed_mps', unit='м/с', source='Склад!E77', label='Максимальная скорость',
            symbol='vmax', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_vmax,MATCH(E$63,Cat_code,0))',
        ),
        'loading_seconds': Formula(
            expression='robot.loading_seconds', unit='с', source='Склад!E78',
            label='Время загрузки (сцепки/подхвата)', symbol='tload',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_tload,MATCH(E$63,Cat_code,0))',
        ),
        'unloading_seconds': Formula(
            expression='robot.unloading_seconds', unit='с', source='Склад!E79', label='Время разгрузки',
            symbol='tunload', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_tunload,MATCH(E$63,Cat_code,0))',
        ),
        'average_power_kw': Formula(
            expression='robot.average_power_kw', unit='кВт', source='Склад!E80',
            label='Средняя потребляемая мощность', symbol='power',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_power,MATCH(E$63,Cat_code,0))',
        ),
        'handling_method': Formula(
            expression='robot.handling_method', unit='', source='Склад!E81', label='Способ обработки груза',
            symbol='handling', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_handling,MATCH(E$63,Cat_code,0))',
        ),
        'indoor_allowed': Formula(
            expression='robot.indoor_allowed', unit='1/0', source='Склад!E82', label='Допуск в помещения',
            symbol='indoor', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_indoor,MATCH(E$63,Cat_code,0))',
        ),
        'task_class': Formula(
            expression='robot.task_class', unit='', source='Склад!E83', label='Класс задачи решения',
            symbol='task', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_task,MATCH(E$63,Cat_code,0))',
        ),
        'width_mm': Formula(
            expression='robot.width_mm', unit='мм', source='Склад!E85', label='Ширина робота', symbol='wid',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_wid,MATCH(E$63,Cat_code,0))',
        ),
        'min_temperature_c': Formula(
            expression='robot.min_temperature_c', unit='°C', source='Склад!E86',
            label='Допустимая минимальная температура', symbol='tmin',
            note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_tmin,MATCH(E$63,Cat_code,0))',
        ),
        'outdoor_allowed': Formula(
            expression='robot.outdoor_allowed', unit='1/0', source='Склад!E87', label='Уличная эксплуатация',
            symbol='outdoor', note='Select by solution_code from recorded or estimated catalog fields.',
            excel='INDEX(Cat_outdoor,MATCH(E$63,Cat_code,0))',
        ),
    },
    'cash_flow': {
        'initial_cash_flow': Formula(
            expression='-total_capex', unit='RUB', source='Склад!C195', label='Year zero investment.',
        ),
        'annual_cash_flow': Formula(
            expression='net_annual_benefit - (fleet_battery_replacement_cost if is_purchase and year % norms.battery_life_years == 0 and year < horizon_years else 0)',
            unit='RUB/year', source='Склад!C196:C205', label='Years 1 through horizon; later years are zero.',
        ),
        'cumulative_cash_flow': Formula(
            expression='sum(cash_flow[0:year + 1])', unit='RUB', source='Склад!D195:D205',
            label='Cumulative cash flow including initial investment.',
        ),
        'discounted_cash_flow': Formula(
            expression='cash_flow[year] / (1 + norms.discount_rate) ** year', unit='RUB',
            source='Склад!E196:E205', label='Annual component of discounted cumulative cash flow.',
        ),
        'npv': Formula(
            expression='sum(discounted_cash_flow[0:horizon_years + 1])', unit='RUB', source='Склад!E206',
            label='Net present value including year zero.',
        ),
        'discounted_payback_years': Formula(
            expression='None if final_discounted_cumulative < 0 else count(discounted_cumulative < 0)',
            unit='years', source='Склад!E207', label='Workbook whole-year convention; not interpolated.',
        ),
    },
}


