#!/usr/bin/env sh
# 2D-трассы из настоящего движка services/simulation — в Docker: движку нужен Python 3.12 (см. scripts/gen2dTraces.py).
set -eu
REPO=$(cd ../.. && pwd)
docker run --rm -v "$REPO":/repo -w /repo python:3.12-slim sh -c \
  'pip install -q --root-user-action=ignore --disable-pip-version-check simpy networkx && python apps/web/scripts/gen2dTraces.py'
