# Economics P0 Integration Gaps

**Status: Complete**

## Overview

Address the first three P0 items identified in the reviewed economics
integration report: use catalog throughput when available, calculate only
acquisition models that each candidate offers, and replace English risk and
reason strings with stable codes and Russian display text. Expose the revised
contract as `economic-v1.2`.

## Context

- Economics evaluates supplied candidates and does not query or enumerate the
  catalog.
- The API currently intersects each candidate's acquisition models with the
  requested global models in `services/api/internal/calc/calc.go`. An empty
  candidate list means all requested models. Updating the API is out of scope;
  the service contract must require explicit candidate offers so the API can
  later send its effective list.
- Match candidate offers to requested scenarios in
  `EconomicCalculationEngine.calculate`, before scoring, so normalization
  excludes unoffered candidate and scenario pairs.
- The OpenAPI contract is generated and checked against
  `packages/contracts/openapi/economics.yaml`. Updating this generated file is
  the only implementation-file exception to the `services/economics` boundary.

## Development Approach

- **Testing approach:** TDD. Add focused regression coverage before changing
  behavior.
- Complete each task and its verification before moving to the next task.
- Keep service implementation and tests within `services/economics`.
- Keep reason-code definitions in the domain and Russian display strings in
  the HTTP adapter. Return structured `{code, text_ru}` reason objects without
  parameters.
- The current Go orchestrator must later send each candidate's effective offer
  list and parse structured reasons before integrated use of `economic-v1.2`.

## Implementation Steps

### Task 1: Define the economic-v1.2 request contract

**Files:**

- Modify: `services/economics/src/economic_service/domain/models.py`
- Create: `services/economics/src/economic_service/domain/reason_codes.py`
- Modify: `services/economics/src/economic_service/adapters/http/schemas.py`
- Modify: `services/economics/src/economic_service/domain/validation.py`
- Modify: `services/economics/src/economic_service/model_versions.py`
- Modify relevant contract and validation tests under
  `services/economics/tests/`

- [x] Require each candidate to provide a nonempty, duplicate-free
  `acquisition_models` list.
- [x] Add nullable sourced `throughput_per_hour`, defined in the candidate's
  task process units per hour.
- [x] Validate throughput as positive and finite when present, and validate
  acquisition offers against the request's supported models.
- [x] Advertise `economic-v1.2` and reject `economic-v1.1` for new evaluations.
- [x] Add request, schema, model-version, and validation regression tests; run
  the focused tests before Task 2.

### Task 2: Calculate capacity from catalog throughput

**Files:**

- Modify: `services/economics/src/economic_service/application/formulas.py`
- Modify: `services/economics/src/economic_service/application/calculation.py`
- Modify: `services/economics/tests/unit/application/test_calculation.py`

- [x] Prefer catalog throughput when supplied; otherwise preserve the existing
  speed and cycle-time calculation.
- [x] Convert process units per hour to nominal trips per hour using
  `trips_per_operation`, then apply productive-time and technical-availability
  norms.
- [x] Permit missing candidate speed, loading time, and unloading time when
  catalog throughput supplies the capacity input.
- [x] Trace the catalog rate, conversion factor, nominal capacity, and effective
  capacity; use nominal capacity for average utilization.
- [x] Test unit conversion, norms, precedence, missing cycle inputs, invalid
  rates, and unchanged cycle-based golden behavior; run focused tests before
  Task 3.

### Task 3: Filter acquisition scenarios per candidate

**Files:**

- Modify: `services/economics/src/economic_service/application/calculation.py`
- Modify: `services/economics/src/economic_service/application/scoring.py`
- Modify: `services/economics/tests/unit/application/test_scoring.py`
- Modify relevant calculation tests under
  `services/economics/tests/unit/application/`

- [x] Before `_calculate_candidate`, expand only matching candidate and
  scenario pairs whose acquisition model is in that candidate's offers.
- [x] Omit candidates with no selected scenario and reject a request when no
  candidate and scenario pair matches.
- [x] Normalize scores over only the resulting applicable pairs.
- [x] Test purchase-only, RaaS-only, unmatched candidates, and score changes
  when excluding an unoffered pair. Run focused tests before Task 4.

### Task 4: Return stable reason codes with Russian display text

