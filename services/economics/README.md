# Economic service

The economic service evaluates warehouse robot candidates through a versioned
calculation model and persists immutable evaluation snapshots in PostgreSQL.
It runs as an internal-only service in the root Compose deployment. The project
orchestrator of the Go API calls it on every `POST /projects/{id}/evaluate`
(client `services/api/internal/calc/economics`, see
[`docs/orchestrator.md`](../../docs/orchestrator.md)); the web application
reaches it only through the API.

## Run locally

Use Python 3.12. From the repository root, build the runtime image with:

```sh
docker build -f services/economics/Dockerfile .
```

For local Python development, create an environment, install
`services/economics/requirements-dev.txt`, then run commands from
`services/economics`:

```sh
ruff check src tests
pytest
```

PostgreSQL integration tests require `POSTGRES_TEST_DATABASE_URL`; they fail
when that variable is absent so a CI run cannot silently omit the persistence
checks.

## API and persistence

- `GET /healthz` reports process liveness.
- `GET /readyz` reports readiness: it runs `SELECT 1` on the snapshot database
  and answers 503 while it fails. The Docker healthcheck uses it, so the API
  starts only when the service can calculate.
- `GET /api/v1/model-version` returns the calculation model version callers
  must send (`economic-v1.1`) and the default ranking version (`ranking-v1`).
- `POST /api/v1/evaluations` calculates and persists an evaluation. A
  `model_version` this deployment does not serve is rejected with 409; the list
  lives in `src/economic_service/model_versions.py`.
- `GET /api/v1/evaluations/{evaluation_id}` returns its latest immutable
  revision.

The OpenAPI contract is committed to
[`packages/contracts/openapi/economics.yaml`](../../packages/contracts/openapi/economics.yaml).
After changing the HTTP layer run `python scripts/export_openapi.py`;
`tests/api/test_openapi_contract.py` fails when the file is stale.

The Compose deployment applies Alembic migrations with the one-shot
`economics-migrate` service before starting the API process. The service listens
on port 8002 within Docker's `internal` network. It has no host-published port
and is not exposed through the gateway.

## Validation status

Independent workbook-backed purchase and RaaS cases are release gates in the
Python CI workflow. Additional model risks found during the draft audit are
recorded as release blockers in
[the economics backlog](../../docs/economics/backlog.md).

The port preserves the draft's current calculation behavior. Project
orchestration, norm versioning (screen А5) and the mapping of project data to
the request live in the Go API; the integration notes and backlog are in
[`docs/economics/integration-report.md`](../../docs/economics/integration-report.md).
