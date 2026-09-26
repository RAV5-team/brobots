#!/usr/bin/env bash
# Smoke-тесты Keycloak, его БД и шлюза /auth. Нужны: запущенный стенд, docker compose,
# python3 (только стандартная библиотека).
#
#   ./scripts/auth-smoke.sh              # проверки профиля из .env
#   ./scripts/auth-smoke.sh --restart    # + перезапуск Keycloak
#   ./scripts/auth-smoke.sh --insecure   # stand с самоподписанным сертификатом
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/auth_smoke.py "$@"
