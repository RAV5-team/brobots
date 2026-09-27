"""HTTP health and request-correlation tests."""

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

    response = client.get("/readyz", headers={"X-Request-ID": "test-request"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request"
