#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Server-owned .env is missing in $(pwd)" >&2
  exit 1
fi

if [[ "${COMPOSE_FILE}" == *dev* ]]; then
  POSTGRES_SERVICE="postgres-master-dev"
  BACKEND_SERVICE="app-backend-dev"
  FRONTEND_SERVICE="app-frontend-dev"
  REDIS_SERVICE="redis-dev"
  MINIO_SERVICE="minio-dev"
else
  POSTGRES_SERVICE="postgres-master"
  BACKEND_SERVICE="app-backend"
  FRONTEND_SERVICE="app-frontend"
  REDIS_SERVICE="redis"
  MINIO_SERVICE="minio"
fi

compose=(docker compose -f "${COMPOSE_FILE}")

mkdir -p data/postgres data/redis data/minio data/logs
"${compose[@]}" config --quiet
"${compose[@]}" up -d "${POSTGRES_SERVICE}" "${REDIS_SERVICE}" "${MINIO_SERVICE}"

for attempt in $(seq 1 30); do
  if "${compose[@]}" exec -T "${POSTGRES_SERVICE}" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" == "30" ]]; then
    echo "PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 2
done

"${compose[@]}" build "${BACKEND_SERVICE}" "${FRONTEND_SERVICE}"

"${compose[@]}" run --rm "${BACKEND_SERVICE}" \
  npx prisma db push --schema=prisma/master.schema.prisma --skip-generate

mapfile -t tenant_databases < <(
  "${compose[@]}" exec -T "${POSTGRES_SERVICE}" sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select \"dbName\" from \"Tenant\" order by \"dbName\";"'
)

for database_name in "${tenant_databases[@]}"; do
  database_name="${database_name//$'\r'/}"
  [[ -z "${database_name}" ]] && continue
  echo "Applying tenant schema to ${database_name}"
  "${compose[@]}" run --rm -e TENANT_DB_NAME="${database_name}" "${BACKEND_SERVICE}" sh -lc '
    TENANT_DATABASE_URL="$(node -e '\''const u = new URL(process.env.MASTER_DATABASE_URL); u.pathname = "/" + process.env.TENANT_DB_NAME; process.stdout.write(u.toString())'\'')"
    export TENANT_DATABASE_URL
    npx prisma db push --schema=prisma/tenant.schema.prisma --skip-generate
  '
done

"${compose[@]}" up -d --remove-orphans "${BACKEND_SERVICE}" "${FRONTEND_SERVICE}"

for attempt in $(seq 1 30); do
  if "${compose[@]}" exec -T "${FRONTEND_SERVICE}" wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    "${compose[@]}" ps
    echo "Deployment health check passed"
    exit 0
  fi
  if [[ "${attempt}" == "30" ]]; then
    echo "Application health check failed" >&2
    "${compose[@]}" logs --tail=120 "${BACKEND_SERVICE}" "${FRONTEND_SERVICE}" >&2
    exit 1
  fi
  sleep 2
done
