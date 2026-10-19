#!/usr/bin/env bash
# Запуск live-server на порту 8033.
# Монорепозиторий: статика лежит в client/ (KI-052), а не в корне.
set -euo pipefail

cd "$(dirname "$0")/../../client"
npx live-server --port=8033
