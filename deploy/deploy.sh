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
MONITORING="loki alloy grafana pgadmin"

if [ ! -f .env ]; then
  echo "No .env on the server — create it from .env.example first" >&2
  exit 1
fi

env_value() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }

# Grafana and pgAdmin are on the internet: never with a default password. A missing one is generated
# into .env (read it on the server: grep PASSWORD /opt/magistral/.env); the value is never printed here.
ensure_secret() {
  local value
  value=$(env_value "$1")
  if [ -z "$value" ] || [ "$value" = "admin" ]; then
    value=$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')
    sed -i "/^$1=/d" .env
    echo "$1=$value" >> .env
    echo "Generated $1 in .env"
  fi
}

# Grafana, Loki, Alloy and pgAdmin need ~700 MB: only on a server that has the memory, so the site never pays for them
MONITORING_MIN_MB=1500
mem_mb=$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)
if [ "$mem_mb" -ge "$MONITORING_MIN_MB" ]; then
  export COMPOSE_PROFILES=monitoring
  echo "Monitoring on: ${mem_mb} MB of RAM"
  ensure_secret GRAFANA_ADMIN_PASSWORD
  ensure_secret PGADMIN_PASSWORD
else
  echo "Monitoring off: ${mem_mb} MB of RAM, needs ${MONITORING_MIN_MB}"
  $COMPOSE --profile monitoring rm -sf $MONITORING >/dev/null 2>&1 || true
fi

# Third-party images (Postgres, Grafana, …) come through our mirror in ghcr.io: Docker Hub is unreachable
# from the VPS. CI copies them there under the same tags as here: grafana/loki:3.7.8 → grafana-loki-3.7.8
mirror_tag() { echo "$1" | sed 's#^docker.io/##; s#[/:]#-#g'; }
ensure_third_party() {
  local mirror="$1" image
  for image in $($COMPOSE config --images | grep -v '^magistral-400-' | sort -u); do
    docker image inspect "$image" >/dev/null 2>&1 && continue
    echo "Pulling $image through the mirror…"
    docker pull -q "$mirror:$(mirror_tag "$image")"
    docker tag "$mirror:$(mirror_tag "$image")" "$image"
    docker rmi "$mirror:$(mirror_tag "$image")" >/dev/null
  done
}

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
    ensure_third_party "$prefix-mirror"
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
    if [ -n "${COMPOSE_PROFILES:-}" ]; then
      # Grafana takes the env password only on its first start: keep it equal to .env afterwards too
      if $COMPOSE exec -T grafana grafana cli admin reset-admin-password "$(env_value GRAFANA_ADMIN_PASSWORD)" >/dev/null 2>&1; then
        echo "Grafana password matches .env"
      else
        echo "Grafana is still starting: its password will be synced on the next deploy"
      fi
    fi
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
