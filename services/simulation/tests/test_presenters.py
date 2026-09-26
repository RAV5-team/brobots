"""Тела ответов API: порядок ключей и пропуск пустых полей."""

from __future__ import annotations

from adapters.web import presenters
from application import models


def _snapshot(**over) -> models.JobSnapshot:
    values = dict(
        job_id="a" * 32,
        status="queued",
        log=(),
        elapsed_s=1.5,
        workers=None,
        error=None,
        errors=None,
        simulation_ids=(),
        runs=(),
    )
    values.update(over)
    return models.JobSnapshot(**values)


def test_queued_job_has_only_the_basic_fields():
    assert presenters.job_body(_snapshot()) == {
        "job_id": "a" * 32,
        "status": "queued",
        "log": [],
        "elapsed": 1.5,
    }


def test_running_job_reports_workers():
    body = presenters.job_body(_snapshot(status="running", workers=2))

    assert list(body) == ["job_id", "status", "log", "elapsed", "workers"]


def test_error_job_reports_error_and_field_errors():
    errs = ({"field": "task", "message": "нет"},)

    body = presenters.job_body(
        _snapshot(status="error", error="Ошибка", errors=errs)
    )

    assert body["error"] == "Ошибка"
    assert body["errors"] == list(errs)
    assert "runs" not in body


def test_error_without_field_errors_omits_them():
    body = presenters.job_body(_snapshot(status="error", error="Упал"))

    assert "errors" not in body


def test_done_job_embeds_runs_in_order():
    body = presenters.job_body(
        _snapshot(
            status="done",
            workers=1,
            simulation_ids=("b" * 32,),
            runs=({"simulation_id": "b" * 32},),
        )
    )

    assert list(body)[-2:] == ["simulation_ids", "runs"]
    assert body["runs"] == [{"simulation_id": "b" * 32}]


def test_error_body_includes_field_errors_only_when_given():
    assert presenters.error_body("x") == {"error": "x"}
    assert presenters.error_body("x", []) == {"error": "x", "errors": []}
