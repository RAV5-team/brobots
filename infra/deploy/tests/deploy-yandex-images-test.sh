#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly DEPLOY_SCRIPT="$REPO_ROOT/infra/deploy/deploy-yandex-images.sh"
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
  export FIXTURE
  mkdir -p "$FIXTURE/repo/infra/deploy" "$FIXTURE/repo/.deployment/keys" "$FIXTURE/bin"
  cp "$DEPLOY_SCRIPT" "$FIXTURE/repo/infra/deploy/deploy-yandex-images.sh"
  cp "$REPO_ROOT/docker-compose.coi.yml" "$FIXTURE/repo/docker-compose.coi.yml"
  chmod +x "$FIXTURE/repo/infra/deploy/deploy-yandex-images.sh"
  : > "$FIXTURE/repo/.deployment/keys/yc-brobots-ed25519"
  git -C "$FIXTURE/repo" init -q
  LOG="$FIXTURE/commands.log"
  : > "$LOG"
  write_stubs
  export PATH="$FIXTURE/bin:$PATH"
  export STUB_LOG="$LOG"
  export YC_INSTANCE_ID=instance123
  export YC_FOLDER_ID=folder123
  export YC_CLOUD_ID=cloud123
  export YC_REGISTRY_ID=registry123
  export PUBLIC_URL=https://example.invalid
  export HEALTH_CHECK_ATTEMPTS=1
  export HEALTH_CHECK_INTERVAL_SECONDS=0
  unset STUB_FAIL_UPDATE STUB_FAIL_POLL STUB_FAIL_HEALTH STUB_FAIL_SSH \
    STUB_BAD_OPERATION STUB_WRONG_VM_IMAGE STUB_NO_PLUGIN YC_SSH_KEY YC_SSH_USER || true
}

write_stubs() {
  cat > "$FIXTURE/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$STUB_LOG"
if [[ "$*" == 'compose version' ]]; then
  [[ "${STUB_NO_PLUGIN:-}" != true ]] || exit 1
  exit 0
fi
[[ "$1" == compose && "$2" == --file && "$4" == config && "$5" == --no-env-resolution ]] || exit 90
compose_file=$3
grep -q '/env/' "$compose_file" || exit 91
while IFS= read -r env_path; do
  [[ -f "$env_path" ]] || exit 92
done < <(sed -n 's/^[[:space:]]*env_file: //p' "$compose_file")
awk '{ if ($1 == "env_file:") { print "    env_file:"; print "      - path: " $2 } else { print } }' "$compose_file" \
  | sed -e "s|\${YC_REGISTRY_ID:?}|$YC_REGISTRY_ID|g" \
    -e "s|\${IMAGE_TAG:?}|$IMAGE_TAG|g"
STUB
  cat > "$FIXTURE/bin/docker-compose" <<'STUB'
#!/usr/bin/env bash
printf 'docker-compose %s\n' "$*" >> "$STUB_LOG"
[[ "$*" == version ]] && exit 0
[[ "$1" == --file && "$3" == config && "$4" == --no-env-resolution ]] || exit 90
compose_file=$2
grep -q '/env/' "$compose_file" || exit 91
while IFS= read -r env_path; do
  [[ -f "$env_path" ]] || exit 92
done < <(sed -n 's/^[[:space:]]*env_file: //p' "$compose_file")
awk '{ if ($1 == "env_file:") { print "    env_file:"; print "      - path: " $2 } else { print } }' "$compose_file" \
  | sed -e "s|\${YC_REGISTRY_ID:?}|$YC_REGISTRY_ID|g" \
    -e "s|\${IMAGE_TAG:?}|$IMAGE_TAG|g"
STUB
  cat > "$FIXTURE/bin/yc" <<'STUB'
#!/usr/bin/env bash
printf 'yc %s\n' "$*" >> "$STUB_LOG"
if [[ "$1 $2 $3" == 'compute instance update-container' ]]; then
  compose_file=
  for arg in "$@"; do
    case "$arg" in
      --docker-compose-file=*) compose_file=${arg#*=} ;;
    esac
  done
  [[ -n "$compose_file" ]] || exit 98
  grep -Eq '^[[:space:]]+image: cr.yandex/registry123/brobots-' "$compose_file" || exit 93
  [[ $(grep -Ec '/etc/brobots/[^[:space:]]+\.env([[:space:]]|$)' "$compose_file") -eq 8 ]] || exit 94
  ! grep -Eq '/(tmp|var/folders)/.*/env/[^[:space:]]+\.env' "$compose_file" || exit 95
  [[ "${STUB_FAIL_UPDATE:-}" != true ]] || exit 53
  if [[ "${STUB_BAD_OPERATION:-}" == true ]]; then
    printf '{"name":"missing-id"}\n'
  else
    printf '{"id":"operation-123"}\n'
  fi
  exit 0
fi
if [[ "$1 $2" == 'operation wait' ]]; then
  [[ "$3" == operation-123 ]] || exit 96
  [[ "${STUB_FAIL_POLL:-}" != true ]] || exit 54
  exit 0
fi
exit 97
STUB
cat > "$FIXTURE/bin/jq" <<'STUB'
#!/usr/bin/env bash
operation_file=${*: -1}
grep -q '"id":"operation-123"' "$operation_file" || exit 1
printf 'operation-123\n'
STUB
  cat > "$FIXTURE/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$STUB_LOG"
[[ "${STUB_FAIL_HEALTH:-}" != true ]] || exit 22
exit 0
STUB
  cat > "$FIXTURE/bin/ssh" <<'STUB'
#!/usr/bin/env bash
printf 'ssh %s\n' "$*" >> "$STUB_LOG"
[[ "${STUB_FAIL_SSH:-}" != true ]] || exit 255
for image in api economics gateway keycloak postgres simulation web; do
  sha=${STUB_SHA:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}
  [[ "${STUB_WRONG_VM_IMAGE:-}" != true || "$image" != web ]] || sha=cccccccccccccccccccccccccccccccccccccccc
  printf 'cr.yandex/registry123/brobots-%s:%s\n' "$image" "$sha"
done
STUB
  chmod +x "$FIXTURE/bin/"*
}

