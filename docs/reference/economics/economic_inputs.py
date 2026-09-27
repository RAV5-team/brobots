"""Economic model at a glance: what we know, assume, and calculate.

Reading example: warehouse pallet transport with a DMR Carrier P robot.
Values come from the v1.1 economic workbook; they are illustrative, not defaults.
Money is RUB, salaries are monthly gross, and shares use 0.10 for 10%.

This is a readable outline, not an executable model. Formulas below are strings.
All fields, other facilities, catalog records, and exact Excel references live
in economic_inputs_reference.py. Start here; consult that file when needed.
"""


# 1. RAW INPUTS — recorded facts about the site, its work, and the product.
# Sources: workbook «Склад» blocks 1–2 and «Каталог», DMR-CARRIER-P row.
raw_inputs = {
    "location": {
        "active_area_m2": 10_000,
        "main_aisle_m": 3.5,
        "rack_aisle_m": 2.8,
        "available_charging_power_kw": 500,
        "indoor_required": True,
        "outdoor_required": False,
    },
    "operations": {
        "task_class": "transport",
        "inbound_pallets_per_day": 1_000,
        "outbound_pallets_per_day": 1_000,
        "pallet_mass_kg": 800,
        "oversize_share": 0.05,  # These loads remain manual.
        "shifts_per_day": 2,
        "hours_per_shift": 11,
        "peak_factor": 1.5,  # Busiest hour / average hour.
    },
    "labor": {
        "operator_count": 25,  # Total across all shifts.
        "monthly_salary_rub": 120_000,
        "staff_time_loss_share": 0.25,
    },
    "robot": {
        "code": "DMR-CARRIER-P",
        "price_rub": 4_300_000,  # Includes VAT; excludes delivery and commissioning.
        "task_class": "transport",
        "handling_method": "forks",
        "indoor_allowed": True,
        "outdoor_allowed": False,
        "catalog_status": "piloting",
        "specifications_confirmed": "partially",
    },
    "project": {
        "budget_rub": 80_000_000,  # Workbook stores this as 80 million RUB.
        "horizon_years": 5,
        "acquisition_model": "purchase",  # User choice: purchase or raas.
    },
}


# 2. ASSUMPTIONS — organizer norms and team estimates, not measured facts.
# Sources: «Нормативы», «Склад» block 2, yellow cells/notes in «Каталог».
assumptions = {
    "organizer_norms": {
        "payroll_multiplier": 1.302,  # Salary plus employer contributions.
        "productive_time_share": 0.80,
        "fleet_reserve_share": 0.15,
        "capex_contingency_share": 0.10,
        "battery_life_years": 4,
    },
    "robot_estimates": {  # DMR yellow cells: confirm before using in a project.
        "payload_kg": 1_500,
        "max_speed_mps": 1.5,
        "width_mm": 1_000,
        "loading_seconds": 60,
        "unloading_seconds": 60,
        "average_power_kw": 3,
    },
    "process": {
        "allowed_handling_methods": ("forks", "platform"),
        "load_is_divisible": False,  # An overweight pallet cannot be split.
        "route_estimate": "sqrt(active_area_m2)",  # One-way distance; verify on layout.
        "site_speed_limit_mps": 1.5,
        "operating_speed_factor": 0.60,  # Turns, acceleration, and traffic.
        "technical_availability": 0.95,
        "aisle_clearance_m": 0.60,  # Total extra width, both sides combined.
        "lift_delay_seconds": 0,  # This warehouse process does not use lifts.
    },
    "labor": {
        "transport_work_share": 1.0,
        "replacement_by_handling": {"forks": 0.80, "platform": 0.60},
        # Replacement belongs to this task + handling method, not to the robot.
        "fleet_operators_per_shift": 1,
        "fleet_operator_salary": "same as current operator monthly salary",
        "annual_turnover_share": 0,  # Missing source data; benefit excluded.
    },
    "charging": {
        "robots_per_charger": 4,
        "installed_charger_price_rub": 250_000,
        "charger_power_kw": 5,
    },
    "upfront_costs": {
        "software_share": 0.10,  # Shares apply to fleet equipment value.
        "delivery_share": 0.02,
        "commissioning_share": 0.05,
        "site_preparation_share": 0.05,
        "integration_rub": 2_000_000,
        "training_rub": 300_000,
    },
    "running_costs": {
        "annual_service_share": 0.08,  # Shares apply to fleet equipment value.
        "annual_software_share": 0.03,
        "annual_repair_share": 0.02,
        "electricity_rub_per_kwh": 7.5,
        "annual_connectivity_rub": 60_000,
        "battery_replacement_share": 0.10,
    },
    "raas": {
        "monthly_rental_share": 0.03,  # Of robot price, per robot.
        "setup_share": 0.05,
        # Rental includes chargers, service, software, repair, and battery changes.
        # Site preparation, integration, training, energy, and staff remain separate.
    },
}


