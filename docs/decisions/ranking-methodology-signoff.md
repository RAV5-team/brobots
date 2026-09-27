---
title: Ranking methodology sign-off
status: approved for ranking-v1
owner: Ramil
---

# Ranking methodology sign-off

This document records the approved `ranking-v1` scoring contract used by the
economic evaluation service. Evaluation orchestration supplies calculated
candidate economics and sourced evaluation inputs to the in-process scoring
component, then composes and persists the final immutable result.

## Model identity and eligibility

- `ranking-v1` is the default when a request does not specify a ranking model.
- An explicit model version that is not registered is rejected; it is not
  replaced with another model.
- Score each `applicable` candidate × acquisition-model pair. Keep candidates
  with other statuses and their upstream checks, risks, and reasons in the
  evaluation result, but do not rank them.
- Scoring consumes status and risk context. Upstream eligibility contract:
  matching/evaluation marks P3 or readiness-below-7 candidates
  `requires_verification`. Scoring itself does not derive this status, promote
  candidates, or apply hidden transfer adjustments.
- Users may override all eight weights for one evaluation. Overrides must be
  finite, nonnegative decimal values that sum exactly to 100%.

## Criteria and default weights

| Criterion | Input and unit | Direction | Weight |
|---|---|---|---:|
| Payback | Simple payback, years | Lower is better | 30% |
| ROI | Workbook ROI, fraction | Higher is better | 15% |
| Annual effect | Net annual benefit, RUB/year | Higher is better | 15% |
| Budget fit | Budget-to-upfront-CAPEX fit, fraction | Higher is better | 10% |
| TCO savings | Baseline process TCO minus robotized process TCO, RUB | Higher is better | 10% |
| Maturity | Sourced technology readiness level (TRL), 1–9 | Higher is better | 10% |
| Data quality | Sourced catalog completeness, percent from 0–100 | Higher is better | 5% |
| Fleet utilization | Average fleet utilization, fraction | Higher is better | 5% |

The scorer consumes sourced TRL and completeness values; it does not infer TRL
or calculate catalog completeness. Their source, unit, confirmation state, and
version travel with the criterion trace when supplied.

## Normalization and missing values

For each criterion, normalize available values across the applicable candidate
set using min–max scaling. Reverse the normalized value for payback because a
lower value is better. If all available values for a criterion are equal, give
each candidate a neutral normalized value of `0.5`. Do not apply fixed bounds
or clamp values to external thresholds.

Omit a missing criterion for that candidate and renormalize its remaining
positive configured weights to 100%. If no positive-weight criterion is
available, return an unranked item with a reason instead of a score. Negative
values remain valid inputs where the underlying metric permits them; the
normalization uses the observed candidate values.

## Soft budget fit

Budget is a soft scoring criterion. It never excludes an otherwise applicable
candidate. Calculate fit as:

```text
budget_fit = min(location_budget / total_upfront_CAPEX, 1)
```

For RaaS, total upfront CAPEX is the setup CAPEX. A missing or invalid budget
omits budget fit and records a missing reason. Zero CAPEX with a valid budget
has full fit (`1`). Values are compared in the service's validated calculation
currency and normalized amount scale.

## Score, contribution, and tie rules

- Publish scores on a 0–100 scale.
- Calculate each contribution as normalized value × effective weight, then
  round to two decimal places using decimal half-up rounding.
- Effective weights are the configured weights renormalized over the
  candidate's available positive-weight criteria.
- Define the published total score as the sum of the published contributions.
- Rank by published score using competition ranks (`1, 1, 3`). Sort equal
  scores deterministically by candidate ID, then acquisition model.

## Explanation and persistence boundary

Each criterion trace reports its code, raw value and unit, normalized value,
configured and effective weight, published contribution, and provenance. It
also reports whether the value is missing and the missing reason when known.
Provenance retains the available source, origin, confirmation status, and
version. The ranking result identifies the model version and item status; an
unranked item includes its reason. Candidate checks, exclusions, and risk
reasons remain owned by matching/evaluation.

The scoring component has no persistence or catalog access. The evaluation
orchestrator combines calculation output and the ranking result into the final
evaluation, then saves the immutable snapshot with the request, weight
overrides, score trace, and model version.
