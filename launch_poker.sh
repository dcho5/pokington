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
BACKEND_HEALTH_URL="http://127.0.0.1:$BACKEND_PORT/parties/main/__control__/health"

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

wait_for_url() {
    local url="$1"
    local label="$2"
    local attempts="${3:-20}"

    for ((i=1; i<=attempts; i+=1)); do
        if curl -fsS "$url" > /dev/null; then
            return 0
        fi
        sleep 1
    done

    echo "❌ ERROR: $label failed to respond at $url"
    return 1
}

extract_tunnel_url() {
    local logfile="$1"
    local attempts="${2:-20}"
    local url=""

    for ((i=1; i<=attempts; i+=1)); do
        url=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$logfile" | head -n 1 || true)
        if [ -n "$url" ]; then
            printf '%s\n' "$url"
            return 0
        fi
        sleep 1
    done

    return 1
}

create_encoded_static_aliases() {
    local static_root="$1"

    find "$static_root" -depth | while IFS= read -r source_path; do
        case "$source_path" in
            *'['*|*']'*) ;;
            *) continue ;;
        esac

        local encoded_path="${source_path//\[/%5B}"
        encoded_path="${encoded_path//\]/%5D}"

        if [ "$source_path" = "$encoded_path" ]; then
            continue
        fi

        if [ -d "$source_path" ]; then
            mkdir -p "$encoded_path"
        elif [ -f "$source_path" ]; then
            mkdir -p "$(dirname "$encoded_path")"
            cp "$source_path" "$encoded_path"
        fi
    done
}

start_frontend() {
    local partykit_host="$1"

    echo "📡 Launching Frontend..."
    cd "$STANDALONE_DIR"
    if [ -n "$partykit_host" ]; then
        HOSTNAME=0.0.0.0 PORT=$FRONTEND_PORT PARTYKIT_HOST="$partykit_host" NEXT_PUBLIC_PARTYKIT_HOST="$partykit_host" node apps/web/server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
    else
        HOSTNAME=0.0.0.0 PORT=$FRONTEND_PORT node apps/web/server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
    fi
    FRONTEND_PID=$!
    cd "$PROJECT_DIR"
}

echo "🃏 Pokington Boot Sequence..."

# 1. Cleanup old state
echo "🧹 Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
lsof -ti:$FRONTEND_PORT,$BACKEND_PORT | xargs kill -9 2>/dev/null || true

# 2. Build (Now the default behavior)
if [ "$FRESH" = true ]; then
    echo "🏗️  Building fresh binary (use --no-build to skip)..."
    rm -rf apps/web/.next .turbo
    rm -rf .turbo/cache
    npx turbo run build --filter="$WEB_PKG_NAME"
    
    echo "📂 Injecting static assets into standalone..."
    cp -r apps/web/public "$STANDALONE_DIR/apps/web/"
    cp -r apps/web/.next/static "$STANDALONE_DIR/apps/web/.next/"
    echo "🪞 Creating encoded chunk aliases for dynamic app routes..."
    create_encoded_static_aliases "$STANDALONE_DIR/apps/web/.next/static"
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
echo "📡 Launching Engine..."
pnpm -C "$PROJECT_DIR/apps/web" exec partykit dev --config partykit.json --port $BACKEND_PORT > engine.log 2>&1 &
ENGINE_PID=$!

# 6. Health Check
echo "⏳ Verifying realtime backend..."
if ! wait_for_url "$BACKEND_HEALTH_URL" "Realtime backend" 20; then
    echo "❌ ERROR: Engine failed to respond. Last 20 lines of engine.log:"
    tail -n 20 engine.log
    exit 1
fi

# 7. Tunnels
if [ "$LOCAL" = true ]; then
    start_frontend ""
    echo "⏳ Verifying frontend..."
    if ! wait_for_url "http://127.0.0.1:$FRONTEND_PORT" "Frontend" 20; then
        echo "❌ ERROR: Frontend failed to respond. Last 20 lines of frontend.log:"
        tail -n 20 frontend.log
        exit 1
    fi
    echo "🏠 LOCAL MODE: http://localhost:$FRONTEND_PORT"
else
    echo "🌐 CLOUDFLARE MODE: Starting backend tunnel..."
    rm -f backend_tunnel.log frontend_tunnel.log
    
    cloudflared tunnel --url http://localhost:$BACKEND_PORT > backend_tunnel.log 2>&1 &
    BACKEND_TUNNEL_PID=$!

    BACKEND_URL=$(extract_tunnel_url backend_tunnel.log 20 || true)
    if [ -z "$BACKEND_URL" ]; then
        echo "❌ Backend tunnel failed to generate URL."
        tail -n 20 backend_tunnel.log
        exit 1
    fi
    BACKEND_HOST=${BACKEND_URL#https://}
    BACKEND_HOST=${BACKEND_HOST#http://}

    start_frontend "$BACKEND_HOST"
    echo "⏳ Verifying frontend..."
    if ! wait_for_url "http://127.0.0.1:$FRONTEND_PORT" "Frontend" 20; then
        echo "❌ ERROR: Frontend failed to respond. Last 20 lines of frontend.log:"
        tail -n 20 frontend.log
        exit 1
    fi

    echo "🌐 CLOUDFLARE MODE: Starting frontend tunnel..."
    cloudflared tunnel --url http://localhost:$FRONTEND_PORT > frontend_tunnel.log 2>&1 &
    FRONTEND_TUNNEL_PID=$!

    URL=$(extract_tunnel_url frontend_tunnel.log 20 || true)
    
    if [ -z "$URL" ]; then 
        echo "❌ Frontend tunnel failed to generate URL."
        tail -n 20 frontend_tunnel.log
        exit 1
    fi
    echo "------------------------------------------------"
    echo "🚀 POKINGTON IS LIVE: $URL"
    echo "🎯 Realtime backend: $BACKEND_URL"
    echo "------------------------------------------------"
fi

wait
