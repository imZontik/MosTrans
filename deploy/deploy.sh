#!/usr/bin/env bash
# Runs on the VPS in /opt/magistral: gets the images built in CI and restarts the stack.
#   deploy.sh pull <registry prefix> <tag>  — pull from the registry (only changed layers travel)
#   deploy.sh load                          — load images/*.tar.gz uploaded by CI (fallback)
# Either way the images end up as magistral-400-<service>:latest, the names docker-compose.yml uses,
# so a manual `docker compose up` on the server keeps working. .env with secrets lives only here.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
SERVICES="backend ml-service frontend"

if [ ! -f .env ]; then
  echo "No .env on the server — create it from .env.example first" >&2
  exit 1
fi

case "${1:-load}" in
  pull)
    prefix="$2"
    tag="$3"
    for svc in $SERVICES; do
      echo "Pulling $svc…"
      start=$SECONDS
      docker pull -q "$prefix-$svc:$tag"
      docker tag "$prefix-$svc:$tag" "magistral-400-$svc:latest"
      # Only the local name stays: old versions become dangling and `image prune` below clears them
      docker rmi "$prefix-$svc:$tag" >/dev/null
      echo "  $svc: $((SECONDS - start)) s"
    done
    ;;
  load)
    echo "Loading images…"
    for archive in images/*.tar.gz; do
      gunzip -c "$archive" | docker load
      rm -f "$archive"
    done
    ;;
  *)
    echo "Usage: deploy.sh pull <prefix> <tag> | deploy.sh load" >&2
    exit 2
    ;;
esac

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
    # The VPS is small: every deploy log shows how much memory is left
    free -m
    docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'
    exit 0
  fi
  sleep 3
done

echo "Stack did not come up, recent logs:" >&2
$COMPOSE logs --tail 30 backend nginx frontend >&2
exit 1
