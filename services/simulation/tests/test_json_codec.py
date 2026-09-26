"""JSON-кодек адаптеров: NaN → null, компактный JSON, трассы в gzip."""

from __future__ import annotations

import gzip
import json
import math

import pytest

from adapters import json_codec


def test_json_safe_replaces_nan_and_infinity_at_any_depth():
    value = {"a": math.nan, "b": [1.0, math.inf, {"c": -math.inf}], "d": (1, 2)}

    assert json_codec.json_safe(value) == {
        "a": None,
        "b": [1.0, None, {"c": None}],
        "d": [1, 2],
    }


def test_dumps_refuses_unsanitised_nan():
    with pytest.raises(ValueError):
        json_codec.dumps({"a": math.nan})


def test_dumps_is_compact_utf8_json():
    assert json_codec.dumps({"имя": [1, 2]}) == '{"имя":[1,2]}'


def test_traces_round_trip_through_gzip():
    traces = [{"name": "Из подбора", "summary": {"sla_share": math.nan}}]

    packed, raw_bytes = json_codec.pack_traces(traces)

    assert raw_bytes > 0
    assert json.loads(gzip.decompress(packed)) == [
        {"name": "Из подбора", "summary": {"sla_share": None}}
    ]
