# TaxOnMe production image.
# Build:  docker compose build   (or: docker build -t taxonme .)
# The entrypoint applies database migrations, seeds defaults (idempotent), then starts the server.

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# A placeholder is enough at build time; the real DATABASE_URL is injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-auth-secret-placeholder"
ENV CRON_SECRET="build-time-cron-secret-placeholder"
ENV NEXT_TELEMETRY_DISABLED=1
# Keep the webpack build single-threaded so peak RSS stays lower on small VPS hosts.
ENV NEXT_PRIVATE_BUILD_WORKER=1
ENV UV_THREADPOOL_SIZE=2
# Skip Next's post-compile `tsc` in Docker — it peaks another ~1GB and OOM-kills
# 2GB VPS builds after "Compiled successfully" / "Running TypeScript ...".
# Typecheck stays in CI (`npm run typecheck`).
ENV DOCKER_BUILD=1
# Cap the heap below a typical 2GB VPS free RAM so Node fails soft instead of
# letting the host OOM-killer SIGKILL the build mid-pass.
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl libc6-compat

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts /app/tsconfig.json ./
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh && mkdir -p /app/var/uploads

EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