**Files (relative to `services/economics/src/economic_service`):**

- Create: `adapters/http/reason_texts_ru.py`
- Modify: `application/calculation.py`
- Modify: `application/scoring.py`
- Modify: `adapters/http/schemas.py`
- Modify: `adapters/persistence/codec.py`
- Modify relevant API, unit, and persistence tests under
  `services/economics/tests/`

- [x] Store reason codes in domain snapshots and serialize each risk, unranked
  reason, and criterion missing reason as `{code, text_ru}`.
- [x] Define the following Russian display mapping in the HTTP adapter:

  | Code | Russian text |
  | --- | --- |
  | `catalog_price_missing` | Нет цены робота в каталоге — экономику не посчитать. |
  | `productivity_inputs_missing` | Нет данных для расчёта производительности робота. |
  | `loading_time_missing` | Нет времени погрузки робота — производительность не посчитать. |
  | `unloading_time_missing` | Нет времени разгрузки робота — производительность не посчитать. |
  | `average_power_missing` | Нет средней мощности робота — OPEX не посчитать. |
  | `handling_method_missing` | Не указан способ обработки груза — замещение труда не посчитать. |
  | `payload_missing` | Нет грузоподъёмности робота для делимого груза. |
  | `catalog_status_not_operational` | Робот не находится в эксплуатации. |
  | `catalog_specs_unconfirmed` | Характеристики из каталога требуют подтверждения. |
  | `capex_exceeds_budget` | CAPEX превышает бюджет локации. |
  | `charging_power_insufficient` | Доступной мощности локации не хватает для зарядных станций. |
  | `fleet_utilization_below_threshold` | Средняя загрузка парка ниже 30%. |
  | `non_positive_annual_benefit` | Годовой денежный эффект не положительный. |
  | `no_positive_weight_criteria` | Нет доступных критериев с ненулевым весом для рейтинга. |
  | `calculated_metric_unavailable` | Расчётный показатель недоступен. |
  | `calculated_metric_not_numeric` | Расчётный показатель не является числом. |
  | `location_budget_unavailable` | Бюджет локации не задан. |
  | `location_budget_negative` | Бюджет локации не может быть отрицательным. |
  | `upfront_capex_unavailable` | Сумма капитальных затрат недоступна. |
  | `upfront_capex_not_numeric` | Сумма капитальных затрат не является числом. |
  | `upfront_capex_negative` | Сумма капитальных затрат не может быть отрицательной. |
  | `sourced_value_unavailable` | Исходное значение недоступно. |
  | `sourced_value_not_finite` | Исходное значение должно быть конечным числом. |
  | `legacy_unmapped` | Причину сохранённого расчёта определить не удалось. |

- [x] Map known `economic-v1.1` snapshot text to codes when reading snapshots;
  map unknown legacy text to `legacy_unmapped`.
- [x] Test that every emitted code has Russian text and cover API
  serialization plus new and legacy snapshot reads; run focused tests before
  Task 5.

### Task 5: Update the OpenAPI contract and service documentation

**Files:**

- Modify: `packages/contracts/openapi/economics.yaml` (generated artifact and
  the only implementation-file exception to the service boundary)
- Modify: `services/economics/README.md`

- [x] Regenerate the OpenAPI contract with
  `python scripts/export_openapi.py` from `services/economics`.
- [x] Document candidate offer matching, throughput semantics, `economic-v1.2`,
  and the structured response reason shape in the service README.
- [x] Run the complete economics test suite, including PostgreSQL integration
  tests when `POSTGRES_TEST_DATABASE_URL` is available.
- [x] Run `ruff check src tests` and confirm the OpenAPI contract test passes.

## Assumptions

- Requested scenarios and sensitivity factors remain global; each candidate
  declares its acquisition offers.
- A candidate with no selected matching scenario is omitted. A request with no
  matching pairs is invalid.
- Catalog throughput takes precedence when both throughput and cycle inputs
  are present.
- New evaluations require `economic-v1.2`. Stored results remain retrievable;
  known `economic-v1.1` text is mapped to a code and unknown legacy text to
  `legacy_unmapped`.
- The API orchestrator update is out of scope, but must later forward effective
  candidate offers and parse structured reason objects before integrated use.
