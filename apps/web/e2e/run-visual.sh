#!/usr/bin/env sh
# Визуальные тесты в Docker-образе Playwright: шрифты и рендер одинаковы на любой машине.
# Аргументы передаются в `playwright test` (например, --update-snapshots, --grep "К-3").
set -eu

# Версия образа = версия @playwright/test в package.json (закреплена без ^).
PW_VERSION=$(node -p "require('./package.json').devDependencies['@playwright/test']")
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

# node_modules хоста (macOS) в Linux не работают: у контейнера свой том, npm ci — только при смене lock-файла.
docker run --rm --ipc=host \
  -v "$(pwd)":/work \
  -v rav5-web-visual-node-modules:/work/node_modules \
  -w /work \
  -e PW_VISUAL_DOCKER=1 \
  -e CI=1 \
  "$IMAGE" \
  sh -c 'LOCK=$(sha1sum package-lock.json | cut -d" " -f1);
    if [ "$(cat node_modules/.lock-sha1 2>/dev/null)" != "$LOCK" ]; then
      npm ci --no-audit --no-fund && echo "$LOCK" > node_modules/.lock-sha1;
    fi;
    npx playwright test --project=visual "$@"' -- "$@"