run_deploy() {
  STUB_SHA="$DEPLOY_SHA" "$FIXTURE/repo/infra/deploy/deploy-yandex-images.sh" "$DEPLOY_SHA"
}

DEPLOY_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
bash -n "$DEPLOY_SCRIPT" || fail 'deploy script syntax check failed'
bash -n "$0" || fail 'test script syntax check failed'
printf 'PASS: bash -n for deploy and test scripts\n'

new_fixture invalid-sha
assert_fails_with 'full 40-character lowercase commit SHA' \
  "$FIXTURE/repo/infra/deploy/deploy-yandex-images.sh" abc123
printf 'PASS: invalid SHA is rejected\n'

new_fixture missing-config
unset YC_CLOUD_ID
assert_fails_with 'missing required configuration: YC_CLOUD_ID' run_deploy
printf 'PASS: missing Yandex configuration is rejected\n'

new_fixture invalid-url
export PUBLIC_URL=http://example.invalid
assert_fails_with 'PUBLIC_URL must be an HTTPS URL' run_deploy
printf 'PASS: invalid public URL is rejected\n'

new_fixture compose-validation
export DEPLOY_SHA
run_deploy > "$FIXTURE/output.log" 2>&1 || {
  cat "$FIXTURE/output.log" >&2
  cat "$LOG" >&2
  fail 'stubbed deploy unexpectedly failed'
}
grep -Eq '^docker compose --file .*compose.yml config --no-env-resolution$' "$LOG" || \
  grep -Eq '^docker-compose --file .*compose.yml config --no-env-resolution$' "$LOG" || fail 'Compose render was not invoked'
rg -q 'YC_REGISTRY_ID=registry123 IMAGE_TAG=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$LOG" && \
  fail 'render values unexpectedly appeared in the command log'
rg -q 'operation wait operation-123' "$LOG" || fail 'operation wait was not invoked'
[[ $(rg -c '^curl .*https://example.invalid' "$LOG") -eq 3 ]] || fail 'expected three public health checks'
rg -q 'yc compute instance update-container instance123 --folder-id folder123 --cloud-id cloud123 .*--async --format json' "$LOG" || \
  fail 'update-container did not receive required instance settings or async polling mode'
rg -q 'yc operation wait operation-123' "$LOG" || fail 'operation poll command was not logged'
printf 'PASS: rendering, no temporary env paths sent to YC, async polling, health checks, and SSH SHA verification\n'

new_fixture standalone-compose
export DEPLOY_SHA
export STUB_NO_PLUGIN=true
run_deploy > "$FIXTURE/output.log" 2>&1 || {
  cat "$FIXTURE/output.log" >&2
  fail 'standalone docker-compose fallback unexpectedly failed'
}
grep -Eq '^docker-compose --file .*compose.yml config --no-env-resolution$' "$LOG" || \
  fail 'standalone docker-compose fallback was not used'
printf 'PASS: standalone docker-compose fallback works\n'

new_fixture failed-update
export DEPLOY_SHA
export STUB_FAIL_UPDATE=true
assert_fails_with 'yc compute instance update-container failed' run_deploy
! rg -q '^yc operation wait' "$LOG" || fail 'failed update continued to operation polling'
printf 'PASS: update-container failure stops deployment\n'

new_fixture missing-operation-id
export DEPLOY_SHA
export STUB_BAD_OPERATION=true
assert_fails_with 'did not return an operation ID' run_deploy
printf 'PASS: missing operation ID fails deployment\n'

new_fixture failed-poll
export DEPLOY_SHA
export STUB_FAIL_POLL=true
assert_fails_with 'Yandex operation polling failed' run_deploy
! rg -q '^curl ' "$LOG" || fail 'failed operation polling reached health checks'
printf 'PASS: operation-poll failure stops deployment\n'

new_fixture failed-health
export DEPLOY_SHA
export STUB_FAIL_HEALTH=true
assert_fails_with 'public health checks failed' run_deploy
! rg -q '^ssh ' "$LOG" || fail 'failed health checks reached SSH verification'
printf 'PASS: public health-check failure stops deployment\n'

new_fixture failed-ssh
export DEPLOY_SHA
export STUB_FAIL_SSH=true
assert_fails_with 'could not verify running images through SSH' run_deploy
printf 'PASS: SSH verification failure is reported\n'

new_fixture mismatched-vm-image
export DEPLOY_SHA
export STUB_WRONG_VM_IMAGE=true
assert_fails_with 'outside the requested registry and SHA' run_deploy
printf 'PASS: VM image SHA mismatch is rejected\n'

new_fixture retained-prior-sha
export DEPLOY_SHA=dddddddddddddddddddddddddddddddddddddddd
export STUB_SHA="$DEPLOY_SHA"
run_deploy > "$FIXTURE/output.log" 2>&1 || fail 'retained prior SHA was rejected'
rg -q "Deployment verified for SHA $DEPLOY_SHA" "$FIXTURE/output.log" || fail 'rollback SHA was not verified'
rg -q "IMAGE_TAG=$DEPLOY_SHA" "$LOG" && fail 'SHA should not be passed as a docker command argument'
printf 'PASS: a retained prior full SHA is accepted for rollback\n'

printf 'All deploy command checks passed.\n'
