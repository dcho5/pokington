#!/usr/bin/env bash

set -euo pipefail

# --- CONFIGURATION ---
PROJECT_DIR="$(pwd)"
FRONTEND_PORT=3000
BACKEND_PORT=1999
WEB_PKG_NAME="@pokington/web"
STANDALONE_DIR="$PROJECT_DIR/apps/web/.next/standalone"
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/parties/main/__control__/health"

FRESH=true
LOCAL=false

# --- ARG PARSING ---
for arg in "$@"; do
  case "$arg" in
    --no-build) FRESH=false ;;
    --local)    LOCAL=true ;;
  esac
done

# --- CLEANUP ---
cleanup() {
  echo -e "\n🛑 Shutting down Pokington..."

  for pid in "${CAFFEINE_PID:-}" "${FRONTEND_PID:-}" "${ENGINE_PID:-}" "${BACKEND_TUNNEL_PID:-}" "${FRONTEND_TUNNEL_PID:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done

  lsof -ti:"$FRONTEND_PORT","$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
}
trap cleanup INT TERM ERR

# --- HELPERS ---
wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"

  for ((i=1; i<=attempts; i++)); do
    curl -fsS "$url" >/dev/null && return 0
    sleep 1
  done

  echo "❌ ERROR: $label failed at $url"
  return 1
}

extract_tunnel_url() {
  local logfile="$1"
  local attempts="${2:-20}"

  for ((i=1; i<=attempts; i++)); do
    local url
    url=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$logfile" | head -n1 || true)
    [ -n "$url" ] && echo "$url" && return 0
    sleep 1
  done

  return 1
}

create_encoded_static_aliases() {
  local root="$1"

  find "$root" -depth | while read -r src; do
    [[ "$src" != *"["* && "$src" != *"]"* ]] && continue

    local encoded="${src//\[/%5B}"
    encoded="${encoded//\]/%5D}"

    [ "$src" = "$encoded" ] && continue

    if [ -d "$src" ]; then
      mkdir -p "$encoded"
    elif [ -f "$src" ]; then
      mkdir -p "$(dirname "$encoded")"
      cp "$src" "$encoded"
    fi
  done
}

start_frontend() {
  local partykit_host="${1:-}"

  echo "📡 Launching Frontend..."
  pushd "$STANDALONE_DIR" >/dev/null

  if [ -n "$partykit_host" ]; then
    HOSTNAME=0.0.0.0 PORT="$FRONTEND_PORT" \
    PARTYKIT_HOST="$partykit_host" \
    NEXT_PUBLIC_PARTYKIT_HOST="$partykit_host" \
    node apps/web/server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
  else
    HOSTNAME=0.0.0.0 PORT="$FRONTEND_PORT" \
    node apps/web/server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
  fi

  FRONTEND_PID=$!
  popd >/dev/null
}

# --- BOOT ---
echo "🃏 Pokington Boot Sequence..."

echo "🧹 Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
lsof -ti:"$FRONTEND_PORT","$BACKEND_PORT" | xargs kill -9 2>/dev/null || true

# --- BUILD ---
if $FRESH; then
  echo "🏗️ Building fresh binary..."
  rm -rf apps/web/.next .turbo .turbo/cache

  npx turbo run build --filter="$WEB_PKG_NAME"

  echo "📂 Injecting static assets..."
  cp -r apps/web/public "$STANDALONE_DIR/apps/web/"
  cp -r apps/web/.next/static "$STANDALONE_DIR/apps/web/.next/"

  echo "🪞 Creating encoded aliases..."
  create_encoded_static_aliases "$STANDALONE_DIR/apps/web/.next/static"
fi

# --- VERIFY ---
ENTRY="$STANDALONE_DIR/apps/web/server.js"
if [ ! -f "$ENTRY" ]; then
  echo "❌ Missing standalone server at $ENTRY"
  exit 1
fi

# --- CAFFEINE ---
caffeinate -d &
CAFFEINE_PID=$!

# --- ENGINE ---
echo "📡 Launching Engine..."
pnpm -C "$PROJECT_DIR/apps/web" exec partykit dev \
  --config partykit.json \
  --port "$BACKEND_PORT" > engine.log 2>&1 &
ENGINE_PID=$!

echo "⏳ Verifying backend..."
if ! wait_for_url "$BACKEND_HEALTH_URL" "Realtime backend"; then
  tail -n 20 engine.log
  exit 1
fi

# --- LOCAL MODE ---
if $LOCAL; then
  start_frontend

  echo "⏳ Verifying frontend..."
  if ! wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" "Frontend"; then
    tail -n 20 frontend.log
    exit 1
  fi

  echo "🏠 LOCAL: http://localhost:${FRONTEND_PORT}"
  wait
  exit 0
fi

# --- CLOUDFLARE MODE ---
echo "🌐 Starting backend tunnel..."
rm -f backend_tunnel.log frontend_tunnel.log

cloudflared tunnel --url "http://localhost:${BACKEND_PORT}" > backend_tunnel.log 2>&1 &
BACKEND_TUNNEL_PID=$!

BACKEND_URL="$(extract_tunnel_url backend_tunnel.log || true)"
if [ -z "$BACKEND_URL" ]; then
  echo "❌ Backend tunnel failed"
  tail -n 20 backend_tunnel.log
  exit 1
fi

BACKEND_HOST="${BACKEND_URL#https://}"
BACKEND_HOST="${BACKEND_HOST#http://}"

start_frontend "$BACKEND_HOST"

echo "⏳ Verifying frontend..."
if ! wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" "Frontend"; then
  tail -n 20 frontend.log
  exit 1
fi

echo "🌐 Starting frontend tunnel..."
cloudflared tunnel --url "http://localhost:${FRONTEND_PORT}" > frontend_tunnel.log 2>&1 &
FRONTEND_TUNNEL_PID=$!

FRONTEND_URL="$(extract_tunnel_url frontend_tunnel.log || true)"
if [ -z "$FRONTEND_URL" ]; then
  echo "❌ Frontend tunnel failed"
  tail -n 20 frontend_tunnel.log
  exit 1
fi

echo "------------------------------------------------"
echo "🚀 POKINGTON IS LIVE: $FRONTEND_URL"
echo "🎯 Backend: $BACKEND_URL"
echo "------------------------------------------------"

wait
