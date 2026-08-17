#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to start the local Postgres service." >&2
  exit 1
fi

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

npm run db:migrate
npm run db:seed
npm run ai:v3:rollout-check

echo "TaxOnMe AI v3 local rollout environment is ready."
