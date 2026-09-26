# syntax=docker/dockerfile:1
#
# Сервис simulation (Python). Контекст сборки — корень монорепозитория:
#   docker build -f services/simulation/Dockerfile .
#
# Один образ для трёх ролей:
#   сервер (по умолчанию):  python -m app.server
#   воркеры отдельно:       python -m app.worker
#   миграции (разово):      alembic upgrade head
# Нужен DATABASE_URL — адрес базы сервиса в PostgreSQL.

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# --- зависимости отдельным слоем ---
FROM base AS deps
COPY services/simulation/requirements.txt ./
RUN pip install -r requirements.txt

# --- проверки: docker build --target test -f services/simulation/Dockerfile . ---
# Тесты с базой (метка db) без TEST_DATABASE_URL пропускаются.
FROM deps AS test
COPY services/simulation/ ./
RUN pip install -r requirements-dev.txt && pytest

# --- рантайм: только код сервиса, без тестов и инструментов разработки ---
FROM deps AS runtime
COPY services/simulation/alembic.ini ./
COPY services/simulation/migrations/ ./migrations/
COPY services/simulation/simcore/ ./simcore/
COPY services/simulation/application/ ./application/
COPY services/simulation/adapters/ ./adapters/
COPY services/simulation/app/ ./app/
RUN useradd --system --uid 10001 sim
USER sim
EXPOSE 8765
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 CMD \
    python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3)"
CMD ["python", "-m", "app.server"]
