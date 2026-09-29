"""HTTP-контракт сервиса: маршруты, коды ответов, хранение в PostgreSQL.

Сервер поднимается в процессе теста на свободном порту поверх тестовой базы;
задания и прогоны заводятся через хранилище, поэтому новых симуляций тесты не
запускают (кроме сквозного теста с воркером).
"""

from __future__ import annotations

import gzip
import json
import socket
import threading
import time
import urllib.error
import urllib.request
import uuid

import conftest
import fakes
import pytest
import uvicorn

from adapters import json_codec
from adapters.postgres import pool as pg_pool
from adapters.postgres import repository
from adapters.web import server as server_lib
from adapters.worker import loop
from app import runtime
from application import models
from simcore import version

pytestmark = pytest.mark.db

# Пользователь запросов: пути заданий открыты только вошедшему.
_TOKEN = "user-token"
_OWNER = "11111111-1111-4111-8111-111111111111"


class _Served:
    """uvicorn с приложением сервиса в фоновом потоке на свободном порту."""

    def __init__(self, repo) -> None:
        app = server_lib.create_app(
            runtime.http_services(
                repo,
                fakes.FakeTokenVerifier(
                    {_TOKEN: fakes.principal(_OWNER, "user")}
                ),
            )
        )
        self._sock = socket.create_server(("127.0.0.1", 0))
        self._server = uvicorn.Server(
            uvicorn.Config(app, log_config=None, lifespan="off", ws="none")
        )
        self._thread = threading.Thread(
            target=self._server.run, kwargs={"sockets": [self._sock]}
        )
        self._thread.start()
        deadline = time.monotonic() + 10
        while not self._server.started:
            assert self._thread.is_alive(), "uvicorn не запустился"
            assert time.monotonic() < deadline, "uvicorn не запустился"
            time.sleep(0.01)
        self.base = f"http://127.0.0.1:{self._sock.getsockname()[1]}"

    def stop(self) -> None:
        """Останавливает сервер и ждёт поток."""
        self._server.should_exit = True
        self._thread.join()
        self._sock.close()


def _serve(repo) -> tuple[_Served, str]:
    served = _Served(repo)
    return served, served.base


@pytest.fixture(name="base", scope="module")
def _base_fixture(pool):
    """Адрес сервера поверх тестовой базы на время модуля."""
    httpd, base = _serve(repository.PostgresJobRepository(pool))
    yield base
    httpd.stop()


