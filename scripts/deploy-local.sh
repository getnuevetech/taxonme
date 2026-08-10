#!/usr/bin/env bash
# TaxOnMe — bare-metal deployment to a local server (no Docker).
# Installs PostgreSQL (if missing), creates the database, builds the app,
# applies migrations, seeds defaults, and installs a systemd service.
#
# Usage:  sudo bash scripts/deploy-local.sh
# Re-run safe: every step is idempotent.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="${SUDO_USER:-$(whoami)}"
DB_NAME="${DB_NAME:-taxonme}"
DB_USER="${DB_USER:-taxonme}"
DB_PASSWORD="${DB_PASSWORD:-}"
APP_PORT="${APP_PORT:-3000}"
SERVICE_NAME="taxonme"

echo "==> TaxOnMe local deployment"
echo "    App dir: $APP_DIR"

# 1. Node.js check
if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 20 ]; then
  echo "ERROR: Node.js 20+ is required. Install it first (e.g. https://nodejs.org or your package manager)." >&2
  exit 1
fi

# 2. PostgreSQL
if ! command -v psql >/dev/null; then
  echo "==> Installing PostgreSQL..."
  apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib
fi
if command -v systemctl >/dev/null && systemctl is-system-running >/dev/null 2>&1; then
  systemctl enable --now postgresql
else
  pg_ctlcluster "$(ls /var/lib/postgresql | sort -V | tail -1)" main start 2>/dev/null || true
fi

# 3. Database + user (generate a password on first run)
if [ -z "$DB_PASSWORD" ]; then
  if [ -f "$APP_DIR/.env" ] && grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
    echo "==> Reusing existing .env database configuration."
  else
    DB_PASSWORD="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
  fi
fi
if [ -n "${DB_PASSWORD:-}" ]; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" >/dev/null
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
EOF
  chown "$APP_USER" "$APP_DIR/.env"
  echo "==> Database '$DB_NAME' ready; credentials written to .env"
fi

# 4. Build + migrate + seed (as the app user)
cd "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci && npx prisma migrate deploy && npx prisma db seed && npm run build"

# 5. systemd service (skipped if systemd is unavailable)
if command -v systemctl >/dev/null && systemctl is-system-running >/dev/null 2>&1; then
  cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=TaxOnMe web application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
ExecStart=$(command -v npm) run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  echo "==> Service '$SERVICE_NAME' running. Logs: journalctl -u $SERVICE_NAME -f"
else
  echo "==> systemd not available. Start manually with:  cd '$APP_DIR' && PORT=$APP_PORT npm run start"
fi

echo ""
echo "==> Done. Open http://localhost:$APP_PORT  (admin backend: /admin)"
echo "    Default admin: admin@mytaxonme.com / ChangeMe!2026 — CHANGE THIS after first login,"
echo "    or re-seed with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD environment variables."
