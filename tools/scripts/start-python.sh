#!/usr/bin/env bash
# Запуск статики клиента на порту 8033.
# Монорепозиторий: статика лежит в client/ (KI-052), а не в корне.
set -euo pipefail

cd "$(dirname "$0")/../../client"
python -m http.server 8033
