# Critical implementation gaps audit

This read-only audit examines the economic evaluation service at commit
`a58dc983ea9e9ae33ab0b37b810ced28488e784a`. It tests for demonstrated
release blockers and reconciles request inputs against the supplied methodology,
workbooks, product synthesis, and approved ranking contract. No database or
repository data was changed during the audit.

[TOC]

## Verdict and scope

Four P0 release blockers are substantiated. Three can produce misleading
assessment results with valid in-memory requests. The fourth exposes saved
project inputs when the supplied HTTP deployment is reachable. P0 here means a
demonstrated blocker that can materially distort economics or applicability, or
expose project data. Deployment exposure is conditional on the host being
reachable; the missing access control is present in the code.

The implemented slice is an economic evaluation service. The absence of a
catalog UI, 2D simulation, and report export is not counted as a defect in this
calculation path. `README.md` still says ranking is disabled, but the service
defaults to approved `ranking-v1`
(`src/economic_service/application/evaluation.py:38-40`).

Source priority for this review: adopted one-project-one-task, Work Type and
Robot Capability matching, soft budget, and simulation acceptance decisions in
`docs/reference/product/rav5_prd_synthesis.md:14-23`; approved ranking
behavior in `docs/decisions/ranking-methodology-signoff.md`; economic formulas
in `docs/source-materials/economics/Методика_экономической_модели_v1_1.docx`
and the v1.1 workbooks.
The illustrative report and spreadsheet values are not platform defaults.

## P0 findings

### P0-1: Low-readiness products can receive a recommendation rank

**Contract.** `docs/decisions/ranking-methodology-signoff.md:19-25` requires
upstream
evaluation to mark P3 or readiness-below-7 candidates `requires_verification`.
Scoring ranks only `applicable` candidates. The same eligibility rule appears
in `docs/reference/product/rav5_prd_synthesis.md:161-167`.

**Implementation.** `CandidateDto` carries optional `maturity_trl`, catalog
status, and confirmation
(`src/economic_service/adapters/http/schemas.py:284-304`),
but no P3 field. The checks in
`src/economic_service/application/calculation.py:188-405` do not use TRL or
catalog status. `calculation.py:173-178` derives `applicable` only from unknown
physical checks, and `src/economic_service/application/scoring.py:100-104` then
ranks it. Catalog status and confirmation create risk text at
`calculation.py:1531-1538`, without changing eligibility.

**Reproduction and impact.** Replacing the checked-in unit fixture's candidate
with `maturity_trl=3` and `catalog_status="piloting"`, while keeping its
physical
specifications, yielded `applicable`, rank 1, score 49.98. An R&D/hypothesis
product can therefore be presented as a ranked recommendation.

**Minimal remedy.** Apply the signed-off readiness gate before scoring and
represent P3 in the upstream candidate contract. Keep the product visible with
its reason, but do not rank it as applicable.

### P0-2: Multiple sensitivity variants share one scoring key

**Contract.** The economic methodology describes one calculation per object,
process, solution, acquisition model, and parameter variant (§1; F1, F6, F19).
The approved sign-off ranks each applicable solution and acquisition-model
pair (`docs/decisions/ranking-methodology-signoff.md:19-21`). Sensitivity
variants need
their own identity or must stay outside the base ranking.

**Implementation.** The engine calculates every candidate against every
scenario (`src/economic_service/application/calculation.py:99-107`). The
scorer's key contains only candidate ID and acquisition model
(`src/economic_service/application/scoring.py:473-476`). Dictionary creation at
`scoring.py:105-124` overwrites earlier scenarios with the same key, and
`scoring.py:140-166` emits entries using the surviving values. Neither
`CandidateEconomics` nor `RankingItem` has a scenario ID
(`src/economic_service/domain/models.py:315-359`).

**Reproduction and impact.** Two purchase variants with price factors 1 and 5
produced CAPEX of 30,250 and 144,650 RUB. The ranking contained two
indistinguishable purchase entries, each rank 1 and score 49.99, each carrying
the last variant's annual-effect value. The published ranking cannot be
reconciled to the two economic results.

**Minimal remedy.** Identify variants in calculation results and scoring. Rank
only the intended base purchase/RaaS pair; keep sensitivity results separately.
Reject duplicate base scenarios until the contract distinguishes them.

### P0-3: Independent derived labor inputs allow fictitious savings

