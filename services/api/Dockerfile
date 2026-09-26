# syntax=docker/dockerfile:1
#
# Сервис api (Go). Контекст сборки — корень монорепозитория:
#   docker build -f services/api/Dockerfile .

# --- зависимости отдельным слоем: правка кода не тянет go mod download ---
FROM golang:1.26-alpine AS deps
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download

FROM deps AS source
COPY services/api/ ./

# --- проверки: docker build --target test -f services/api/Dockerfile . ---
# Интеграционные тесты (тег integration) идут в CI с отдельным Postgres.
FROM source AS test
RUN go vet ./... && go test ./...

# --- сборка ---
FROM source AS build
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags "-s -w -X main.version=${VERSION}" \
      -o /out/api ./cmd/api

# --- рантайм ---
FROM alpine:3.20 AS runtime
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 10001 -H app
COPY --from=build /out/api /usr/local/bin/api
USER app
EXPOSE 8000
ENV HTTP_ADDR=:8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/healthz >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/usr/local/bin/api"]
