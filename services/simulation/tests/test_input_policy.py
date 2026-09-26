"""Правило приёма входа: строки, которые PostgreSQL не примет."""

from __future__ import annotations

from application import input_policy


def test_unstorable_fields_finds_nul_and_lone_surrogates_with_paths():
    value = {
        "ok": "текст",
        "scenarios": [{"name": "a\x00b"}],
        "configuration": {"robot": {"name": "\ud800"}},
    }

    assert input_policy.unstorable_fields(value) == [
        "configuration.robot.name",
        "scenarios[0].name",
    ]


def test_unstorable_fields_checks_keys_too():
    assert input_policy.unstorable_fields({"bad\x00key": 1}) == ["bad\x00key"]
