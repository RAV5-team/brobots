# syntax=docker/dockerfile:1
#
# Оптимизированный образ Keycloak: build-time опции (БД, health, relative path)
# зашиваются на этапе сборки, поэтому контейнер стартует с --optimized без пересборки.
FROM quay.io/keycloak/keycloak:26.7.1 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_HTTP_RELATIVE_PATH=/auth
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm-rav5.json /opt/keycloak/data/import/realm-rav5.json
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
