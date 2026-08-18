#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

write_local_env() {
  if [ ! -f .env ]; then
    cat > .env <<'EOF'
# Local Cloud Agent defaults only. Do not use these values in production.
POSTGRES_USER=taxonme
POSTGRES_PASSWORD=taxonme_dev_password
POSTGRES_DB=taxonme
DATABASE_URL=postgresql://taxonme:taxonme_dev_password@localhost:5432/taxonme?schema=public
AUTH_SECRET=local-cloud-agent-auth-secret-change-in-production
CRON_SECRET=local-cloud-agent-cron-secret-change-in-production
SEED_ADMIN_EMAIL=admin@mytaxonme.com
SEED_ADMIN_PASSWORD=ChangeMe123!
ALLOW_MANUAL_BILLING=true
EOF
  fi
}

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" != *"localhost:5432"* ]]; then
  echo "Using externally configured DATABASE_URL."
elif command -v pg_ctlcluster >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
  write_local_env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  sudo service postgresql start
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER:-taxonme}'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE ${POSTGRES_USER:-taxonme} LOGIN PASSWORD '${POSTGRES_PASSWORD:-taxonme_dev_password}'"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB:-taxonme}'" | grep -q 1 \
    || sudo -u postgres createdb -O "${POSTGRES_USER:-taxonme}" "${POSTGRES_DB:-taxonme}"
  pg_isready -h localhost -U "${POSTGRES_USER:-taxonme}" -d "${POSTGRES_DB:-taxonme}"
elif command -v docker >/dev/null 2>&1; then
  write_local_env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  POSTGRES_USER="${POSTGRES_USER:-taxonme}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-taxonme_dev_password}" \
  POSTGRES_DB="${POSTGRES_DB:-taxonme}" \
  docker compose up -d db
  for _ in $(seq 1 60); do
    if POSTGRES_USER="$POSTGRES_USER" POSTGRES_DB="$POSTGRES_DB" docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  POSTGRES_USER="$POSTGRES_USER" POSTGRES_DB="$POSTGRES_DB" docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
else
  echo "No DATABASE_URL, local PostgreSQL, or Docker runtime is available. Configure DATABASE_URL or let the Cloud Agent install step install PostgreSQL." >&2
  exit 1
fi

npm run db:migrate
npm run db:seed
npm test
npm run ai:v3:rollout-check

echo "TaxOnMe AI v3 local rollout environment is ready."
