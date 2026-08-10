# Deploying TaxOnMe to a local server

Two supported paths. Both use PostgreSQL and persist uploads under `var/uploads`.

## Option A — Docker Compose (recommended)

Requirements: Docker with the Compose plugin.

```bash
cp .env.deploy.example .env.deploy      # edit: set POSTGRES_PASSWORD and SEED_ADMIN_PASSWORD
docker compose --env-file .env.deploy up -d --build
```

That's it. The app container waits for the database, applies migrations, seeds defaults (idempotent), and starts on port 3000 (change with `APP_PORT` in `.env.deploy`).

- App: `http://<server-ip>:3000` · Admin backend: `/admin`
- Database persists in the `taxonme_pgdata` volume; uploaded documents in `taxonme_uploads`.
- Update to a new version: `git pull && docker compose --env-file .env.deploy up -d --build`
- Logs: `docker compose logs -f app`
- Backup: `docker compose exec db pg_dump -U taxonme taxonme > backup.sql`

## Option B — Bare metal (no Docker)

Requirements: Ubuntu/Debian-like server with Node.js 20+.

```bash
sudo bash scripts/deploy-local.sh
```

The script is idempotent and will:

1. Install PostgreSQL if missing and start it.
2. Create the `taxonme` database and user with a generated password, written to `.env`.
3. `npm ci`, apply Prisma migrations, seed defaults, and build the production bundle.
4. Install and start a `taxonme` systemd service (auto-restart, starts on boot).

Useful commands afterwards:

```bash
journalctl -u taxonme -f          # tail app logs
sudo systemctl restart taxonme    # restart after a git pull + npm run build
sudo -u postgres pg_dump taxonme > backup.sql
```

If the server has no systemd, the script prints the manual start command instead.

## Manual steps (any environment)

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
npm ci
npx prisma migrate deploy   # apply schema migrations
npx prisma db seed          # idempotent defaults (admin, plans, pipelines, content)
npm run build
PORT=3000 npm run start
```

## After first start

1. Sign in at `/admin` with the seeded super admin (`admin@mytaxonme.com` / `ChangeMe!2026`, or the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you provided) and change the password/account.
2. Settings → set **App URL** to the address users will use (needed for OAuth callbacks and payment redirects).
3. AI providers → paste API keys; review AI pipelines.
4. Payment gateways → configure Stripe/PayPal (the seeded "Manual / development" gateway activates subscriptions instantly and is for testing only — disable it in production).
5. Content & agreements → replace placeholder terms/privacy/agreements.

## Notes

- **Session secret**: auto-generated on first run and stored in the settings table; set `AUTH_SECRET` to override.
- **Uploads**: stored on disk (`var/uploads` or the `taxonme_uploads` volume) with access-controlled serving; include them in backups.
- **Reverse proxy / HTTPS**: for LAN-only use, the built-in server is fine. For anything internet-facing put nginx/Caddy in front with TLS and point it at port 3000.
