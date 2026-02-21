#!/usr/bin/env bash
#
# start.sh — Gemini CLI Adapter サーバーの起動スクリプト
#
# 使い方: ./start.sh [--port 3972]
# OpenClaw起動前にこのスクリプトを実行してアダプタサーバーを立ち上げておく。
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${GEMINI_ADAPTER_PORT:-3972}"
LOG_FILE="${SCRIPT_DIR}/adapter.log"
PID_FILE="${SCRIPT_DIR}/adapter.pid"

# 既に起動中か確認
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[start.sh] Adapter already running (PID $OLD_PID) on port $PORT"
        exit 0
    else
        echo "[start.sh] Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

echo "[start.sh] Starting Gemini CLI adapter on port $PORT ..."
nohup node "$SCRIPT_DIR/adapter.js" > "$LOG_FILE" 2>&1 &
ADAPTER_PID=$!
echo "$ADAPTER_PID" > "$PID_FILE"

# 起動確認
sleep 1
if kill -0 "$ADAPTER_PID" 2>/dev/null; then
    echo "[start.sh] ✅ Adapter started (PID $ADAPTER_PID), log: $LOG_FILE"
else
    echo "[start.sh] ❌ Adapter failed to start. Check: $LOG_FILE"
    cat "$LOG_FILE"
    exit 1
fi