def _send(req: urllib.request.Request) -> tuple[int, dict]:
    """Отправляет запрос от пользователя: (код, JSON-ответ)."""
    if not req.has_header("Authorization"):
        req.add_header("Authorization", f"Bearer {_TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        with e:
            return e.code, json.loads(e.read())


def _get(url: str) -> tuple[int, dict]:
    return _send(urllib.request.Request(url))


def _post(url: str, body) -> tuple[int, dict]:
    """POST с любым JSON-значением в теле, в том числе null."""
    return _send(
        urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
    )


def _done_job(repo, verified: dict) -> tuple[str, str]:
    """Завершённое задание с одним прогоном: (job_id, simulation_id)."""
    job_id = uuid.uuid4().hex
    repo.create_job(
        job_id,
        conftest.request_body(),
        [conftest.scenario()],
        "sim-test",
        owner_sub=_OWNER,
    )
    job = repo.claim_next_job("test")
    run = json_codec.json_safe(dict(verified, simulation_id=uuid.uuid4().hex))
    traces_gz, raw = json_codec.pack_traces([{"name": "Из подбора"}])
    stored = models.FinishedRun(
        run["simulation_id"], 0, run, models.PackedTraces(traces_gz, raw)
    )
    repo.finish_job(job_id, job.lease, [stored])
    return job_id, run["simulation_id"]


def test_health_is_ok_with_migrated_database(base):
    assert _get(f"{base}/api/health") == (200, {"status": "ok"})


def test_meta_returns_demo_input_without_money(base):
    status, meta = _get(f"{base}/api/meta")

    assert status == 200
    assert set(meta["demo"]) == {"configurations", "location", "task"}
    assert not conftest.all_keys(meta) & conftest.MONEY_KEYS


def test_schema_and_openapi_are_served(base):
    status, schema = _get(f"{base}/api/simulations/schema")
    assert status == 200
    assert set(schema["properties"]) == {
        "configuration",
        "location",
        "task",
        "scenarios",
    }

    status, spec = _get(f"{base}/api/openapi.json")
    assert status == 200
    assert "/api/health" in spec["paths"]


def test_preview_returns_hourly_demand(base):
    body = dict(conftest.request_body(), scenario=conftest.scenario())

    status, preview = _post(f"{base}/api/simulations/preview", body)

    assert status == 200
    assert preview["calc_peak_trips_h"] == conftest.CALC["peak_trips_h"]


def test_start_queues_the_job(base, repo):
    body = dict(conftest.request_body(), scenarios=[conftest.scenario()])

    status, out = _post(f"{base}/api/simulations", body)

    assert status == 202
    assert out["status_url"] == f"/api/simulations/jobs/{out["job_id"]}"
    status, job = _get(f"{base}{out["status_url"]}")
    assert status == 200
    assert job["status"] == "queued"
    assert set(job) == {"job_id", "status", "log", "elapsed"}
    assert repo.claim_next_job("w").request == conftest.request_body()


def test_done_job_embeds_its_runs(base, repo, verified):
    job_id, sim_id = _done_job(repo, verified)

    status, job = _get(f"{base}/api/simulations/jobs/{job_id}")

    assert status == 200
    assert job["status"] == "done"
    assert job["simulation_ids"] == [sim_id]
    assert job["runs"][0]["simulation_id"] == sim_id


def test_run_is_served(base, repo, verified):
    _, sim_id = _done_job(repo, verified)

    status, run = _get(f"{base}/api/simulations/{sim_id}")

    assert status == 200
    assert run["status"] == verified["status"]


def test_traces_are_served_gzipped_when_accepted(base, repo, verified):
    _, sim_id = _done_job(repo, verified)
    url = f"{base}/api/simulations/{sim_id}/traces"
    auth = {"Authorization": f"Bearer {_TOKEN}"}
    plain = urllib.request.Request(
        url, headers={"Accept-Encoding": "identity", **auth}
    )
    zipped = urllib.request.Request(
        url, headers={"Accept-Encoding": "gzip", **auth}
    )

    with urllib.request.urlopen(plain, timeout=10) as resp:
        assert "Content-Encoding" not in resp.headers
        assert json.loads(resp.read()) == [{"name": "Из подбора"}]
    with urllib.request.urlopen(zipped, timeout=10) as resp:
        assert resp.headers["Content-Encoding"] == "gzip"
        body = gzip.decompress(resp.read())
        assert json.loads(body) == [{"name": "Из подбора"}]


def test_soft_deleted_job_and_its_run_are_not_found(base, repo, pool, verified):
    job_id, sim_id = _done_job(repo, verified)
    with pool.connection() as conn:
        conn.execute(
            "UPDATE jobs SET deleted_at = now() WHERE job_id = %s", (job_id,)
        )

    assert _get(f"{base}/api/simulations/jobs/{job_id}")[0] == 404
    assert _get(f"{base}/api/simulations/{sim_id}")[0] == 404
    assert _get(f"{base}/api/simulations/{sim_id}/traces")[0] == 404


@pytest.mark.parametrize(
    "path",
    [
        "/api/nothing",
        f"/api/simulations/jobs/{uuid.uuid4().hex}",
        "/api/simulations/not-an-id",
        f"/api/simulations/{uuid.uuid4().hex}/viewer",
    ],
)
def test_unknown_paths_are_404(base, path):
    assert _get(f"{base}{path}")[0] == 404


def test_responses_are_not_cached(base):
    with urllib.request.urlopen(f"{base}/api/meta", timeout=10) as resp:
        assert resp.headers["Cache-Control"] == "no-store"
        assert resp.headers["Content-Type"] == "application/json; charset=utf-8"


def test_index_page_is_served(base):
    with urllib.request.urlopen(f"{base}/", timeout=10) as resp:
        assert resp.headers["Content-Type"].startswith("text/html")
        assert b"<html" in resp.read().lower()


def test_wrong_method_is_405_in_service_format(base):
    status, out = _post(f"{base}/api/meta", {})

    assert (status, out) == (405, {"error": "method not allowed"})


def test_job_without_id_is_not_found_as_job(base):
    assert _get(f"{base}/api/simulations/jobs") == (
        404,
        {"error": "Задание не найдено."},
    )


def test_accept_endpoint_is_gone(base, repo, verified):
    """«Учесть» — решение пользователя; его хранит платформа, не сервис."""
    _, sim_id = _done_job(repo, verified)

    status, _ = _post(f"{base}/api/simulations/{sim_id}/accept", {})

    assert status == 404


def test_start_rejects_peaks_filling_the_whole_day(base):
    body = conftest.request_body()
    body["scenarios"] = [
        conftest.scenario(
            schedule={"peaks": [{"flow": "in", "start_h": 8, "dur_h": 8}]}
        )
    ]

    status, out = _post(f"{base}/api/simulations", body)

    assert status == 422
    assert out["errors"][0]["field"] == (
        "scenarios[0].simulation_params.schedule.peaks"
    )


def test_start_rejects_strings_the_database_cannot_store(base):
    body = dict(
        conftest.request_body(),
        scenarios=[dict(conftest.scenario(), name="a\x00b")],
    )

    status, out = _post(f"{base}/api/simulations", body)

    assert status == 422
    assert {e["field"] for e in out["errors"]} == {"scenarios[0].name"}


def test_oversized_body_is_413(base):
    body = dict(conftest.request_body(), padding="x" * 1_100_000)

    status, _ = _post(f"{base}/api/simulations", body)

    assert status == 413


@pytest.mark.parametrize(
    "path",
    ["/api/simulations/preview", "/api/simulations"],
)
@pytest.mark.parametrize(
    "body",
    [
        [],
        "x",
        1,
        None,
        {"configuration": [1]},
        {"configuration": {"robot": "x", "calc": 5}},
        {"location": 5},
        {"task": [1]},
        {"scenarios": "ab"},
        {"scenarios": [1]},
        {"scenario": [1]},
        {"scenarios": [{"simulation_params": {"growth": "много"}}]},
    ],
    ids=repr,
)
def test_malformed_body_gets_an_error_response(base, path, body):
    status, out = _post(f"{base}{path}", body)

    assert status in (400, 422)
    assert out["error"]


def test_unknown_fields_are_rejected_with_their_path(base):
    body = conftest.request_body()
    body["configuration"]["robot"]["robot_id"] = "TEST-1"
    body["location"]["location_id"] = "demo"
    body["economics_basis"] = {}
    body["scenario"] = conftest.scenario()

    status, out = _post(f"{base}/api/simulations/preview", body)

    assert status == 422
    assert {
        "configuration.robot.robot_id",
        "location.location_id",
        "economics_basis",
    } <= {e["field"] for e in out["errors"]}


def test_unavailable_database_gives_503(migrated_url):
    del migrated_url  # нужна только конфигурация тестов
    settings = conftest.settings(
        database_url="postgresql://sim:sim@127.0.0.1:1/simulation_test"
    )
    pool = pg_pool.make_pool(settings.database_url, 0, 1, 0.3)
    pool.open(wait=False)
    httpd, base = _serve(repository.PostgresJobRepository(pool))
    try:
        assert _get(f"{base}/api/health") == (503, {"status": "unavailable"})
        status, out = _get(f"{base}/api/simulations/jobs/{uuid.uuid4().hex}")
        assert status == 503
        assert "недоступно" in out["error"]
    finally:
        httpd.stop()
        pool.close()


def test_job_runs_end_to_end_with_a_worker(pool):
    """POST → воркер считает → задание done → прогон и трассы доступны."""
    settings = conftest.settings()
    repo = repository.PostgresJobRepository(pool)
    httpd, base = _serve(repo)
    stop = threading.Event()
    started = runtime.start_workers(repo, settings, stop, 1)
    try:
        body = dict(conftest.request_body(), scenarios=[conftest.scenario()])
        _, out = _post(f"{base}/api/simulations", body)
        deadline = time.monotonic() + 120
        job = {"status": "queued"}
        while job["status"] in ("queued", "running"):
            assert time.monotonic() < deadline, "задание не завершилось"
            time.sleep(0.5)
            _, job = _get(f"{base}{out["status_url"]}")
        assert job["status"] == "done", job.get("error")
        sim_id = job["simulation_ids"][0]
        _, run = _get(f"{base}/api/simulations/{sim_id}")
        assert run["simulation_version"] == version.SIM_VERSION
        assert _get(f"{base}/api/simulations/{sim_id}/traces")[0] == 200
    finally:
        loop.stop_threads(started, stop)
        for thread, _ in started:
            thread.join()
        httpd.stop()


def test_negative_content_length_is_400_not_a_hang(base):
    """read(-1) читал бы до конца соединения — поток висел бы вечно."""
    host, port = base.removeprefix("http://").split(":")
    with socket.create_connection((host, int(port)), timeout=5) as sock:
        sock.sendall(
            b"POST /api/simulations HTTP/1.1\r\nHost: x\r\n"
            b"Content-Type: application/json\r\nContent-Length: -1\r\n\r\n"
        )
        status_line = sock.recv(200).split(b"\r\n", 1)[0]

    assert b" 400 " in status_line


@pytest.mark.parametrize(
    "header, accepted",
    [
        ("gzip", True),
        ("gzip;q=0.5", True),
        ("identity", False),
        (None, False),
        ("gzip;q=0", False),
        ("gzip; q=0.0", False),
        ("br, *;q=0.1", True),
        ("gzip;q=0.000", False),
    ],
)
def test_accepts_gzip_honours_quality_values(header, accepted):
    assert server_lib.accepts_gzip(header) is accepted
