# syntax=docker/dockerfile:1
#
# Фронтенд (Vite + React + TS). Контекст сборки — корень монорепозитория:
#   docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
# package-lock.json обязан лежать в git: npm ci ставит ровно зафиксированные версии.
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM deps AS source
COPY apps/web/ ./

# --- проверки: docker build --target test -f apps/web/Dockerfile . ---
FROM source AS test
RUN npm run lint && npm run typecheck && npm test

# --- сборка статики ---
FROM source AS build
# Vite подставляет VITE_* на этапе сборки, а не в рантайме.
# Пусто = относительные пути: запросы идут в тот же origin, nginx проксирует их в api.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- раздача ---
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
