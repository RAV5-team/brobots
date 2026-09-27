---
title: Currency and extracted-data boundary
status: active
owner: Ramil
---

# Currency and extracted-data boundary

The economic service uses Russian rubles (RUB) as its canonical v1 calculation
currency. This matches the reviewed economic workbook and the extracted
facility/catalog fixtures. The service does not perform foreign-exchange
conversion.

## Monetary input policy

- Every monetary value in one evaluation must use `RUB`.
- `Money.amount` preserves the entered amount and `Money.scale` converts source
  units to base RUB units with `amount * 10 ** scale`.
- A source value such as `80 млн руб.` must be mapped explicitly to
  `Money(amount=80, currency="RUB", scale=6)`.
- A missing source currency is not assumed to be RUB. It remains unresolved or
  is rejected at the adapter boundary until the source is clarified.
- Non-RUB values are rejected in v1. No USD, EUR, or other FX rate is applied
  implicitly.

## Extracted fixtures

The fixture files are:

- `tests/fixtures/extracted/facility_scenarios.json` — facility and process
  parameters extracted from the workbook datasets.
- `tests/fixtures/extracted/catalog_products.json` — catalog identity, status,
  and price fields extracted from the catalog export.

The catalog export currently has `price_currency: null` and does not provide
the technical fields required for a complete economic calculation, including
speed, loading/unloading time, power, width, and environment permissions. The
test adapter therefore preserves the catalog identity and status, leaves those
fields as `None`, and expects `unresolved_economics` or
`requires_verification` results. It must never create technical defaults from a
product name or description.

## Versioning

Changing the canonical currency or the source-unit mapping is a model-contract
change. Pin the calculation model version in each request and preserve the
source file, source row or product identity, original unit, and confirmation
state in the evaluation snapshot.