# 3. CALCULATED INPUTS — the main relationships, in reading order.
# Names refer to fields above or earlier formulas; group prefixes are omitted.
# Formulas assume known, valid inputs and an applicable purchase candidate.
# This outline omits scenario multipliers, financing, and detailed cash flows.
calculated_inputs = {
    "applicability": {
        "task_matches": "robot.task_class == operations.task_class",
        "handling_matches": "handling_method in allowed_handling_methods",
        "indoor_matches": "not indoor_required or indoor_allowed",
        "payload_matches": "payload_kg >= pallet_mass_kg",  # Indivisible load.
        "aisle_matches": "width_mm / 1000 + aisle_clearance_m <= min(main_aisle_m, rack_aisle_m)",
        # Also require a catalog price and suitable operating conditions.
        # Workbook budget/power checks are warnings, separate from physical fit.
    },
    "demand": {
        "operations_per_day": "inbound_pallets_per_day + outbound_pallets_per_day",
        "automatable_share": "1 - oversize_share",
        "hours_per_day": "shifts_per_day * hours_per_shift",
        "average_trips_per_hour": "operations_per_day * automatable_share / hours_per_day",
        "peak_trips_per_hour": "average_trips_per_hour * peak_factor",
    },
    "productivity": {
        "one_way_route_m": "sqrt(active_area_m2)",
        "speed_mps": "min(max_speed_mps, site_speed_limit_mps) * operating_speed_factor",
        "cycle_seconds": "2 * one_way_route_m / speed_mps + loading_seconds + unloading_seconds + lift_delay_seconds",
        "nominal_trips_per_hour": "3600 / cycle_seconds",
        "effective_trips_per_hour": "nominal_trips_per_hour * productive_time_share * technical_availability",
    },
    "fleet": {
        "robot_count": "max(1, ceil(peak_trips_per_hour / effective_trips_per_hour * (1 + fleet_reserve_share)))",
        "charger_count": "ceil(robot_count / robots_per_charger)",
        "charging_power_kw": "charger_count * charger_power_kw",
        "average_utilization": "average_trips_per_hour / (robot_count * nominal_trips_per_hour)",
    },
    "price_and_costs": {
        "equipment_rub": "robot_count * price_rub",
        "chargers_rub": "charger_count * installed_charger_price_rub",
        "setup_rub": "equipment_rub * (software_share + delivery_share + commissioning_share + site_preparation_share) + integration_rub + training_rub",
        "purchase_capex_rub": "(equipment_rub + chargers_rub + setup_rub) * (1 + capex_contingency_share)",
        "annual_energy_rub": "robot_count * average_power_kw * hours_per_day * 365 * electricity_rub_per_kwh",
        # Annual solution OPEX also includes service, software, repair, connectivity,
        # fleet staff, consumables, and any financing. Exact breakdown: reference file.
    },
    "labor_and_returns": {
        "target_fte": "operator_count * transport_work_share * automatable_share",
        "released_fte": "target_fte * replacement_by_handling[handling_method]",
        "annual_payroll_saving_rub": "released_fte * monthly_salary_rub * 12 * payroll_multiplier",
        "net_annual_benefit_rub": "annual_payroll_saving_rub - annual_solution_opex_rub + annual_recruitment_saving_rub + annual_other_benefits_rub",
        "payback_years": "purchase_capex_rub / net_annual_benefit_rub if net_annual_benefit_rub > 0 else None",
        # OPEX and additional benefits above are totals detailed in the reference.
        # ROI, TCO, batteries, and NPV are also there; no second set of rules here.
    },
}
