#!/usr/bin/env bash
# Runs on the VPS in /opt/magistral: loads images built in CI and restarts the stack.
# Expects images.tar.gz next to it; .env with secrets lives only on the server.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "No .env on the server — create it from .env.example first" >&2
  exit 1
fi

echo "Loading images…"
gunzip -c images.tar.gz | docker load
rm -f images.tar.gz

echo "Starting the stack…"
$COMPOSE up -d --no-build --remove-orphans

echo "Waiting for the API…"
for _ in $(seq 1 40); do
  if $COMPOSE exec -T nginx wget -qO- http://127.0.0.1/api/health 2>/dev/null | grep -q '"ok"'; then
    docker image prune -f >/dev/null
    echo "Deployed: API is healthy"
    exit 0
  fi
  sleep 3
done

echo "API did not become healthy, recent backend logs:" >&2
$COMPOSE logs --tail 50 backend >&2
exit 1
