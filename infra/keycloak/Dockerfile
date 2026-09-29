# syntax=docker/dockerfile:1
#
# Оптимизированный образ Keycloak: build-time опции (БД, health, relative path) и тема входа rav5
# зашиваются на этапе сборки, поэтому контейнер стартует с --optimized без пересборки.
# Контекст сборки — корень монорепозитория: тема берёт UI-kit из apps/web/src.

# --- тема входа rav5 (apps/keycloak-theme): keycloakify упаковывает её в jar через Maven ---
FROM node:22-bookworm-slim AS theme
RUN apt-get update \
    && apt-get install -y --no-install-recommends maven openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo/apps/keycloak-theme
COPY apps/keycloak-theme/package.json apps/keycloak-theme/package-lock.json ./
RUN npm ci
# Зависимости apps/web не нужны: общие пакеты тема подставляет свои (resolve.dedupe, paths в tsconfig).
COPY apps/web/src /repo/apps/web/src
COPY apps/web/public/favicon.svg /repo/apps/web/public/favicon.svg
COPY apps/keycloak-theme/ ./
RUN npm run build-keycloak-theme

FROM quay.io/keycloak/keycloak:26.7.1 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_HTTP_RELATIVE_PATH=/auth
COPY --from=theme /repo/apps/keycloak-theme/dist_keycloak/rav5-theme.jar /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm-rav5.json /opt/keycloak/data/import/realm-rav5.json
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
