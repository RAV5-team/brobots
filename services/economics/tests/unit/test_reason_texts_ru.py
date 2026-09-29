"""Tests for the stable reason-code display contract."""

from economic_service.adapters.http.reason_texts_ru import REASON_TEXTS_RU
from economic_service.domain.reason_codes import ReasonCode


def test_every_reason_code_has_its_contract_russian_text() -> None:
    assert REASON_TEXTS_RU == {
        ReasonCode.CATALOG_PRICE_MISSING: (
            "Нет цены робота в каталоге — экономику не посчитать."
        ),
        ReasonCode.PRODUCTIVITY_INPUTS_MISSING: (
            "Нет данных для расчёта производительности робота."
        ),
        ReasonCode.LOADING_TIME_MISSING: (
            "Нет времени погрузки робота — производительность не посчитать."
        ),
        ReasonCode.UNLOADING_TIME_MISSING: (
            "Нет времени разгрузки робота — производительность не посчитать."
        ),
        ReasonCode.AVERAGE_POWER_MISSING: (
            "Нет средней мощности робота — OPEX не посчитать."
        ),
        ReasonCode.HANDLING_METHOD_MISSING: (
            "Не указан способ обработки груза — замещение труда не посчитать."
        ),
        ReasonCode.PAYLOAD_MISSING: (
            "Нет грузоподъёмности робота для делимого груза."
        ),
        ReasonCode.CATALOG_STATUS_NOT_OPERATIONAL: (
            "Робот не находится в эксплуатации."
        ),
        ReasonCode.CATALOG_SPECS_UNCONFIRMED: (
            "Характеристики из каталога требуют подтверждения."
        ),
        ReasonCode.CAPEX_EXCEEDS_BUDGET: "CAPEX превышает бюджет локации.",
        ReasonCode.CHARGING_POWER_INSUFFICIENT: (
            "Доступной мощности локации не хватает для зарядных станций."
        ),
        ReasonCode.FLEET_UTILIZATION_BELOW_THRESHOLD: (
            "Средняя загрузка парка ниже 30%."
        ),
        ReasonCode.NON_POSITIVE_ANNUAL_BENEFIT: (
            "Годовой денежный эффект не положительный."
        ),
        ReasonCode.NO_POSITIVE_WEIGHT_CRITERIA: (
            "Нет доступных критериев с ненулевым весом для рейтинга."
        ),
        ReasonCode.CALCULATED_METRIC_UNAVAILABLE: (
            "Расчётный показатель недоступен."
        ),
        ReasonCode.CALCULATED_METRIC_NOT_NUMERIC: (
            "Расчётный показатель не является числом."
        ),
        ReasonCode.LOCATION_BUDGET_UNAVAILABLE: (
            "Бюджет локации не задан."
        ),
        ReasonCode.LOCATION_BUDGET_NEGATIVE: (
            "Бюджет локации не может быть отрицательным."
        ),
        ReasonCode.UPFRONT_CAPEX_UNAVAILABLE: (
            "Сумма капитальных затрат недоступна."
        ),
        ReasonCode.UPFRONT_CAPEX_NOT_NUMERIC: (
            "Сумма капитальных затрат не является числом."
        ),
        ReasonCode.UPFRONT_CAPEX_NEGATIVE: (
            "Сумма капитальных затрат не может быть отрицательной."
        ),
        ReasonCode.SOURCED_VALUE_UNAVAILABLE: (
            "Исходное значение недоступно."
        ),
        ReasonCode.SOURCED_VALUE_NOT_FINITE: (
            "Исходное значение должно быть конечным числом."
        ),
        ReasonCode.LEGACY_UNMAPPED: (
            "Причину сохранённого расчёта определить не удалось."
        ),
    }
