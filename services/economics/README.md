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

For local Python development, create an environment and install the service's
development requirements from `services/economics`:

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
PYTHONPATH=src .venv/bin/ruff check src tests
PYTHONPATH=src .venv/bin/pytest
```

PostgreSQL integration tests require `POSTGRES_TEST_DATABASE_URL` to point to a
dedicated test database. They apply the service's Alembic migrations and fail
when the variable is absent so a CI run cannot silently omit the persistence
checks.

## API and persistence

- `GET /healthz` reports process liveness.
- `GET /readyz` reports readiness: it runs `SELECT 1` on the snapshot database
  and answers 503 while it fails. The Docker healthcheck uses it, so the API
  starts only when the service can calculate.
- `GET /api/v1/model-version` returns the calculation model version callers
  must send (`economic-v1.2`) and the default ranking version (`ranking-v1`).
- `POST /api/v1/evaluations` calculates and persists an evaluation. A
  `model_version` this deployment does not serve is rejected with 409; the list
  lives in `src/economic_service/model_versions.py`.
- `GET /api/v1/evaluations/{evaluation_id}` returns its latest immutable
  revision.

## Request matching and capacity

Each candidate must provide a nonempty, duplicate-free `acquisition_models`
list. The request's scenarios are global; the service calculates a candidate
only for scenarios whose acquisition model appears in that candidate's offers.
Candidates with no matching requested scenario are omitted. The request is
rejected when no candidate and scenario pair matches.

`throughput_per_hour` is an optional sourced catalog value measured in the
candidate's task-process units per hour. When present, it takes precedence over
speed and cycle-time inputs. The service multiplies it by trips per process
unit to get nominal trips per robot hour, then applies productive-time and
technical-availability norms to calculate effective capacity. Average
utilization uses nominal capacity. Without catalog throughput, capacity is
calculated from speed, route, loading, and unloading times.

New evaluations use `economic-v1.2`; `economic-v1.1` is not accepted for new
requests. Stored evaluations remain retrievable, and known legacy reason text
is converted to stable codes when snapshots are read.

## Structured reasons

Candidate and ranking `risks`, an item's `unranked_reason`, and a criterion's
`missing_reason` use stable reason codes paired with Russian display text:

```json
{
  "code": "catalog_specs_unconfirmed",
  "text_ru": "Характеристики из каталога требуют подтверждения."
}
```

Reason objects have no parameters. Clients should branch on `code`; `text_ru`
is for display. Optional `unranked_reason` and `missing_reason` fields are
`null` when there is no reason.

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

This service now calculates with `economic-v1.2`. Before using that version
end to end, the Go adapter must send each candidate's acquisition offers and
read structured reason objects. Project orchestration, norm versioning (screen
А5) and the mapping of project data to the request live in the Go API; the
integration notes and backlog are in
[`docs/economics/integration-report.md`](../../docs/economics/integration-report.md).
