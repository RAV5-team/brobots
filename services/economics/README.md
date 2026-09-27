# Economic service

The economic service evaluates warehouse robot candidates through a versioned
calculation model and persists immutable evaluation snapshots in PostgreSQL.
It runs as an internal-only service in the root Compose deployment. The Go API
and web application do not call it yet.

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
- `GET /readyz` reports service readiness.
- `POST /api/v1/evaluations` calculates and persists an evaluation.
- `GET /api/v1/evaluations/{evaluation_id}` returns its latest immutable
  revision.

The Compose deployment applies Alembic migrations with the one-shot
`economics-migrate` service before starting the API process. The service listens
on port 8002 within Docker's `internal` network. It has no host-published port
and is not exposed through the gateway.

## Validation status

Independent workbook-backed purchase and RaaS cases are release gates in the
Python CI workflow. Additional model risks found during the draft audit are
recorded as release blockers in
[the economics backlog](../../docs/economics/backlog.md).

The port preserves the draft's current calculation behavior. It does not
provide project orchestration, call integration from the Go API, or a frontend
integration.
