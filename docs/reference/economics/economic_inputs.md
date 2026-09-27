# Start here

[economic_inputs.py](economic_inputs.py) is the short reading version. It uses
one warehouse example and follows three questions:

1. **What do we know?** Site, workload, staff, robot, and project inputs.
2. **What are we assuming?** Norms, estimated specifications, operating choices,
   labor replacement, and costs.
3. **What do we calculate?** Applicability, demand, productivity, fleet size,
   costs, and benefits.

Values are plain numbers and strings, with units in their names or comments.
For example:

```python
from economic_inputs import raw_inputs, assumptions, calculated_inputs

raw_inputs["operations"]["inbound_pallets_per_day"]  # 1000
assumptions["process"]["operating_speed_factor"]     # 0.6
calculated_inputs["productivity"]["cycle_seconds"]  # Formula text
```

The values illustrate the supplied workbook, not a validated project. Formula
strings explain relationships; this module does not run the economic model.
The short version focuses on the base warehouse purchase scenario. RaaS terms
are shown separately; its full calculation is in the reference.

## Look up details only when needed

[economic_inputs_reference.py](economic_inputs_reference.py) retains the complete
definitions: all three facilities, ten catalog products, bounds, original Excel
formulas, source cells, and provenance notes. No source definitions were discarded.
Its `Input` and `Formula` objects are deliberately separate from the plain values
in the reading version.

[Reference guide](economic_inputs_reference.md) explains that detailed structure.