**Contract.** The warehouse source derives target FTE and target payroll from
workforce/function share and automatable share (`Склад!D48`, `D50`); baseline
payroll is `Склад!D51`. Methodology F35-F38 then calculates released FTE,
payroll savings, remaining payroll, and annual effect. Airport and hospital
workbooks likewise derive target labor (`Аэропорт!D48:D50`,
`Медучреждение!D64:D66`).

**Implementation.** `TaskDto` separately requires `automatable_share`,
`target_fte`, `target_annual_payroll`, and `baseline_annual_opex`
(`src/economic_service/adapters/http/schemas.py:112-129`). Validation checks
ranges, but not relationships among them
(`src/economic_service/domain/validation.py:50-99`). Demand multiplies by
automatable share (`src/economic_service/application/calculation.py:522-543`),
while savings use independently supplied target FTE and payroll
(`calculation.py:443-506`). Remaining payroll is baseline minus saving
(`calculation.py:492-511`).

**Reproduction and impact.** Setting automatable share to zero while retaining
the fixture's target payroll still produced 50,000 RUB/year of payroll saving.
Increasing target payroll above baseline produced negative remaining payroll
and a positive modeled net benefit. Both results were marked `applicable`.

**Minimal remedy.** Derive target FTE and payroll from retained, sourced
workforce, wage, function-share, and automation inputs. For a documented
override, validate consistency with coverage and baseline payroll and mark the
override's source.

### P0-4: Saved project inputs lack HTTP access control

**Contract.** The PRD synthesis requires role access and isolation of user
projects (`docs/reference/product/rav5_prd_synthesis.md:69-78,216-223`).

**Implementation.** POST and GET evaluation routes have no authentication or
ownership dependency (`src/economic_service/http_app.py:106-152`). GET returns
the full `EvaluationSnapshotDto`, including the request and its wages and
budget (`src/economic_service/adapters/http/schemas.py:786-803`). Repository
lookup is by caller-supplied evaluation ID alone
(`src/economic_service/adapters/persistence/sqlalchemy_repository.py:137-154`).
`compose.yaml:7-9` publishes port 8000 on all interfaces.

**Impact.** On a reachable host, a caller who knows an evaluation ID can read
the saved project inputs, and an unauthenticated caller can submit and persist
assessments. The audit did not expose the service or query the database.

**Minimal remedy.** Authenticate the principal and enforce project ownership
for reads and writes, with server-controlled identity. Keep demo deployment on
a trusted local interface until that boundary exists.

## Input reconciliation

### Request inventory and ownership

`EvaluationRequestDto` has seven required top-level keys: `evaluation_id`,
`project_id`, `model_version`, `task`, `candidates`, `norms`, and `scenarios`
(`src/economic_service/adapters/http/schemas.py:521-531`). `TaskDto` has 31
required of 36 fields, `CandidateDto` 18 of 20 per candidate, `NormsDto` 32
of 32, and `ScenarioDto` 5 of 5 per scenario. Some required keys are nullable.
Each required `MoneyDto` also needs amount and currency (`schemas.py:93-99`);
each `SourceDto` needs source, origin, and confirmation (`schemas.py:66-80`).

The tables use these code locators to keep their cells readable:

- `C` = `src/economic_service/application/calculation.py`.
- `S` = `src/economic_service/application/scoring.py`.
- `D` = `src/economic_service/adapters/http/schemas.py`.

“Derived” means the source contains a formula, not that every facility uses
that formula or that the user can never override it. The source workbook cells
were inspected directly; no spreadsheet cell is treated as a required form
field merely because it is populated.

### User, location, and task fields

All fields below are in `D:108-149`. IDs and provenance are listed separately
after the table.

