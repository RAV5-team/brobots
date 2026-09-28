"""Stable domain reason codes returned by calculation and ranking."""

from enum import StrEnum


class ReasonCode(StrEnum):
    """Identifies stable calculation and ranking reasons."""

    CATALOG_PRICE_MISSING = "catalog_price_missing"
    PRODUCTIVITY_INPUTS_MISSING = "productivity_inputs_missing"
    LOADING_TIME_MISSING = "loading_time_missing"
    UNLOADING_TIME_MISSING = "unloading_time_missing"
    AVERAGE_POWER_MISSING = "average_power_missing"
    HANDLING_METHOD_MISSING = "handling_method_missing"
    PAYLOAD_MISSING = "payload_missing"
    CATALOG_STATUS_NOT_OPERATIONAL = "catalog_status_not_operational"
    CATALOG_SPECS_UNCONFIRMED = "catalog_specs_unconfirmed"
    CAPEX_EXCEEDS_BUDGET = "capex_exceeds_budget"
    CHARGING_POWER_INSUFFICIENT = "charging_power_insufficient"
    FLEET_UTILIZATION_BELOW_THRESHOLD = "fleet_utilization_below_threshold"
    NON_POSITIVE_ANNUAL_BENEFIT = "non_positive_annual_benefit"
    NO_POSITIVE_WEIGHT_CRITERIA = "no_positive_weight_criteria"
    CALCULATED_METRIC_UNAVAILABLE = "calculated_metric_unavailable"
    CALCULATED_METRIC_NOT_NUMERIC = "calculated_metric_not_numeric"
    LOCATION_BUDGET_UNAVAILABLE = "location_budget_unavailable"
    LOCATION_BUDGET_NEGATIVE = "location_budget_negative"
    UPFRONT_CAPEX_UNAVAILABLE = "upfront_capex_unavailable"
    UPFRONT_CAPEX_NOT_NUMERIC = "upfront_capex_not_numeric"
    UPFRONT_CAPEX_NEGATIVE = "upfront_capex_negative"
    SOURCED_VALUE_UNAVAILABLE = "sourced_value_unavailable"
    SOURCED_VALUE_NOT_FINITE = "sourced_value_not_finite"
    LEGACY_UNMAPPED = "legacy_unmapped"
