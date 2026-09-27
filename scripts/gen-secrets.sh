#!/usr/bin/env bash
# Генерирует случайные секреты в .env (для профиля stand или просто «не как в примере»).
# Создаёт .env из .env.example, если его нет. Демо-пароли не трогает: их задают вручную
# и передают жюри. После смены секретов на уже запущенном стенде нужен `docker compose down -v`.
set -euo pipefail

cd "$(dirname "$0")/.."
[[ -f .env ]] || cp .env.example .env

# hex: без `$` и спецсимволов, безопасно и для Compose, и для sed.
rand() { openssl rand -hex "${1:-24}"; }

set_var() {
  local name=$1 value=$2
  if grep -q "^${name}=" .env; then
    # Переносимо между GNU и BSD sed: пишем во временный файл.
    sed "s|^${name}=.*|${name}=${value}|" .env > .env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$name" "$value" >> .env
  fi
}

set_var POSTGRES_PASSWORD "$(rand)"
set_var KC_DB_PASSWORD "$(rand)"
set_var API_DB_PASSWORD "$(rand)"
set_var SIM_DB_PASSWORD "$(rand)"
set_var ECON_DB_PASSWORD "$(rand)"
set_var KC_ADMIN_PASSWORD "$(rand 16)"
set_var KC_API_INTERNAL_SECRET "$(rand 32)"
chmod 600 .env

echo "Секреты записаны в .env. Пароль администратора Keycloak (master-realm): KC_ADMIN_PASSWORD в .env."
echo "Если стенд уже запускался: docker compose down -v && docker compose up -d --build"
