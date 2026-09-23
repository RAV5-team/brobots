# syntax=docker/dockerfile:1
#
# Сервис economics (Python). Контекст сборки — корень монорепозитория:
#   docker build -f services/economics/Dockerfile .
# Корень нужен, чтобы в образ попал общий пакет packages/pycommon.

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# --- зависимости отдельным слоем ---
FROM base AS deps
COPY services/economics/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# --- код ---
FROM deps AS source
# Общий слой сервисов подключается через PYTHONPATH — отдельная сборка пакета не нужна.
COPY packages/pycommon/ /opt/pycommon/
ENV PYTHONPATH=/opt/pycommon
COPY services/economics/ ./

# --- проверки: docker build --target test -f services/economics/Dockerfile . ---
FROM source AS test
RUN pip install --no-cache-dir -r requirements-dev.txt && ruff check . && pytest

# --- рантайм ---
FROM source AS runtime
RUN useradd --uid 10001 --create-home app && chown -R app:app /app
USER app
EXPOSE 8002
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8002/healthz').status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