| Field | Owner and classification | Source anchor and downstream use |
| --- | --- | --- |
| `work_type_id`, `allowed_handling_methods` | User task selection; necessary | PRD synthesis §2; ranking workbook `2_Процесс!D21`; matching and handling checks `C:188-248`. |
| `operations_per_day` | Site/process; derivable where raw volumes exist | Warehouse `Склад!D27=D14+D15`; airport `Аэропорт!D27`; hospital `Медучреждение!D41`; methodology F6-F10; demand `C:522-543`. |
| `peak_factor` | Site/task assumption; retained or derived from measured peak | `Склад!D13`, `Медучреждение!D36`; airport source has direct peak `Аэропорт!D10`; methodology F10; peak trips `C:536-543`. |
| `automatable_share` | Task assumption; derived/defaulted, editable | Warehouse `Склад!D28=1-D20`; airport `Аэропорт!D29`; hospital `Медучреждение!D43`; methodology F7/F35; demand `C:522-543` and target labor source formulas. |
| `operating_hours_per_day`, `shifts_per_day` | Site schedule; hours derivable, shifts retained | Warehouse `Склад!D29=D10×D11`; airport `Аэропорт!D26`; methodology F9/F30/F32; demand `C:533-542`, energy and fleet staff `C:1019-1045`. |
| `one_way_route_m`, `site_speed_limit_mps` | Site geometry and operating assumption; route derivable or measured | Warehouse `Склад!D33=√D7`, `D34`; airport `Аэропорт!D32:D33`; methodology F11-F12; cycle `C:619-639`. |
| `load_unit_mass_kg`, `load_is_divisible` | Task/load; mass derivable or measured, divisibility necessary | Warehouse `Склад!D31`; airport `Аэропорт!D30`; methodology F2/F8; payload check `C:283-318`, trips `C:524-532`. |
| `indoor_required`, `outdoor_required`, `operating_min_temperature_c` | Site/task conditions; necessary where applicable | Ranking note §4.2; airport `Аэропорт!D46` derives `D16`; methodology F4; environment check `C:351-405`. |
| `minimum_aisle_m`, `aisle_clearance_m` | Site width derived/measured; clearance editable assumption | Warehouse `Склад!D37=MIN(D8,D9)`, `D38`; methodology F3; aisle check `C:326-349`. The 0.6 m example is not a universal constant. |
| `available_charging_power_kw` | Site infrastructure; recorded | `Склад!D21`, `Аэропорт!D18`, `Медучреждение!D28`; methodology F18; power risk `C:1549-1553`. |
| `target_fte`, `target_annual_payroll`, `baseline_annual_opex` | Workforce-derived; controlled override only | Warehouse `Склад!D48/D50/D51`; airport `Аэропорт!D48:D50`; hospital `Медучреждение!D64:D66`; methodology F19/F35-F38; savings and process OPEX `C:443-511,1067-1073`. Wire name `baseline_annual_opex` maps to baseline **payroll**, not total OPEX (`D:128-133,172`). |
| `fleet_operators_per_shift`, `staff_time_loss_share`, `fleet_operator_monthly_salary` | Site staffing; retained/defaulted, salary often derivable | Warehouse `Склад!D54/D18/D55`; hospital `Медучреждение!D70:D71`; methodology F32; fleet staff OPEX `C:1036-1045`. |
| `target_monthly_salary`, `annual_staff_turnover` | Workforce; salary often derivable, turnover recorded/defaulted | Warehouse `Склад!D52/D53`; airport `Аэропорт!D51:D52`; methodology F37; recruitment saving `C:1226-1232`. |
| `replacement_by_handling` | Task × handling expert assumption; necessary and editable | Warehouse `Склад!D43:D46`; hospital `Медучреждение!D56:D59`; ranking note §6 and methodology F35; savings `C:443-506`. Missing method currently falls back to zero (`src/economic_service/domain/models.py:199-204`). |
| `horizon_years`, `budget` | User/location planning choices; horizon necessary, budget optional | Warehouse `Склад!D23/D22`; methodology F27/F40-F44; TCO/ROI/payback `C:1293-1350`, soft budget fit `S:268-324`. |
| `lift_trip_share`, `one_way_lift_seconds` | Site/task route assumptions; conditional | Warehouse `Склад!D35:D36`; hospital `Медучреждение!D48:D49`; methodology F12; cycle `C:627-636`. |
| `integration_cost`, `annual_consumables_per_robot`, `annual_other_benefits` | Site/task economic assumptions; conditional | Warehouse `Склад!D57:D59`; methodology F24/F31/F38; CAPEX `C:824-828`, OPEX `C:1031-1035`, net benefit `C:1225-1236`. |

`project_id` and `task_id` are generated identifiers; task `source` is
provenance. They are required on the wire but are not separate user economic
assumptions.

### Catalog and Robot Capability fields

All candidate fields are in `D:284-304`. They should be hydrated from versioned
catalog and capability records, with explicit evidence for estimates.

