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

## Moving to a dedicated server (and migrating your data)

Setting up a second computer as the server:

```bash
# On the NEW server (Ubuntu recommended):
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
git clone https://github.com/getnuevetech/taxonme.git && cd taxonme
cp .env.deploy.example .env.deploy   # set POSTGRES_PASSWORD + SEED_ADMIN_PASSWORD
docker compose --env-file .env.deploy up -d --build
```

Migrating existing data from the old machine:

```bash
# On the OLD machine — export database and uploaded files:
docker compose --env-file .env.deploy exec db pg_dump -U taxonme -c taxonme > taxonme.sql
docker run --rm -v taxonme_taxonme_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .

# Copy taxonme.sql and uploads.tgz to the new server (scp/AirDrop/USB), then on the NEW server:
docker compose --env-file .env.deploy exec -T db psql -U taxonme taxonme < taxonme.sql
docker run --rm -v taxonme_taxonme_uploads:/data -v "$PWD":/backup alpine tar xzf /backup/uploads.tgz -C /data
docker compose --env-file .env.deploy restart app
```

Then on the new server's admin → Settings, set **App URL** to the address users will use
(e.g. `http://192.168.1.50:3000` for LAN, or your HTTPS domain), and point a daily cron at the
maintenance endpoint: `crontab -e` → `0 6 * * * curl -s http://localhost:3000/api/health > /dev/null`.

For internet-facing servers, put Caddy in front for automatic HTTPS:

```bash
sudo apt install -y caddy
# /etc/caddy/Caddyfile:
#   yourdomain.com {
#     reverse_proxy localhost:3000
#   }
sudo systemctl reload caddy
```

## Notes

- **Session secret**: auto-generated on first run and stored in the settings table; set `AUTH_SECRET` to override.
- **Uploads**: stored on disk (`var/uploads` or the `taxonme_uploads` volume) with access-controlled serving; include them in backups.
  - **Single-instance only**: the disk-based upload store is not shared between replicas. If you run more than one app instance (e.g. horizontal scaling in Kubernetes), you must back the volume with network storage (NFS, EFS, GCS Filestore, Azure Files, etc.) or migrate to an object-storage provider (S3, R2, GCS). All instances must resolve the same `var/uploads` path.
- **Rate limiting**: the authentication endpoints (login, registration, password reset) have no built-in brute-force protection. For internet-facing deployments, add rate limiting at your reverse-proxy layer (e.g. Caddy's `rate_limit` directive, nginx's `limit_req_zone`, Cloudflare's WAF) before routing traffic to port 3000.
- **Reverse proxy / HTTPS**: for LAN-only use, the built-in server is fine. For anything internet-facing put nginx/Caddy in front with TLS and point it at port 3000.
