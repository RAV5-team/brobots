"""Tests for the evaluation application workflow."""

from dataclasses import replace

import pytest

from economic_service.application.evaluation import (
    EvaluationApplicationService,
    SystemClock,
)
from economic_service.domain.errors import ModelVersionError
from tests.unit.application.test_calculation import _request


class _FailIfCalledCalculator:
    """Calculator spy that fails if model validation runs too late."""

    def calculate(self, request):
        del request
        pytest.fail("Calculation ran before ranking model validation.")


class _FailIfCalledRepository:
    """Repository spy that records forbidden reads and writes."""

    def __init__(self):
        self.called = False

    def get(self, evaluation_id):
        del evaluation_id
        self.called = True
        pytest.fail("Repository read ran before ranking model validation.")

    def save(self, snapshot):
        del snapshot
        self.called = True
        pytest.fail("Repository write ran before ranking model validation.")


def test_unknown_ranking_version_fails_before_calculation_or_persistence():
    repository = _FailIfCalledRepository()
    service = EvaluationApplicationService(
        calculator=_FailIfCalledCalculator(),
        repository=repository,
        clock=SystemClock(),
    )
    request = replace(_request(), requested_ranking_version="ranking-v2")

    with pytest.raises(ModelVersionError):
        service.evaluate(request)

    assert not repository.called