| Field | Classification | Source anchor and downstream use |
| --- | --- | --- |
| `candidate_id`, `robot_code`, `work_type_id`, `handling_method` | Catalog identity/capability | Economic workbook `Каталог!A4:A13`, `AA4:AB13`; PRD synthesis §2; Work Type validation `src/economic_service/domain/validation.py:302-307`, handling and labor `C:207-248,443-506`. |
| `price`, `payload_kg`, `max_speed_mps`, `width_mm` | Catalog/offer values; fixed or explicitly unconfirmed | `Каталог!J: L` and `P`, rows 4:13; methodology F1-F3/F8/F11/F21; checks `C:283-349`, fleet/CAPEX `C:619-639,807-819`. |
| `loading_seconds`, `unloading_seconds`, `average_power_kw` | Robot Capability or expert estimate; confirmation required | `Каталог!V:W`, `T`, rows 4:13; methodology F12/F30; cycle `C:631-639`, energy `C:1019-1025`. |
| `indoor_allowed`, `outdoor_allowed`, `minimum_temperature_c`, `maximum_temperature_c` | Catalog environment values; fixed or unconfirmed | `Каталог!Z/Y/R/S`, rows 4:13; methodology F4; eligibility `C:250-280,351-405`. Maximum temperature is stored but not checked because the task has no maximum-temperature requirement. |
| `catalog_status`, `maturity_trl`, `catalog_completeness_percent` | Catalog/evidence values, not user inputs | Status/TRL `Каталог!G:H`, rows 4:13; maturity/completeness scoring `S:326-355`. The approved sign-off requires sourced TRL/completeness but does not define an authoritative completeness formula. |
| `confirmation`, `source` | Provenance metadata | `Каталог!AD:AG`, rows 4:13. Current candidate-wide confirmation cannot distinguish an estimated load time from a confirmed payload. |

The physical fleet size, charging-station count, cycle, throughput, and
utilization are derived outputs, not candidate input fields. Methodology
F11-F18 and ranking note R1-R6 define their relationships; `C:609-799`
implements them.

### Administrator norms and algorithm settings

All norm fields are required by `NormsDto` (`D:376-408`), but they belong to a
versioned administrator-maintained set, not an ordinary user form. Source
locations below are from the economic workbook's `Нормативы` sheet.

| Field(s) | Classification and downstream formula | Source cell(s) |
| --- | --- | --- |
| `payroll_multiplier`, `recruitment_months_salary` | Admin labor norms; F32/F37; `C:1036-1045,1226-1232` | `D4`, `D27` |
| `productive_time_share`, `technical_availability`, `fleet_reserve_share`, `operating_speed_factor` | Admin productivity/fleet norms; F11-F15; `C:619-644,726-734` | `D5:D8` |
| `robots_per_charger`, `charger_installed_price`, `charger_power_kw` | Admin charging norms; F16/F18/F22; `C:734-750,815-819` | `D9:D11` |
| `fms_upfront_share`, `delivery_share`, `commissioning_share`, `training_cost`, `capex_contingency_share` | Admin CAPEX norms; F24-F26; `C:823-853` | `D12:D16` |
| `annual_service_share`, `annual_license_share`, `annual_repair_share`, `electricity_price`, `annual_connectivity_cost` | Admin OPEX norms; F29-F31; `C:1016-1030` | `D17:D20`, `D23` |
| `battery_life_years`, `battery_replacement_share`, `equipment_life_years` | Admin life assumptions; F39/F41; `C:1237-1240,1300-1311` | `D21:D22`, `D24` |
| `loan_share`, `loan_interest_rate`, `loan_term_years`, `monthly_raas_share`, `raas_setup_share` | Admin financing/acquisition assumptions; F25/F28/F33; `C:830-836,1009-1015,1047-1055` | `D29:D31`, `D25:D26` |
| `good_payback_years`, `medium_payback_years` | Admin interpretation thresholds; `C:1591-1604` | `D32:D33` |
| `discount_rate` | Required but unused in this service; source F45 uses it for NPV | `D28` |
| `site_preparation_share` | Misowned site/task assumption; F23; `C:820-822` | `Склад!D56`, `Аэропорт!D56`, `Медучреждение!D72` |

### Scenarios, configuration, metadata, and derived results

`ScenarioDto` requires `acquisition_model`, `price_factor`, `volume_factor`,
`labor_factor`, and `model_version` (`D:496-508`). Acquisition model is a user
choice. The three factors are sensitivity controls that can equal 1 for a base
assessment; they flow to price, demand, and labor at `C:443-543,807-814`.
Scenario `model_version` duplicates the request model version and is stored but
not checked against it (`src/economic_service/domain/validation.py:275-314`).

