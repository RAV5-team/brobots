"""Сценарий «поставить проверку в очередь»: вход проверяется до записи."""

from __future__ import annotations

import conftest
import fakes
import pytest

from application import errors
from application import submit
from simcore import version


def _submit() -> tuple[submit.SubmitVerification, fakes.FakeJobStore]:
    store = fakes.FakeJobStore()
    return submit.SubmitVerification(store, fakes.SequentialIds()), store


@pytest.mark.parametrize("scenarios", [None, [], "ab", [{}, {}, {}]], ids=repr)
def test_scenario_count_outside_one_to_two_is_rejected(scenarios):
    use_case, store = _submit()
    body = conftest.request_body()
    if scenarios is not None:
        body["scenarios"] = scenarios

    with pytest.raises(errors.InvalidSubmissionError) as e:
        use_case(body)

    assert str(e.value) == "Передайте один или два сценария."
    assert e.value.errors == [{"field": "scenarios", "message": "от 1 до 2"}]
    assert store.claim_next_job("w") is None


def test_scenario_errors_carry_the_path_from_the_request_root():
    use_case, store = _submit()
    bad = conftest.scenario(growth="много")
    body = dict(conftest.request_body(), scenarios=[conftest.scenario(), bad])

    with pytest.raises(errors.InvalidSubmissionError) as e:
        use_case(body)

    assert str(e.value) == "Проверьте входные данные."
    assert [x["field"] for x in e.value.errors] == [
        "scenarios[1].simulation_params.growth"
    ]
    assert store.claim_next_job("w") is None


def test_unstorable_strings_follow_scenario_errors():
    use_case, _ = _submit()
    bad = dict(conftest.scenario(growth="много"), name="a\x00b")
    body = dict(conftest.request_body(), scenarios=[bad])

    with pytest.raises(errors.InvalidSubmissionError) as e:
        use_case(body)

    assert e.value.errors[-1] == {
        "field": "scenarios[0].name",
        "message": "недопустимые символы",
    }
    assert e.value.errors[0]["field"].startswith("scenarios[0].simulation")


def test_valid_body_is_queued_with_request_split_from_scenarios():
    use_case, store = _submit()
    scenarios = [conftest.scenario(), conftest.scenario()]
    body = dict(conftest.request_body(), scenarios=scenarios)

    job_id = use_case(body)

    assert job_id == f"{1:032x}"
    job = store.claim_next_job("w")
    assert job.job_id == job_id
    assert job.request == conftest.request_body()
    assert list(job.scenarios) == scenarios
    assert store.get_job(job_id).status == "running"


def test_job_records_the_simulation_version():
    store = fakes.FakeJobStore()
    recorded = []
    store.create_job = lambda *args: recorded.append(args)
    use_case = submit.SubmitVerification(store, fakes.SequentialIds())

    use_case(dict(conftest.request_body(), scenarios=[conftest.scenario()]))

    assert recorded[0][3] == version.SIM_VERSION
