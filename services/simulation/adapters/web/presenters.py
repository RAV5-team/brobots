"""Тела ответов HTTP API из данных прикладного слоя."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from application import models


def error_body(
    message: str, errors: Sequence[Mapping[str, Any]] | None = None
) -> dict:
    """Тело ответа об ошибке: текст и, если есть, ошибки по полям."""
    body: dict = {"error": message}
    if errors is not None:
        body["errors"] = list(errors)
    return body


def job_body(job: models.JobSnapshot) -> dict:
    """Ответ по заданию: без внутренних полей и пустых значений.

    workers — только если расчёт начат; error и errors — только у error;
    simulation_ids и runs — только у done.
    """
    body: dict = {
        "job_id": job.job_id,
        "status": job.status,
        "log": list(job.log),
        "elapsed": job.elapsed_s,
    }
    if job.workers is not None:
        body["workers"] = job.workers
    if job.status == "error":
        body["error"] = job.error
        if job.errors is not None:
            body["errors"] = list(job.errors)
    if job.status == "done":
        body["simulation_ids"] = list(job.simulation_ids)
        body["runs"] = list(job.runs)
    return body
