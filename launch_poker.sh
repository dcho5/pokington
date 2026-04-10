#!/bin/bash

# --- FAIL-SAFE CONFIG ---
set -e
set -o pipefail

# --- CONFIGURATION ---
PROJECT_DIR=$(pwd)
FRONTEND_PORT=3000
BACKEND_PORT=1999
WEB_PKG_NAME="@pokington/web"
STANDALONE_DIR="$PROJECT_DIR/apps/web/.next/standalone"

# Flags - FRESH is now true by default
FRESH=true
LOCAL=false

for arg in "$@"; do
  case $arg in
    --no-build) FRESH=false ;;
    --local)    LOCAL=true ;;
  esac
done

cleanup() {
    echo -e "\n🛑 Shutting down Pokington..."
    kill $CAFFEINE_PID $FRONTEND_PID $ENGINE_PID $BACKEND_TUNNEL_PID $FRONTEND_TUNNEL_PID 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT,$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    exit
}
trap cleanup INT TERM ERR

echo "🃏 Pokington Boot Sequence..."

# 1. Cleanup old state
echo "🧹 Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
lsof -ti:$FRONTEND_PORT,$BACKEND_PORT | xargs kill -9 2>/dev/null || true

# 2. Build (Now the default behavior)
if [ "$FRESH" = true ]; then
    echo "🏗️  Building fresh binary (use --no-build to skip)..."
    rm -rf apps/web/.next .turbo
    npx turbo run build --filter="$WEB_PKG_NAME"
fi

# 3. Verify Standalone Structure
if [ ! -f "$STANDALONE_DIR/apps/web/server.js" ]; then
    echo "❌ ERROR: Cannot find standalone entry point at $STANDALONE_DIR/apps/web/server.js"
    echo "👉 Ensure 'output: standalone' is in your next.config.js"
    exit 1
fi

# 4. System Caffeine
caffeinate -d &
CAFFEINE_PID=$!

# 5. Launch Services
echo "📡 Launching Frontend..."
cd "$STANDALONE_DIR"
# Start node from the standalone root so it finds internal modules
HOSTNAME=0.0.0.0 PORT=$FRONTEND_PORT node apps/web/server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

echo "📡 Launching Engine..."
npx partykit dev src/party/index.ts --port $BACKEND_PORT > engine.log 2>&1 &
ENGINE_PID=$!

# 6. Health Check
echo "⏳ Verifying local health..."
sleep 6
if ! curl -s http://127.0.0.1:$FRONTEND_PORT > /dev/null; then
    echo "❌ ERROR: Frontend failed to respond. Last 10 lines of frontend.log:"
    tail -n 10 frontend.log
    exit 1
fi

# 7. Tunnels
if [ "$LOCAL" = true ]; then
    echo "🏠 LOCAL MODE: http://localhost:$FRONTEND_PORT"
else
    echo "🌐 CLOUDFLARE MODE: Starting Tunnels..."
    rm -f frontend_tunnel.log
    
    cloudflared tunnel --url http://localhost:$BACKEND_PORT > backend_tunnel.log 2>&1 &
    BACKEND_TUNNEL_PID=$!
    
    cloudflared tunnel --url http://localhost:$FRONTEND_PORT > frontend_tunnel.log 2>&1 &
    FRONTEND_TUNNEL_PID=$!

    for i in {1..15}; do
        URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' frontend_tunnel.log | head -n 1 || true)
        if [ -n "$URL" ]; then break; fi
        sleep 1
    done
    
    if [ -z "$URL" ]; then 
        echo "❌ Tunnel failed to generate URL."
        exit 1
    fi
    echo "------------------------------------------------"
    echo "🚀 POKINGTON IS LIVE: $URL"
    echo "------------------------------------------------"
fi

wait
