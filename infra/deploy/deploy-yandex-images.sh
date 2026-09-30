#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"
readonly COMPOSE_SOURCE="$REPO_ROOT/docker-compose.coi.yml"
readonly DEFAULT_SSH_KEY="$REPO_ROOT/.deployment/keys/yc-brobots-ed25519"

usage() {
  cat >&2 <<'USAGE'
Usage: infra/deploy/deploy-yandex-images.sh <full-commit-sha>

Pass the SHA to deploy or a retained prior SHA to roll back.

Required environment:
  YC_INSTANCE_ID  Yandex Compute instance ID
  YC_FOLDER_ID    Yandex Cloud folder ID
  YC_CLOUD_ID     Yandex Cloud cloud ID
  YC_REGISTRY_ID  Yandex Container Registry ID
  PUBLIC_URL      Public HTTPS base URL for the deployment

SSH verification uses YC_SSH_USER (default: yc-user), YC_SSH_KEY (default:
.deployment/keys/yc-brobots-ed25519), and the host from PUBLIC_URL.
USAGE
  exit 2
}

fail() {
  printf 'deploy-yandex-images: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage
deploy_sha=$1
[[ "$deploy_sha" =~ ^[0-9a-f]{40}$ ]] || fail 'argument must be a full 40-character lowercase commit SHA'

for required in YC_INSTANCE_ID YC_FOLDER_ID YC_CLOUD_ID YC_REGISTRY_ID PUBLIC_URL; do
  [[ -n "${!required:-}" ]] || fail "missing required configuration: $required"
done
for identifier in YC_INSTANCE_ID YC_FOLDER_ID YC_CLOUD_ID YC_REGISTRY_ID; do
  [[ "${!identifier}" =~ ^[a-zA-Z0-9-]+$ ]] || fail "$identifier contains unsupported characters"
done
[[ "$PUBLIC_URL" =~ ^https://[A-Za-z0-9.-]+/?$ ]] || \
  fail 'PUBLIC_URL must be an HTTPS URL without a path, query, or fragment'

for tool in docker yc curl ssh jq; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool command is unavailable"
done
compose_command=()
if docker compose version >/dev/null 2>&1; then
  compose_command=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  compose_command=(docker-compose)
else
  fail 'Docker Compose is unavailable'
fi
[[ -f "$COMPOSE_SOURCE" ]] || fail 'docker-compose.coi.yml is missing'

ssh_key=${YC_SSH_KEY:-$DEFAULT_SSH_KEY}
ssh_user=${YC_SSH_USER:-yc-user}
[[ -f "$ssh_key" ]] || fail "SSH key file is missing: $ssh_key"
[[ "$ssh_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail 'YC_SSH_USER contains unsupported characters'
health_attempts=${HEALTH_CHECK_ATTEMPTS:-30}
health_interval=${HEALTH_CHECK_INTERVAL_SECONDS:-10}
[[ "$health_attempts" =~ ^[1-9][0-9]*$ ]] || fail 'HEALTH_CHECK_ATTEMPTS must be a positive integer'
[[ "$health_interval" =~ ^[0-9]+$ ]] || fail 'HEALTH_CHECK_INTERVAL_SECONDS must be a non-negative integer'

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/env"

# Compose validates env_file paths while rendering. Use empty local placeholders,
# then restore the VM paths before writing the file passed to yc.
sed "s|/etc/brobots/|$tmp_dir/env/|g" "$COMPOSE_SOURCE" > "$tmp_dir/compose.yml"
for env_file in postgres keycloak gateway api simulation economics; do
  : > "$tmp_dir/env/$env_file.env"
done

rendered_with_placeholders="$tmp_dir/rendered-with-placeholders.yml"
rendered_compose="$tmp_dir/docker-compose.coi.yml"
YC_REGISTRY_ID="$YC_REGISTRY_ID" IMAGE_TAG="$deploy_sha" \
  "${compose_command[@]}" --file "$tmp_dir/compose.yml" config --no-env-resolution \
    > "$rendered_with_placeholders" || \
  fail 'Docker Compose could not render the COI specification'

# Compose validates the local paths above, but its renderer turns env_file
# strings into mapping objects that the COI daemon rejects. Send the canonical
# source spec with only its image placeholders substituted.
registry_placeholder='\${YC_REGISTRY_ID:?}'
image_tag_placeholder='\${IMAGE_TAG:?}'
sed -e "s|$registry_placeholder|$YC_REGISTRY_ID|g" \
  -e "s|$image_tag_placeholder|$deploy_sha|g" \
  "$COMPOSE_SOURCE" > "$rendered_compose"

expected_prefix="cr.yandex/$YC_REGISTRY_ID/brobots-"
image_count=0
while IFS= read -r image; do
  [[ -n "$image" ]] || continue
  [[ "$image" == "$expected_prefix"*":$deploy_sha" ]] || \
    fail "rendered Compose contains an image outside the requested registry and SHA: $image"
  ((image_count += 1))
done < <(sed -n 's/^[[:space:]]*image:[[:space:]]*//p' "$rendered_compose")
[[ $image_count -eq 9 ]] || fail "expected 9 rendered runtime image references, found $image_count"
! grep -Eq '\$\{(YC_REGISTRY_ID|IMAGE_TAG)' "$rendered_compose" || \
  fail 'rendered Compose contains unresolved deployment variables'
! grep -Eq 'ghcr\.io|/tmp/' "$rendered_compose" || \
  fail 'rendered Compose contains unresolved variables, GHCR references, or temporary paths'
env_file_count=$(grep -Ec '/etc/brobots/[^[:space:]]+\.env([[:space:]]|$)' "$rendered_compose" || true)
[[ "$env_file_count" -eq 8 ]] || \
  fail "rendered Compose preserves $env_file_count of eight VM env_file references"

operation_json="$tmp_dir/operation.json"
yc compute instance update-container "$YC_INSTANCE_ID" \
  --folder-id "$YC_FOLDER_ID" --cloud-id "$YC_CLOUD_ID" \
  --docker-compose-file="$rendered_compose" --async --format json > "$operation_json" || \
  fail 'yc compute instance update-container failed'
operation_id=$(jq -er '.id | select(type == "string" and length > 0)' "$operation_json") || \
  fail 'yc update-container did not return an operation ID'
yc operation wait "$operation_id" >/dev/null || fail "Yandex operation polling failed for $operation_id"

public_host=${PUBLIC_URL#https://}
public_host=${public_host%/}

health_ok=false
for ((attempt = 1; attempt <= health_attempts; attempt++)); do
  if curl --fail --silent --show-error "$PUBLIC_URL/healthz" >/dev/null \
      && curl --fail --silent --show-error "$PUBLIC_URL/" >/dev/null \
      && curl --fail --silent --show-error \
        "$PUBLIC_URL/auth/realms/rav5/.well-known/openid-configuration" >/dev/null; then
    health_ok=true
    break
  fi
  if ((attempt < health_attempts)); then
    sleep "$health_interval"
  fi
done
[[ "$health_ok" == true ]] || fail "public health checks failed after $health_attempts attempt(s)"

remote_images=$(ssh -i "$ssh_key" -o BatchMode=yes -o ConnectTimeout=10 \
  "$ssh_user@$public_host" 'sudo docker ps --format "{{.Image}}"') || \
  fail 'could not verify running images through SSH'
expected_images=7
actual_images=0
while IFS= read -r image; do
  [[ -n "$image" ]] || continue
  [[ "$image" == "$expected_prefix"*":$deploy_sha" ]] || \
    fail "VM has a running image outside the requested registry and SHA: $image"
  ((actual_images += 1))
done <<< "$remote_images"
[[ $actual_images -eq $expected_images ]] || \
  fail "expected $expected_images running application images, found $actual_images"

printf 'Deployment verified for SHA %s (rollback uses this command with the retained prior SHA).\n' "$deploy_sha"
