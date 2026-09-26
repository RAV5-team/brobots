"""Extract facility parameters from the organizer datasets into the api seed.

Usage:
    python scripts/extract_datasets.py path/to/Датасеты_хакатон.xlsx

Writes services/api/internal/seed/data/parameters.csv. Budget and horizon rows are
skipped: they are typed columns of a location, not parameters.
"""

import csv
import pathlib
import sys

import openpyxl

SHEETS = {"Склад": ("warehouse", "wh"), "Аэропорт": ("airport", "ap"), "Медучреждение": ("medical", "med")}

# name -> (code suffix, role, staff role, staff attr, required, form section)
MAP = {
    "warehouse": {
        "Общая площадь склада": ("total_area", "total_area", None, None, True, "area"),
        "Площадь активной (роботизируемой) зоны": ("active_area", "active_area", None, None, True, "area"),
        "Высота потолков в зоне хранения": ("ceiling_height", "ceiling_height", None, None, False, "area"),
        "Количество этажей (мезонинов)": ("floors", "floors", None, None, False, "area"),
        "Ширина главных проездов": ("main_aisle_width", None, None, None, False, "object_params"),
        "Ширина рабочих проходов между стеллажами": ("rack_aisle_width", "min_aisle_width", None, None, False, "object_params"),
        "Тип напольного покрытия": ("floor_type", None, None, None, False, "object_params"),
        "Ровность пола (отклонение)": ("floor_flatness", None, None, None, False, "object_params"),
        "Количество рабочих смен в сутки": ("shifts", "shifts_per_day", None, None, True, "schedule"),
        "Рабочих дней в году": ("working_days", "working_days", None, None, False, "schedule"),
        "Продолжительность смены": ("shift_hours", "shift_hours", None, None, True, "schedule"),
        "Пиковый коэффициент нагрузки": ("peak_factor", "peak_factor", None, None, True, "schedule"),
        "Объём приёмки (поддоны/сутки)": ("inbound_pallets", None, None, None, False, "object_params"),
        "Объём отгрузки (поддоны/сутки)": ("outbound_pallets", None, None, None, False, "object_params"),
        "Объём отбора (строк/сутки, всего)": ("picking_lines", None, None, None, False, "object_params"),
        "Объём отбора (штук/сутки, всего)": ("picking_units", None, None, None, False, "object_params"),
        "Доля мелкоштучного отбора (piece-pick)": ("piece_pick_share", None, None, None, False, "object_params"),
        "Количество SKU (активных)": ("sku_count", None, None, None, False, "object_params"),
        "Доля SKU с быстрым оборотом (A-класс)": ("sku_a_share", None, None, None, False, "object_params"),
        "Общая численность персонала склада": ("staff_total", "staff_total", None, None, True, "staff"),
        "Из них: отборщики (комплектовщики)": ("pickers", None, "Отборщики (комплектовщики)", "headcount", False, "staff"),
        "Из них: операторы погрузчиков": ("forklift_operators", None, "Операторы погрузчиков", "headcount", False, "staff"),
        "Из них: операторы упаковочных линий": ("packing_operators", None, "Операторы упаковочных линий", "headcount", False, "staff"),
        "Средняя з/п отборщика (gross)": ("picker_salary", None, "Отборщики (комплектовщики)", "salary", False, "staff"),
        "Средняя з/п оператора погрузчика (gross)": ("forklift_salary", None, "Операторы погрузчиков", "salary", False, "staff"),
        "Коэффициент начислений на ФОТ (страховые взносы)": ("payroll_tax_coef", "payroll_tax_coef", None, None, False, "staff"),
        "Средняя выработка отборщика (строк/ч)": ("picker_productivity", None, None, None, False, "staff"),
        "Коэффициент потерь рабочего времени (отпуск, болезнь, текучесть)": ("work_time_loss", "work_time_loss", None, None, False, "staff"),
        "Средняя длина маршрута отборщика на 1 строку": ("picker_route_length", None, None, None, False, "object_params"),
        "Протяжённость конвейерной/транспортной системы": ("conveyor_length", None, None, None, False, "object_params"),
        "Тип стеллажной системы": ("rack_type", None, None, None, False, "object_params"),
        "Количество паллетомест": ("pallet_places", None, None, None, False, "object_params"),
        "Средняя масса грузовой единицы (паллет)": ("pallet_mass", None, None, None, False, "object_params"),
        "Средняя масса штучной единицы (SKU)": ("unit_mass", None, None, None, False, "object_params"),
        "Средние габариты паллеты (Д×Ш×В)": ("pallet_dimensions", None, None, None, False, "object_params"),
        "Средние габариты штучной единицы (Д×Ш×В)": ("unit_dimensions", None, None, None, False, "object_params"),
        "Доля негабаритных/нестандартных грузов": ("oversize_share", None, None, None, False, "object_params"),
        "Мощность электроснабжения (доступная)": ("power_kw", "available_power_kw", None, None, False, "object_params"),
        "Наличие WMS": ("wms", None, None, None, False, "object_params"),
        "Наличие ERP/1С": ("erp", None, None, None, False, "object_params"),
    },
    "airport": {
        "Суммарная площадь терминала (ов)": ("terminal_area", "total_area", None, None, True, "area"),
        "Площадь перрона и технических зон": ("apron_area", None, None, None, True, "area"),
        "Количество терминалов": ("terminals", None, None, None, False, "area"),
        "Количество выходов на посадку (гейтов)": ("gates", None, None, None, False, "object_params"),
        "Количество взлётно-посадочных полос": ("runways", None, None, None, False, "object_params"),
        "Пассажиропоток (млн пассажиров/год)": ("passengers_year_m", None, None, None, False, "object_params"),
        "Среднесуточное количество пассажиров": ("passengers_day", None, None, None, False, "object_params"),
        "Пиковое количество пассажиров в час (PHF)": ("passengers_peak_hour", None, None, None, False, "object_params"),
        "Доля трансферных пассажиров": ("transfer_share", None, None, None, False, "object_params"),
        "Количество стоек регистрации": ("checkin_desks", None, None, None, False, "object_params"),
        "Среднесуточное количество рейсов (взлёт+посадка)": ("flights_day", None, None, None, False, "object_params"),
        "Пиковое количество рейсов в час": ("flights_peak_hour", None, None, None, False, "object_params"),
        "Среднее время оборота воздушного судна (TAT)": ("turnaround_min", None, None, None, False, "object_params"),
        "Среднее количество операций наземного обслуживания на 1 рейс": ("ops_per_flight", None, None, None, False, "object_params"),
        "Объём перемещения багажа (единиц/сутки)": ("baggage_day", None, None, None, False, "object_params"),
        "Средняя масса единицы багажа": ("baggage_mass", None, None, None, False, "object_params"),
        "Количество стоек выдачи багажа (каруселей)": ("carousels", None, None, None, False, "object_params"),
        "Объём бортового питания (порций/сутки)": ("catering_portions_day", None, None, None, False, "object_params"),
        "Объём заправки воздушных судов (рейсов/сут)": ("refuel_flights_day", None, None, None, False, "object_params"),
        "Суточное количество рейсов внутренних грузовых тележек (внутри терминала)": ("cart_trips_day", None, None, None, False, "object_params"),
        "Количество уборочных машин (терминал)": ("cleaning_machines", None, None, None, False, "object_params"),
        "Площадь, убираемая роботизированной уборкой": ("cleaned_area", "active_area", None, None, False, "object_params"),
        "Суточный объём вывоза мусора (контейнеров)": ("waste_containers_day", None, None, None, False, "object_params"),
        "Численность персонала наземного обслуживания (рамп)": ("ramp_staff", None, "Персонал рампа", "headcount", False, "staff"),
        "Численность персонала внутри терминала (логистика, уборка)": ("terminal_staff", None, "Персонал терминала (логистика, уборка)", "headcount", False, "staff"),
        "Средняя з/п сотрудника наземного обслуживания (gross)": ("ramp_salary", None, "Персонал рампа", "salary", False, "staff"),
        "Средняя з/п уборщика терминала (gross)": ("terminal_salary", None, "Персонал терминала (логистика, уборка)", "salary", False, "staff"),
        "Коэффициент начислений на ФОТ": ("payroll_tax_coef", "payroll_tax_coef", None, None, False, "staff"),
        "Годовая текучесть (персонал терминала)": ("turnover", "turnover", None, None, False, "staff"),
        "Зонирование (количество режимных зон)": ("security_zones", None, None, None, False, "object_params"),
        "Наличие системы контроля доступа (СКУД)": ("access_control", None, None, None, False, "object_params"),
        "Требования по сертификации оборудования для airside": ("airside_certification", None, None, None, False, "object_params"),
        "Ограничения по уровню шума (зона)": ("noise_limit", None, None, None, False, "object_params"),
        "Температура в неотапливаемых зонах (перрон, зима)": ("apron_winter_temp", "min_temperature", None, None, False, "object_params"),
        "Наличие FIDS/AODB системы": ("fids_aodb", None, None, None, False, "object_params"),
        "Наличие BMS (системы управления зданием)": ("bms", None, None, None, False, "object_params"),
        "Доступная мощность для зарядной инфраструктуры": ("charging_power_kw", "available_power_kw", None, None, False, "object_params"),
    },
    "medical": {
        "Тип медицинского учреждения": ("facility_kind", None, None, None, True, "area"),
        "Общая площадь здания(й)": ("total_area", "total_area", None, None, True, "area"),
        "Количество этажей (основной корпус)": ("floors", "floors", None, None, True, "area"),
        "Количество лифтов (грузовых/медицинских)": ("elevators", None, None, None, False, "area"),
        "Количество коек (стационар)": ("beds", None, None, None, True, "object_params"),
        "Коечный фонд в эксплуатации (средняя занятость)": ("bed_occupancy", None, None, None, False, "object_params"),
        "Количество операционных": ("operating_rooms", None, None, None, False, "object_params"),
        "Количество амбулаторных посещений в сутки": ("outpatient_visits_day", None, None, None, False, "object_params"),
        "Режим работы стационара": ("inpatient_schedule", None, None, None, False, "schedule"),
        "Режим работы амбулатории": ("outpatient_schedule", None, None, None, False, "schedule"),
        "Количество смен медперсонала (уход за пациентами)": ("shifts", "shifts_per_day", None, None, False, "schedule"),
        "Пиковое время логистической нагрузки": ("peak_time", None, None, None, False, "schedule"),
        "Количество кормлений в сутки": ("meals_per_day", None, None, None, False, "object_params"),
        "Общее количество порций питания в сутки": ("portions_day", None, None, None, False, "object_params"),
        "Среднее расстояние от пищеблока до отделения": ("kitchen_distance", None, None, None, False, "object_params"),
        "Количество точек раздачи питания (отделений)": ("food_points", None, None, None, False, "object_params"),
        "Средняя масса тележки с питанием (брутто)": ("food_cart_mass", None, None, None, False, "object_params"),
        "Норматив доставки питания (мин от пищеблока до отделения)": ("food_delivery_norm_min", None, None, None, False, "object_params"),
        "Объём грязного белья (кг/сутки)": ("dirty_linen_kg_day", None, None, None, False, "object_params"),
        "Объём чистого белья на раздачу (кг/сутки)": ("clean_linen_kg_day", None, None, None, False, "object_params"),
        "Количество точек сбора/выдачи белья": ("linen_points", None, None, None, False, "object_params"),
        "Периодичность смены белья (раз в сутки, в среднем)": ("linen_changes_day", None, None, None, False, "object_params"),
        "Средняя масса контейнера с бельём": ("linen_container_mass", None, None, None, False, "object_params"),
        "Количество наименований медикаментов в обращении": ("drug_items", None, None, None, False, "object_params"),
        "Объём выдачи медикаментов (заявок/сутки)": ("drug_orders_day", None, None, None, False, "object_params"),
        "Количество аптечных точек выдачи (аптека, аптечные склады)": ("pharmacy_points", None, None, None, False, "object_params"),
        "Количество точек доставки (отделений + ОР + реанимация)": ("delivery_points", None, None, None, False, "object_params"),
        "Среднее время комплектации 1 заявки в аптеке": ("pharmacy_pick_min", None, None, None, False, "object_params"),
        "Доля срочных (STAT) доставок медикаментов": ("stat_share", None, None, None, False, "object_params"),
        "Объём доставки расходных материалов (рейсов/сутки)": ("supplies_trips_day", None, None, None, False, "object_params"),
        "Количество биоматериалов (проб) в сутки": ("samples_day", None, None, None, False, "object_params"),
        "Количество клинико-диагностических лабораторий (КДЛ)": ("labs", None, None, None, False, "object_params"),
        "Среднее время доставки пробы (норматив)": ("sample_delivery_norm_min", None, None, None, False, "object_params"),
        "Объём выдачи результатов анализов (рейсов/сутки)": ("results_trips_day", None, None, None, False, "object_params"),
        "Объём медицинских отходов класса А (ненасыщенные)": ("waste_a_kg_day", None, None, None, False, "object_params"),
        "Объём медицинских отходов класса Б (инфицированные)": ("waste_b_kg_day", None, None, None, False, "object_params"),
        "Количество точек сбора отходов": ("waste_points", None, None, None, False, "object_params"),
        "Периодичность вывоза отходов из отделений": ("waste_pickups_day", None, None, None, False, "object_params"),
        "Численность санитаров и транспортировщиков": ("orderlies", None, "Санитары и транспортировщики", "headcount", False, "staff"),
        "Численность сотрудников пищеблока (раздача)": ("kitchen_staff", None, "Сотрудники пищеблока (раздача)", "headcount", False, "staff"),
        "Численность сотрудников прачечной (транспорт белья)": ("laundry_staff", None, "Сотрудники прачечной (транспорт белья)", "headcount", False, "staff"),
        "Средняя з/п санитара/транспортировщика (gross)": ("orderly_salary", None, "Санитары и транспортировщики", "salary", False, "staff"),
        "Средняя з/п сотрудника пищеблока (gross)": ("kitchen_salary", None, "Сотрудники пищеблока (раздача)", "salary", False, "staff"),
        "Коэффициент начислений на ФОТ": ("payroll_tax_coef", "payroll_tax_coef", None, None, False, "staff"),
        "Годовая текучесть (немедицинский персонал)": ("turnover", "turnover", None, None, False, "staff"),
        "Обеззараживание робота между рейсами": ("disinfection", None, None, None, False, "object_params"),
        "Требования к уровню шума в палатах (ночное время)": ("ward_noise_limit", None, None, None, False, "object_params"),
        "Наличие СКУД (контроль доступа по зонам)": ("access_control", None, None, None, False, "object_params"),
        "Требования к материалу поверхностей робота": ("robot_surface", None, None, None, False, "object_params"),
        "Наличие МИС (медицинская информационная система)": ("mis", None, None, None, False, "object_params"),
        "Наличие ЛИС (лабораторная информационная система)": ("lis", None, None, None, False, "object_params"),
        "Наличие системы управления лифтами (BMS)": ("elevator_bms", None, None, None, False, "object_params"),
        "Ширина коридоров (основных)": ("corridor_width", "min_aisle_width", None, None, False, "object_params"),
        "Наличие пандусов/подъёмников (для межэтажного AMR без лифта)": ("ramps", None, None, None, False, "object_params"),
        "Доступная мощность для зарядной инфраструктуры": ("charging_power_kw", "available_power_kw", None, None, False, "object_params"),
    },
}

