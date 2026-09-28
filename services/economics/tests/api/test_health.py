"""HTTP health, readiness and request-correlation tests."""

from fastapi.testclient import TestClient

from economic_service.http_app import create_app


def test_health_check_returns_ok() -> None:
    """Health checks report the configured service name."""

    client = TestClient(create_app())

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "economic-service",
    }


def test_request_id_is_forwarded() -> None:
    """Requests preserve a supplied correlation identifier."""

    client = TestClient(create_app())

    response = client.get("/healthz", headers={"X-Request-ID": "test-request"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request"


def test_readiness_reports_database_failure() -> None:
    """Readiness fails while the snapshot database does not answer."""

    def broken() -> None:
        raise OSError("connection refused")

    client = TestClient(create_app(readiness_probe=broken))

    response = client.get("/readyz")

    assert response.status_code == 503


def test_readiness_passes_when_database_answers() -> None:
    """Readiness succeeds when the probe query runs."""

    client = TestClient(create_app(readiness_probe=lambda: None))

    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
