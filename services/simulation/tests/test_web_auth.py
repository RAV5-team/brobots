"""Доступ к HTTP API: гость, пользователь, сервисный токен, ответы 401/403.

Приложение работает на двойниках портов, база не нужна.
"""

from __future__ import annotations

import conftest
import fakes
from fastapi import testclient
import pytest

from adapters import json_codec
from adapters.web import auth
from adapters.web import server
from application import models
from application import preview
from application import submit

USER = "user-token"
OTHER_USER = "other-user-token"
SERVICE = "service-token"
FOREIGN_SERVICE = "foreign-service-token"
_ID = "0" * 32
_MISSING = "e" * 32


@pytest.fixture(name="verifier")
def _verifier_fixture() -> fakes.FakeTokenVerifier:
    return fakes.FakeTokenVerifier(
        {
            USER: fakes.principal("alice", "user"),
            OTHER_USER: fakes.principal("bob", "user"),
            SERVICE: fakes.principal("svc", "service", azp="rav5-api-internal"),
            FOREIGN_SERVICE: fakes.principal("other", "service", azp="other"),
        }
    )


def _services(verifier: fakes.FakeTokenVerifier) -> server.Services:
    store = fakes.FakeJobStore()
    return server.Services(
        submit=submit.SubmitVerification(store, fakes.SequentialIds()),
        preview=preview.preview_demand,
        reader=store,
        health=store,
        verifier=verifier,
    )


@pytest.fixture(name="client")
def _client_fixture(verifier) -> testclient.TestClient:
    return testclient.TestClient(server.create_app(_services(verifier)))


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


GUARDED = [
    ("get", "/api/meta"),
    ("get", "/api/openapi.json"),
    ("get", "/api/simulations/schema"),
    ("post", "/api/simulations/preview"),
    ("post", "/api/simulations"),
    ("get", f"/api/simulations/jobs/{_ID}"),
    ("get", f"/api/simulations/{_ID}"),
    ("get", f"/api/simulations/{_ID}/traces"),
]


def _call(client, method: str, path: str, headers: dict | None = None):
    body = {}
    if path == "/api/simulations":
        body = dict(conftest.request_body(), scenarios=[conftest.scenario()])
    elif path.endswith("/preview"):
        body = dict(conftest.request_body(), scenario=conftest.scenario())
    if method == "post":
        return client.post(path, json=body, headers=headers)
    return client.get(path, headers=headers)


@pytest.mark.parametrize("method, path", GUARDED)
def test_guest_and_user_pass(client, method, path):
    assert _call(client, method, path).status_code not in (401, 403)
    assert _call(client, method, path, _bearer(USER)).status_code not in (
        401,
        403,
    )


@pytest.mark.parametrize("method, path", GUARDED)
@pytest.mark.parametrize(
    "header",
    ["Bearer garbage", "Bearer ", "Basic YTpi", "garbage"],
    ids=repr,
)
def test_invalid_token_is_401_even_for_guest_routes(
    client, method, path, header
):
    resp = _call(client, method, path, {"Authorization": header})

    assert resp.status_code == 401
    assert resp.headers["WWW-Authenticate"] == 'Bearer error="invalid_token"'
    assert resp.json()["code"] == "unauthorized"
    assert resp.json()["message"]


@pytest.mark.parametrize("method, path", GUARDED)
def test_service_token_on_user_routes_is_403(client, method, path):
    resp = _call(client, method, path, _bearer(SERVICE))

    assert resp.status_code == 403
    assert "WWW-Authenticate" not in resp.headers
    assert resp.json()["code"] == "forbidden"


def test_lowercase_scheme_is_accepted(client):
    resp = client.get("/api/meta", headers={"Authorization": f"bearer {USER}"})

    assert resp.status_code == 200


@pytest.mark.parametrize("path", ["/", "/index.html", "/api/health"])
def test_public_paths_do_not_check_tokens(client, path):
    resp = client.get(path, headers={"Authorization": "Bearer garbage"})

    assert resp.status_code == 200


def test_token_is_checked_before_the_body_is_read(client):
    resp = client.post(
        "/api/simulations",
        content=b"not json",
        headers={"Authorization": "Bearer garbage"},
    )

    assert resp.status_code == 401


def test_health_waits_for_keycloak_keys(client, verifier):
    verifier.ready = False

    assert client.get("/api/health").json() == {"status": "unavailable"}
    assert client.get("/api/health").status_code == 503


