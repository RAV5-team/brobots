# Economic service validation backlog

This backlog records the gaps to close before treating economic outputs as
independently validated recommendations. The current service is deterministic
and traceable, but some validation evidence and model contracts are still
incomplete.

## Validation gaps

### VAL-002 — Add independent golden cases

Priority: P0. Current tests mostly use synthetic fixtures and expected values
from the service assumptions. Add workbook-backed golden cases with manually
or independently calculated expected intermediate and final values so a shared
formula error cannot pass unnoticed.

Reference: [`economic_inputs_reference.py`](../reference/economics/economic_inputs_reference.py#L1630)

### VAL-003 — Make calculation traces replayable

Priority: P1. Traces currently expose formula IDs and input values, but not the
formula expression, source cell or field path, source unit, or implementation
hash. Add a versioned formula registry and enough metadata to reproduce each
derived value programmatically.

Reference: [`models.py`](../../services/economics/src/economic_service/domain/models.py#L275)

### VAL-004 — Complete discounted-return analysis

Priority: P1. `discount_rate` is accepted but not used by the calculation
engine. Implement or explicitly defer NPV, discounted cash flow, discounted
payback, and sensitivity outputs defined by the source model.

Reference: [`economic_inputs_reference.py`](../reference/economics/economic_inputs_reference.py#L2036)

### VAL-005 — Give scenarios stable identities

Priority: P1. Results identify acquisition model but not a unique scenario or
the factors that produced it. Add a scenario ID and preserve price, volume,
labor, and methodology factors in API results and snapshots.

Reference: [`models.py`](../../services/economics/src/economic_service/domain/models.py#L251)

### VAL-007 — Enforce units and presentation precision

Priority: P1. Units are currently strings and raw decimals can reach the API.
Add explicit unit semantics, dimensional validation where practical, and a
documented rounding policy for user-facing monetary and percentage values.

Reference: [`schemas.py`](../../services/economics/src/economic_service/adapters/http/schemas.py#L545)

### VAL-008 — Validate recommendations beyond economics

Priority: P2. `ranking-v1` is implemented; simulation remains outside the
current service boundary. Add ranking invariants and, when simulation is
available, compare analytical results with simulation outcomes, including
tolerance breaches and approved assumption revisions.

Reference: [`ranking-methodology-signoff.md`](../decisions/ranking-methodology-signoff.md#L1)

## Release blockers from the draft audit

These high-priority calculation risks were identified in the source audit and
remain unresolved. The service must not be treated as release-ready until each
item has an approved fix and regression coverage.

### REL-001 — Gate low-readiness candidates before ranking

Candidates with low technology readiness or incomplete catalog evidence can
remain applicable and enter ranking. Define the approved eligibility policy
for piloting and low-readiness candidates, apply it before ranking, and add
cases proving that such candidates cannot be presented as deployable
recommendations.

### REL-002 — Preserve sensitivity-scenario identity

Sensitivity results currently share an identity based on candidate and
acquisition model, so variants can collide. Add a stable scenario identity to
calculation, API results, ranking, and persistence, then verify multiple
variants of the same candidate and acquisition model remain distinct.

### REL-003 — Reconcile automation share with payroll/FTE effects

Automation share and target FTE/payroll can be supplied independently, which
can overstate labor savings. Define and enforce an input reconciliation rule
that ties labor benefit to the automatable share and supported baseline data;
cover partial automation and inconsistent inputs with independent examples.

These findings come from the supplied
[`critical implementation gaps audit`](../source-materials/economics/reviews/2026-09-24-critical-implementation-gaps-audit.md).

VAL-002's workbook-backed cases are now present in
[`test_workbook_golden.py`](../../services/economics/tests/unit/application/test_workbook_golden.py).
They use the source workbook's cached outputs and are configured as CI release
gates. A current diff between the workbook's saved formula values and the
independently transcribed reference/fixture remains a parity risk; resolve that
source disagreement before interpreting green CI as full workbook parity.

## Suggested order

1. Resolve REL-001 through REL-003 and retain regression coverage.
2. Build VAL-003 replayable traces.
3. Complete or explicitly version the scope of VAL-004, VAL-005, and VAL-007.
4. Address VAL-008 when ranking methodology and simulation contracts are
   approved.
