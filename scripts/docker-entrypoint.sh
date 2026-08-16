#!/bin/sh
set -e

if [ -z "$AUTH_SECRET" ]; then
  echo "AUTH_SECRET is required in production. Set it in .env.deploy or the container environment."
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET is required for the protected maintenance endpoint. Set it in .env.deploy or the container environment."
  exit 1
fi

# Build DATABASE_URL from parts unless one was provided explicitly.
# Credentials are URL-encoded so passwords may contain any characters.
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="$(node -e '
    const e = encodeURIComponent;
    const user = process.env.POSTGRES_USER || "taxonme";
    const pass = process.env.POSTGRES_PASSWORD || "";
    const host = process.env.DB_HOST || "db";
    const port = process.env.DB_PORT || "5432";
    const dbname = process.env.POSTGRES_DB || "taxonme";
    console.log(`postgresql://${e(user)}:${e(pass)}@${host}:${port}/${e(dbname)}?schema=public`);
  ')"
  export DATABASE_URL
fi

echo "Waiting for the database..."
i=0
until npx prisma migrate deploy > /tmp/migrate.log 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not reachable after 30 attempts:"
    cat /tmp/migrate.log
    exit 1
  fi
  sleep 2
done
cat /tmp/migrate.log

echo "Seeding defaults (idempotent)..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts

echo "Starting TaxOnMe..."
exec npm run start
