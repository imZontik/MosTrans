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
# Configs are bind-mounted: containers that were not recreated keep the old ones until a reload
$COMPOSE exec -T nginx nginx -s reload
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile

fetch() { $COMPOSE exec -T nginx wget -qO- "http://127.0.0.1$1" 2>/dev/null; }

# Both through nginx: the API alone being up once hid a 502 on the site itself
echo "Waiting for the API and the web app…"
for _ in $(seq 1 40); do
  if fetch /api/health | grep -q '"ok"' && fetch / | grep -q 'id="root"'; then
    docker image prune -f >/dev/null
    echo "Deployed: API and web app are up"
    exit 0
  fi
  sleep 3
done

echo "Stack did not come up, recent logs:" >&2
$COMPOSE logs --tail 30 backend nginx frontend >&2
exit 1
