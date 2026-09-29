#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"

usage() {
  cat >&2 <<'USAGE'
Usage: infra/deploy/release-yandex-images.sh <full-commit-sha>

Required environment:
  YC_REGISTRY_ID              Yandex Container Registry ID
  TARGET_PLATFORM             Verified target platform, such as linux/amd64
  TARGET_PLATFORM_VERIFIED    Must be set to true after checking the target VM
  TEST_DATABASE_URL           PostgreSQL URL for API integration tests
  POSTGRES_TEST_DATABASE_URL  PostgreSQL URL for economics tests
  SIMULATION_TEST_DATABASE_URL PostgreSQL URL for simulation tests

Web build arguments are passed through from WEB_DEMO_MODE,
VITE_DEMO_USER_EMAIL, VITE_DEMO_USER_PASSWORD, VITE_DEMO_ADMIN_EMAIL,
VITE_DEMO_ADMIN_PASSWORD, and VITE_PUBLIC_SITE_URL. Demo mode defaults to false.
ECONOMICS_PYTEST and SIMULATION_PYTEST can select separate pytest executables.
USAGE
  exit 2
}

fail() {
  printf 'release-yandex-images: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage
release_sha=$1
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail 'argument must be a full 40-character lowercase commit SHA'

current_sha=$(git -C "$REPO_ROOT" rev-parse HEAD)
[[ "$release_sha" == "$current_sha" ]] || fail 'argument must equal the current checkout commit SHA'
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)" ]]; then
  fail 'checkout must be clean before release'
fi

for required in YC_REGISTRY_ID TARGET_PLATFORM TARGET_PLATFORM_VERIFIED \
  TEST_DATABASE_URL POSTGRES_TEST_DATABASE_URL SIMULATION_TEST_DATABASE_URL; do
  [[ -n "${!required:-}" ]] || fail "missing required configuration: $required"
done
[[ "$YC_REGISTRY_ID" =~ ^[a-zA-Z0-9]+$ ]] || fail 'YC_REGISTRY_ID must contain only letters and digits'
[[ "$TARGET_PLATFORM" =~ ^linux/(amd64|arm64)$ ]] || fail 'TARGET_PLATFORM must be linux/amd64 or linux/arm64'
[[ "$TARGET_PLATFORM_VERIFIED" == true ]] || fail 'set TARGET_PLATFORM_VERIFIED=true only after verifying the target VM platform'
economics_pytest=${ECONOMICS_PYTEST:-pytest}
simulation_pytest=${SIMULATION_PYTEST:-pytest}

command -v docker >/dev/null 2>&1 || fail 'docker command is unavailable'
command -v yc >/dev/null 2>&1 || fail 'yc command is unavailable'
docker info >/dev/null 2>&1 || fail 'Docker engine is not reachable'
docker buildx version >/dev/null 2>&1 || fail 'Docker Buildx is unavailable'
builder_info=$(docker buildx inspect --bootstrap 2>&1) || fail 'Docker Buildx builder is not available'
platforms=$(printf '%s\n' "$builder_info" | sed -n 's/^[[:space:]]*Platforms:[[:space:]]*//p' | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
printf '%s\n' "$platforms" | grep -Fxq "$TARGET_PLATFORM" || fail "Buildx builder does not advertise verified platform $TARGET_PLATFORM"

command -v yc >/dev/null 2>&1 || fail 'yc command is unavailable'
yc iam create-token >/dev/null 2>&1 || fail 'yc profile is not authenticated'
yc container registry get "$YC_REGISTRY_ID" >/dev/null 2>&1 || fail 'yc cannot read the configured registry'
yc container registry configure-docker >/dev/null 2>&1 || fail 'yc could not configure Docker registry authentication'

run_check() {
  local directory=$1
  shift
  local relative_directory=${directory#"$REPO_ROOT"/}
  printf 'Running checks in %s\n' "$relative_directory"
  (cd "$directory" && "$@") || fail "check failed in $relative_directory"
}

printf 'Running release checks for %s\n' "$release_sha"
run_check "$REPO_ROOT/services/api" bash -c 'test -z "$(gofmt -l .)"'
run_check "$REPO_ROOT/services/api" go vet ./...
run_check "$REPO_ROOT/services/api" go test -race -count=1 ./...
run_check "$REPO_ROOT/services/api" env TEST_DATABASE_URL="$TEST_DATABASE_URL" go test -tags=integration -count=1 ./internal/integration/...
run_check "$REPO_ROOT/services/api" go generate ./...
run_check "$REPO_ROOT" git diff --exit-code -- packages/contracts/openapi services/api/internal/apispec
run_check "$REPO_ROOT/services/economics" env POSTGRES_TEST_DATABASE_URL="$POSTGRES_TEST_DATABASE_URL" PYTHONPATH=src ruff check src tests
run_check "$REPO_ROOT/services/economics" env POSTGRES_TEST_DATABASE_URL="$POSTGRES_TEST_DATABASE_URL" PYTHONPATH=src "$economics_pytest" -q
run_check "$REPO_ROOT/services/simulation" env TEST_DATABASE_URL="$SIMULATION_TEST_DATABASE_URL" "$simulation_pytest"
run_check "$REPO_ROOT/apps/web" npm ci
run_check "$REPO_ROOT/apps/web" npm run lint
run_check "$REPO_ROOT/apps/web" npm run typecheck
run_check "$REPO_ROOT/apps/web" npm test
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)" ]]; then
  fail 'checks modified the checkout; review generated changes before release'
fi

build_and_push() {
  local image=$1 dockerfile=$2 context=$3 target=$4
  shift 4
  local -a build_args=(--build-arg "VERSION=$release_sha")
  local arg
  for arg in "$@"; do
    build_args+=(--build-arg "$arg")
  done
  local image_ref="cr.yandex/${YC_REGISTRY_ID}/brobots-${image}:${release_sha}"
  local -a command=(docker buildx build --platform "$TARGET_PLATFORM" --file "$dockerfile")
  if [[ -n "$target" ]]; then
    command+=(--target "$target")
  fi
  command+=("${build_args[@]}" --tag "$image_ref" --push "$context")
  printf 'Building and pushing %s\n' "$image_ref"
  (cd "$REPO_ROOT" && "${command[@]}")
}

web_demo_mode=${WEB_DEMO_MODE:-false}
build_and_push api services/api/Dockerfile . runtime
build_and_push simulation services/simulation/Dockerfile . runtime
build_and_push economics services/economics/Dockerfile . runtime
build_and_push web apps/web/Dockerfile . runtime \
  "VITE_DEMO_MODE=$web_demo_mode" \
  "VITE_DEMO_USER_EMAIL=${VITE_DEMO_USER_EMAIL:-}" \
  "VITE_DEMO_USER_PASSWORD=${VITE_DEMO_USER_PASSWORD:-}" \
  "VITE_DEMO_ADMIN_EMAIL=${VITE_DEMO_ADMIN_EMAIL:-}" \
  "VITE_DEMO_ADMIN_PASSWORD=${VITE_DEMO_ADMIN_PASSWORD:-}" \
  "VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL:-}"
build_and_push keycloak infra/keycloak/Dockerfile . ''
build_and_push gateway infra/nginx/Dockerfile infra/nginx ''
build_and_push postgres infra/postgres/Dockerfile infra/postgres ''

printf 'Published all seven images for %s to cr.yandex/%s\n' "$release_sha" "$YC_REGISTRY_ID"
