#!/usr/bin/env bash
# Records the mobile walkthrough against the running docker compose stack.
# Resets demo data first so the video always starts from the same state.
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${RESET:-1}" == "1" ]]; then
  (cd .. && docker compose down -v && docker compose up -d --build)
  for _ in $(seq 1 60); do
    curl -sf http://localhost:8080/api/health >/dev/null && break
    sleep 2
  done
fi

rm -rf out && mkdir -p out
docker run --rm --network magistral-400_default --ipc=host \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.49.1-noble \
  sh -c "npm install --no-save --no-audit --no-fund playwright@1.49.1 >/dev/null && node record.mjs"

python3 compose.py
