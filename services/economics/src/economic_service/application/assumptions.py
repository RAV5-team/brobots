"""Calculation assumptions shared by the economic application layer."""

from decimal import Decimal

# Constants
ZERO = Decimal("0")
ONE = Decimal("1")
DAYS_PER_YEAR = Decimal("365")
SECONDS_PER_HOUR = Decimal("3600")
MONTHS_PER_YEAR = Decimal("12")
MINIMUM_DIVISIBLE_PAYLOAD = ONE

# Assumptions
ROUND_TRIP_MULTIPLIER = Decimal("2")
LOW_UTILIZATION_THRESHOLD = Decimal("0.30")
