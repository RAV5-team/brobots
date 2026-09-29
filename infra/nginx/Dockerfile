# syntax=docker/dockerfile:1
FROM nginx:1.28-alpine

COPY templates/gateway.coi.conf.template /etc/nginx/templates/default.conf.template
COPY snippets/ /etc/nginx/snippets/

# Render only deployment settings. Nginx variables such as $host and $scheme
# must remain intact in the template.
ENV NGINX_ENVSUBST_FILTER='^(PUBLIC_HOST|ADMIN_ALLOW_CIDR)$'

EXPOSE 80 443
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
