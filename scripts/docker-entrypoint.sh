#!/bin/sh
set -e

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