SKIP = {"Планируемый бюджет на роботизацию (CAPEX)", "Горизонт расчёта окупаемости"}

HEADER = ["code", "facility_type", "group", "name", "unit", "value_type", "base_number", "base_text", "min", "max",
          "is_required", "is_constant", "role", "staff_role", "staff_attr", "form_section", "hint", "sort"]


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = pathlib.Path(__file__).resolve().parents[1] / "services/api/internal/seed/data/parameters.csv"
    rows, missing = [], []
    for sheet, (ftype, prefix) in SHEETS.items():
        group, sort = "", 0
        for r in wb[sheet].iter_rows(min_row=3, values_only=True):
            name = (r[0] or "").strip() if isinstance(r[0], str) else r[0]
            if not name:
                continue
            if name.startswith("▌"):
                group = name.lstrip("▌ ").strip().capitalize().replace("(ramp)", "(RAMP)")
                continue
            if name in SKIP:
                continue
            spec = MAP[ftype].get(name)
            if spec is None:
                missing.append(f"{sheet}: {name}")
                continue
            code, role, staff_role, staff_attr, required, section = spec
            unit, base, lo, hi, note = r[1], r[2], r[3], r[4], r[5]
            unit = None if unit in (None, "-") else str(unit).strip()
            base_text = base.strip() if isinstance(base, str) else None
            vtype = "number" if num(base) else ("dimensions" if base_text and "×" in base_text else "text")
            lo = lo if num(lo) else None
            hi = hi if num(hi) else None
            constant = (vtype == "number" and lo is not None and lo == hi) or (
                vtype == "text" and isinstance(r[3], str) and r[3].strip() == (base_text or "") and r[3].strip() not in ("-", ""))
            sort += 1
            rows.append([f"{prefix}_{code}", ftype, group, name, unit or "", vtype,
                         base if num(base) else "", base_text or "", "" if lo is None else lo, "" if hi is None else hi,
                         str(required).lower(), str(constant).lower(), role or "", staff_role or "", staff_attr or "",
                         section, (note or "").strip(), sort])
    if missing:
        sys.exit("unmapped parameters:\n" + "\n".join(missing))
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(HEADER)
        w.writerows(rows)
    print(f"wrote {len(rows)} parameters to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
