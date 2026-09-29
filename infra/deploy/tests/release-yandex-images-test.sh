#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RELEASE_SCRIPT="$REPO_ROOT/infra/deploy/release-yandex-images.sh"
tmp_root=$(mktemp -d)
trap 'rm -rf "$tmp_root"' EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_fails_with() {
  local expected=$1
  shift
  local output status=0
  output=$("$@" 2>&1) || status=$?
  [[ $status -ne 0 ]] || fail "command unexpectedly succeeded: $*"
  [[ "$output" == *"$expected"* ]] || fail "expected '$expected' in output, got: $output"
}

new_fixture() {
  local name=$1
  FIXTURE="$tmp_root/$name"
  mkdir -p "$FIXTURE/repo/infra/deploy" "$FIXTURE/repo/services/api" \
    "$FIXTURE/repo/services/economics" "$FIXTURE/repo/services/simulation" \
    "$FIXTURE/repo/apps/web" "$FIXTURE/repo/packages/contracts/openapi" \
    "$FIXTURE/repo/services/api/internal/apispec" "$FIXTURE/bin"
  cp "$RELEASE_SCRIPT" "$FIXTURE/repo/infra/deploy/release-yandex-images.sh"
  chmod +x "$FIXTURE/repo/infra/deploy/release-yandex-images.sh"
  git -C "$FIXTURE/repo" init -q
  git -C "$FIXTURE/repo" config user.email release-test@example.invalid
  git -C "$FIXTURE/repo" config user.name release-test
  git -C "$FIXTURE/repo" config commit.gpgsign false
  git -C "$FIXTURE/repo" add .
  git -C "$FIXTURE/repo" commit -qm fixture
  FIXTURE_SHA=$(git -C "$FIXTURE/repo" rev-parse HEAD)
  LOG="$FIXTURE/commands.log"
  : > "$LOG"
  write_stubs
  export PATH="$FIXTURE/bin:$PATH"
  export STUB_LOG="$LOG"
  export YC_REGISTRY_ID=registry123
  export TARGET_PLATFORM=linux/amd64
  export TARGET_PLATFORM_VERIFIED=true
  export TEST_DATABASE_URL=postgres://127.0.0.1/api
  export POSTGRES_TEST_DATABASE_URL=postgresql://127.0.0.1/economics
  export SIMULATION_TEST_DATABASE_URL=postgresql://127.0.0.1/simulation
  unset STUB_FAIL_TEST STUB_FAIL_BUILD STUB_DIRTY_GENERATE WEB_DEMO_MODE || true
}

write_stubs() {
  cat > "$FIXTURE/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$STUB_LOG"
if [[ "$*" == 'buildx inspect --bootstrap' ]]; then
  printf 'Name: test-builder\nPlatforms: linux/amd64, linux/arm64\n'
fi
if [[ "$*" == *'buildx build'* && "${STUB_FAIL_BUILD:-}" == true ]]; then
  exit 53
fi
STUB
  cat > "$FIXTURE/bin/yc" <<'STUB'
#!/usr/bin/env bash
printf 'yc %s\n' "$*" >> "$STUB_LOG"
STUB
  cat > "$FIXTURE/bin/go" <<'STUB'
#!/usr/bin/env bash
printf 'go %s\n' "$*" >> "$STUB_LOG"
if [[ "${STUB_FAIL_TEST:-}" == go && "$*" == 'test '* ]]; then
  exit 41
fi
if [[ "${STUB_DIRTY_GENERATE:-}" == true && "$*" == 'generate ./...' ]]; then
  touch generated-during-checks.go
fi
STUB
  for tool in ruff pytest npm; do
    cat > "$FIXTURE/bin/$tool" <<'STUB'
#!/usr/bin/env bash
printf '%s %s\n' "${0##*/}" "$*" >> "$STUB_LOG"
if [[ "${STUB_FAIL_TEST:-}" == "${0##*/}" ]]; then
  exit 42
fi
STUB
  done
  chmod +x "$FIXTURE/bin/"*
}

run_release() {
  "$FIXTURE/repo/infra/deploy/release-yandex-images.sh" "$FIXTURE_SHA"
}

bash -n "$RELEASE_SCRIPT" || fail 'release script syntax check failed'
bash -n "$0" || fail 'test script syntax check failed'
printf 'PASS: bash -n for release and test scripts\n'

new_fixture missing-config
unset YC_REGISTRY_ID
assert_fails_with 'missing required configuration: YC_REGISTRY_ID' run_release
! rg -q '^docker buildx build' "$LOG" || fail 'missing configuration reached image build'
printf 'PASS: missing configuration fails before build or publication\n'

new_fixture dirty-checkout
touch "$FIXTURE/repo/untracked-file"
assert_fails_with 'checkout must be clean' run_release
! rg -q '^docker buildx build' "$LOG" || fail 'dirty checkout reached image build'
printf 'PASS: dirty checkout fails before build or publication\n'

new_fixture failed-test
export STUB_FAIL_TEST=go
assert_fails_with 'check failed in services/api' run_release
rg -q '^go test -race' "$LOG" || fail 'Go test stub was not invoked'
! rg -q '^docker buildx build' "$LOG" || fail 'failed checks reached image build'
printf 'PASS: failed test stops before image build or publication\n'

new_fixture generated-change
export STUB_DIRTY_GENERATE=true
assert_fails_with 'checks modified the checkout' run_release
! rg -q '^docker buildx build' "$LOG" || fail 'generated change reached image build'
printf 'PASS: generated source changes stop before image build or publication\n'

new_fixture failed-build
export STUB_FAIL_BUILD=true
status=0
run_release > "$FIXTURE/output.log" 2>&1 || status=$?
[[ $status -eq 53 ]] || fail "expected build failure status 53, got $status"
[[ $(rg -c '^docker buildx build' "$LOG") -eq 1 ]] || fail 'build failure did not stop subsequent image builds'
printf 'PASS: failed image build stops the release\n'

new_fixture successful-release
export VITE_DEMO_USER_EMAIL=demo@example.invalid
run_release > "$FIXTURE/output.log" 2>&1 || fail 'stubbed release unexpectedly failed'
[[ $(rg -c '^docker buildx build' "$LOG") -eq 7 ]] || fail 'expected seven image builds'
first_build=$(rg -n '^docker buildx build' "$LOG" | head -n 1 | cut -d: -f1)
last_check=$(rg -n '^(go |ruff |pytest |npm )' "$LOG" | tail -n 1 | cut -d: -f1)
[[ -n "$last_check" && "$last_check" -lt "$first_build" ]] || fail 'image build started before all service checks finished'
[[ $(rg -c "brobots-[a-z]+:${FIXTURE_SHA}" "$LOG") -eq 7 ]] || fail 'all images must use the full current SHA'
rg -q 'VITE_DEMO_MODE=false' "$LOG" || fail 'demo mode did not default to false'
rg -q 'VITE_DEMO_USER_EMAIL=demo@example.invalid' "$LOG" || fail 'web build argument was not preserved'
rg -q 'infra/keycloak/Dockerfile.*--tag cr.yandex/registry123/brobots-keycloak:' "$LOG" || fail 'Keycloak image context or registry tag is incorrect'
rg -q 'infra/nginx/Dockerfile.*infra/nginx' "$LOG" || fail 'gateway Dockerfile context is incorrect'
rg -q 'infra/postgres/Dockerfile.*infra/postgres' "$LOG" || fail 'Postgres Dockerfile context is incorrect'
printf 'PASS: all seven stubbed image builds use the registry and full SHA\n'

printf 'All release command checks passed.\n'