@pytest.fixture(name="internal")
def _internal_fixture(verifier) -> testclient.TestClient:
    """Приложение с внутренним путём под require_service."""
    app = server.create_app(_services(verifier))

    @app.get("/internal/ping")
    def ping(caller: auth.Service) -> dict:
        return {"sub": caller.sub}

    @app.get("/whoami")
    def whoami(caller: auth.OptionalUser) -> dict:
        return {"sub": caller.sub if caller else None}

    return testclient.TestClient(app)


@pytest.mark.parametrize(
    "headers",
    [
        {},
        _bearer(USER),
        _bearer(FOREIGN_SERVICE),
        _bearer("garbage"),
        {"Authorization": "Basic YTpi"},
    ],
    ids=["no token", "user", "other client", "invalid", "basic"],
)
def test_internal_paths_admit_only_the_internal_caller(internal, headers):
    resp = internal.get("/internal/ping", headers=headers)

    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthorized"


def test_internal_caller_is_admitted(internal):
    resp = internal.get("/internal/ping", headers=_bearer(SERVICE))

    assert resp.json() == {"sub": "svc"}


@pytest.mark.parametrize(
    "headers, sub",
    [({}, None), (_bearer(USER), "alice")],
    ids=["guest", "user"],
)
def test_handler_sees_the_principal(internal, headers, sub):
    assert internal.get("/whoami", headers=headers).json() == {"sub": sub}


def test_principal_roles():
    admin = models.Principal(
        "a", None, frozenset({"user", "admin"}), "rav5-web"
    )

    assert admin.has_role("admin")
    assert not admin.is_service


# --- владение ---------------------------------------------------------------
@pytest.fixture(name="owned")
def _owned_fixture(verifier):
    """Клиент и хранилище: доступ к заданиям и прогонам по владельцу."""
    services = _services(verifier)
    return testclient.TestClient(server.create_app(services)), services.reader


def _start(client, headers: dict | None = None) -> str:
    body = dict(conftest.request_body(), scenarios=[conftest.scenario()])
    resp = client.post("/api/simulations", json=body, headers=headers)
    assert resp.status_code == 202
    return resp.json()["job_id"]


def _finish(store: fakes.FakeJobStore, job_id: str) -> str:
    """Завершает задание одним прогоном; номер прогона."""
    job = store.claim_next_job("w")
    sim_id = "f" * 32
    traces_gz, raw = json_codec.pack_traces([{"name": "Из подбора"}])
    run = models.FinishedRun(
        sim_id,
        0,
        {"simulation_id": sim_id},
        models.PackedTraces(traces_gz, raw),
    )
    assert store.finish_job(job_id, job.lease, [run])
    return sim_id


def _paths(job_id: str, sim_id: str) -> list[str]:
    return [
        f"/api/simulations/jobs/{job_id}",
        f"/api/simulations/{sim_id}",
        f"/api/simulations/{sim_id}/traces",
    ]


@pytest.mark.parametrize(
    "headers, status",
    [(_bearer(USER), 200), (_bearer(OTHER_USER), 404), ({}, 404)],
    ids=["owner", "other user", "guest"],
)
def test_users_job_and_runs_are_visible_only_to_the_owner(
    owned, headers, status
):
    client, store = owned
    job_id = _start(client, _bearer(USER))
    sim_id = _finish(store, job_id)

    for path in _paths(job_id, sim_id):
        resp = client.get(path, headers=headers)
        assert resp.status_code == status, path


def test_foreign_job_is_indistinguishable_from_a_missing_one(owned):
    client, _ = owned
    job_id = _start(client, _bearer(USER))

    foreign = client.get(
        f"/api/simulations/jobs/{job_id}", headers=_bearer(OTHER_USER)
    )
    missing = client.get(
        f"/api/simulations/jobs/{_MISSING}", headers=_bearer(OTHER_USER)
    )

    assert (foreign.status_code, foreign.json()) == (
        missing.status_code,
        missing.json(),
    )


@pytest.mark.parametrize("headers", [_bearer(USER), {}], ids=["user", "guest"])
def test_guest_job_is_open_by_link(owned, headers):
    client, store = owned
    job_id = _start(client)
    sim_id = _finish(store, job_id)

    for path in _paths(job_id, sim_id):
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, path


def test_token_is_verified_once_per_request(owned, verifier):
    client, _ = owned

    client.get(f"/api/simulations/jobs/{_ID}", headers=_bearer(USER))

    assert verifier.calls == 1