Optional request `ranking_weights` contains eight user-adjustable criterion
values. The registered defaults are in
`src/economic_service/application/ranking.py:68-94`, and their validation is in
`src/economic_service/domain/validation.py:244-272`. Optional
`requested_ranking_version` and `calculation_currency` are model/configuration
controls. Money currency/scale and `SourceDto` source/origin/confirmation/
version/note are units and provenance metadata, not extra economic levers.

Derived result fields include robot and charger counts, cycle and effective
productivity, CAPEX categories, OPEX categories, annual effect, payback, ROI,
TCO, budget fit, and ranking contributions (`C:609-1493`, `S:226-470`).
Simulation observations are a separate later output; they must be accepted by
the user before becoming active project assumptions (ranking note §4.3,
PRD synthesis §4.5).

## Count and candidate reductions

There are **33 meaningful task/site field kinds** in `TaskDto` after excluding
generated `project_id`, `task_id`, and the task's `source`. They are all
caller-supplied or overrideable, although five have DTO defaults and some
required keys may contain `null`. Add one acquisition-model choice for a base
run. The three sensitivity factors and eight weight overrides are optional
controls. The 31 numeric/money norm values, candidate specifications, and
provenance fields are not ordinary user assumptions.

For the **warehouse example**, 11 of those 33 are source-derivable from retained
raw data: `operations_per_day`, `automatable_share`,
`operating_hours_per_day`, `one_way_route_m`, `load_unit_mass_kg`,
`minimum_aisle_m`, `target_fte`, `target_annual_payroll`,
`baseline_annual_opex`, `fleet_operator_monthly_salary`, and
`target_monthly_salary`. This leaves **22 independent task/site values
represented by the current DTO**. It does not imply a 22-field form: the raw
volumes, area, shift length, headcount, function share, and wage needed to
derive those 11 are absent from this DTO and must be retained elsewhere.
Other facility types have different derivations. Moving site preparation share
from norms to the site/task side adds one such assumption.

The largest safe caller-facing reduction is to hydrate catalog/Robot Capability
records and the versioned norm set on the server. That removes 18 required
candidate keys per candidate and 32 required norm keys from the caller's
payload, while retaining explicit sourced overrides. `discount_rate` can leave
the evaluation request until discounted cash flow is implemented. Preserve
`maximum_temperature_c` in catalog data, but do not claim it passed an
environment check. Keep derived values visible with formula, units, source,
and override history where the source allows overrides.

## Lower-priority gaps and source conflicts

- `maximum_temperature_c` is accepted but unused; the methodology F4 only
  checks outdoor permission and minimum temperature. Whether to add a task
  maximum-temperature requirement needs a product decision.
- Candidate-wide and task-wide `SourceDto` records are too coarse for the
  PRD's characteristic-level provenance. This can obscure which individual
  technical specifications are estimated (`D:66-80,284-304`).
- The ranking note's title says v1.1 while its version line says v1.0.
  Its old hard-budget mode and maturity/missing-value scoring differ from the
  approved `ranking-v1` sign-off. The adopted sign-off controls the current
  implementation: soft budget, neutral 0.5 for equal criterion values, and
  omitted missing criteria with weight renormalization. The current scorer
  follows that contract (`S:268-324,381-470`).
- The source model uses 365 days in energy F30 and a simplified loan-interest
  formula in F33. They are disclosed workbook conventions, not additional P0
  implementation findings. The source's NPV F45 is not implemented; requiring
  `discount_rate` does not make NPV available.
- Simulation validation, adjusted-input preview, and user acceptance are
  adopted product requirements. This service has only evaluation POST/GET
  routes (`src/economic_service/http_app.py:106-152`); it does not silently
  promote simulation results. The missing simulation workflow is a separate
  product capability, not evidence of an overwrite in this path.

## Verification and source package

The audit inspected `AGENTS.md`, `README.md`, the PRD synthesis, the approved
ranking sign-off, the economic methodology and ranking algorithm DOCX files,
and the economic, ranking, and stepwise v1.1 XLSX workbooks in
`docs/source-materials/`.
It traced DTOs, domain models, validation, calculation, scoring, persistence,
configuration, and API routes. The three result defects above were reproduced
with in-memory Python objects and `-B`; no API, database, migration, or test
suite was run. No tracked files were changed during the original audit.
