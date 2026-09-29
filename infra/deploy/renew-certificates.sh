#!/usr/bin/env bash
set -euo pipefail

# Certbot invokes this only after it has renewed a certificate successfully.
if ! /usr/bin/docker inspect --format '{{.State.Running}}' rav5-gateway \
  | /usr/bin/grep -q true; then
  echo "The gateway container is not running" >&2
  exit 1
fi

/usr/bin/docker exec rav5-gateway nginx -s reload
