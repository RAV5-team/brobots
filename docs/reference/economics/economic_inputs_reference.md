# Economic inputs reference

[`economic_inputs_reference.py`](economic_inputs_reference.py) organizes the economic workbook into
three dictionaries. It is a data dictionary with formula descriptions. Importing
it does not read spreadsheets or run a model. It requires only Python 3.10+.

| Dictionary | What belongs here | Groups |
| --- | --- | --- |
| `raw_inputs` | Recorded facility data, catalog data, user selections | Warehouse, airport, hospital, robots, selection |
| `assumptions` | Organizer norms, team estimates, scenario controls | Facility assumptions, norms, estimated robot specifications, scenario multipliers |
| `calculated_inputs` | Derived fields and their relationships | Facility preprocessing, catalog lookups, candidate metrics, cash flow |

Facility fields are further grouped into **location**, **operations**,
**task and load**, **labor**, and **economics**. Candidate formulas are grouped
into **price**, **applicability**, **demand**, **productivity**, **fleet**,
**labor**, **CAPEX**, **OPEX**, **effects**, **returns**, and **interpretation**.

## Reading a definition

```python
from economic_inputs_reference import raw_inputs, assumptions, calculated_inputs

area = raw_inputs["warehouse"]["location"]["active_area_m2"]
print(area.example)  # 10000, the workbook's illustrative warehouse value
print(area.unit)     # м²
print(area.source)   # Склад!D7
print(area.bounds)   # (5000, 50000), the source validation range

speed_factor = assumptions["norms"]["operations"]["operating_speed_factor"]
print(speed_factor.example)  # 0.6, a team assumption

cycle = calculated_inputs["candidate"]["productivity"]["cycle_seconds"]
print(cycle.expression)  # Movement + loading + unloading + lift time
print(cycle.excel)       # Original spreadsheet formula
```

`Input` preserves the example, unit, source cell, original Russian label,
workbook symbol, available bounds, source note, and origin. `Formula` preserves
the readable expression and the original Excel formula where available.
The English dictionary keys are the reading interface; `symbol` links back to
the workbook's names such as `Skl_S_active` and `N_kv`.

Robot field examples are dictionaries keyed by solution code. An estimated field
is stored under `assumptions["robots"]`; recorded examples for the same field
can be under `raw_inputs["robots"]`. Check both groups for a selected robot.
The split follows yellow cells and explicit estimation notes. Recorded values
are source transcriptions, not independently verified vendor specifications.
Missing values remain `None`, including PuduBot's absent catalog price.

## Following the formulas

Read facility preprocessing first, then demand → productivity → fleet → costs
→ benefits and returns. Formula strings use these shorthand namespaces:

- `warehouse`, `airport`, `hospital`, `norms`: fields across their subgroups.
- `site`, `robot`: the selected facility and robot, including their assumptions.
- `scenario`, `selection`: multipliers and user choices.
- Bare field names: other candidate formulas.

The expressions document relationships; they are not executable object paths.
Some interpretation rules are prose. There is no evaluator or calculation order
implemented. `replacement_by_handling` means the selected site's coefficients
for forks, platform, towing, and body handling.

All numeric examples are the supplied workbook's demo values. A calculated
route estimate remains an assumption-based formula, not a measured distance.
Labor replacement belongs to the task and handling method together.

`SOURCE_NOTES` records source limitations and conventions, including missing-price
filtering, temperature checks, RaaS inclusions, the 365-day energy assumption,
the workbook's ROI definition, and simulation's requirement for user-confirmed
assumption changes. Ranking weights, IRR, and residual value belong to the
companion workbooks and are explicitly outside this economic-workbook reference.

The source documents and workbooks are unchanged. Verification covered all 201
named facility/norm definitions, all 330 catalog cells, and 4,662 numeric formula
comparisons across the workbook's 63 scenario variants. Formula comparisons
used saved Excel results; they do not constitute a fresh workbook recalculation.
