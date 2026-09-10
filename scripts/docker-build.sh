#!/usr/bin/env bash
# Memory-safe Docker image build for small VPS hosts (≤2GB).
# Usage (from repo root):
#   bash scripts/docker-build.sh
#   bash scripts/docker-build.sh --up     # build then docker compose up -d
#
# Typical failure without this: SIGKILL during "Collecting page data" because
# the host OOM-killer reaps Node (not an app code error).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.deploy}"
SWAPFILE="${SWAPFILE:-/swapfile}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
DO_UP=0
for arg in "$@"; do
  case "$arg" in
    --up) DO_UP=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.deploy.example and set passwords." >&2
  exit 1
fi

echo "==> Host memory"
free -h || true

# Stop the running stack so Postgres / the old app are not competing for RAM.
if docker compose --env-file "$ENV_FILE" ps -q 2>/dev/null | grep -q .; then
  echo "==> Stopping compose stack to free RAM"
  docker compose --env-file "$ENV_FILE" stop || true
fi

ensure_swap() {
  if swapon --show 2>/dev/null | grep -q .; then
    echo "==> Swap already active"
    swapon --show
    return 0
  fi
  if [[ "$(id -u)" -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    echo "==> No swap and cannot sudo non-interactively."
    echo "    On a ≤2GB VPS, create swap first, then re-run:"
    echo "      sudo fallocate -l $SWAP_SIZE $SWAPFILE && sudo chmod 600 $SWAPFILE"
    echo "      sudo mkswap $SWAPFILE && sudo swapon $SWAPFILE"
    return 1
  fi
  echo "==> Enabling temporary $SWAP_SIZE swap at $SWAPFILE"
  sudo fallocate -l "$SWAP_SIZE" "$SWAPFILE" || sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048
  sudo chmod 600 "$SWAPFILE"
  sudo mkswap "$SWAPFILE"
  sudo swapon "$SWAPFILE"
  swapon --show
}

if ! ensure_swap; then
  echo "==> Continuing without swap (build may SIGKILL on small hosts)" >&2
fi

echo "==> Building app image (no-cache recommended after OOM)"
docker compose --env-file "$ENV_FILE" build --no-cache app

if [[ "$DO_UP" -eq 1 ]]; then
  echo "==> Starting stack"
  docker compose --env-file "$ENV_FILE" up -d
  docker compose --env-file "$ENV_FILE" ps
fi

echo "==> Done"
