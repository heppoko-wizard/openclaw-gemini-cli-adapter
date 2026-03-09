#!/bin/bash
# ============================================================
# clean.sh — OpenClaw + Gemini CLI Adapter 完全クリーンスクリプト
# テスト・再インストール前のリセット用
# ============================================================
set -euo pipefail

BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}============================================================${RESET}"
echo -e "${BOLD} OpenClaw + Adapter クリーンスクリプト${RESET}"
echo -e "${BOLD}============================================================${RESET}"
echo ""
echo -e "${YELLOW}このスクリプトは以下を削除します:${RESET}"
echo "  1. 実行中の Gateway / Adapter プロセスを停止"
echo "  2. アダプターを npm グローバルの OpenClaw フォルダから削除"
echo "  3. OpenClaw をグローバルアンインストール (sudo npm uninstall -g openclaw)"
echo "  4. ~/.openclaw/ の設定ファイル削除 (任意)"
echo ""
read -p "続行しますか？ (Enter で続行 / Ctrl+C でキャンセル)"

# ---- [1] プロセス停止 ----
echo ""
echo -e "${CYAN}[1/4] 実行中のプロセスを停止中...${RESET}"

kill $(lsof -t -i :18789 2>/dev/null) 2>/dev/null && echo "  ✓ Gateway (port 18789) を停止しました" || echo "  - Gateway は起動していません"
kill $(lsof -t -i :3972 2>/dev/null) 2>/dev/null  && echo "  ✓ Adapter (port 3972) を停止しました"  || echo "  - Adapter は起動していません"

# PIDファイルがあれば削除
ADAPTER_PID_FILE="$(dirname "$0")/logs/adapter.pid"
if [ -f "$ADAPTER_PID_FILE" ]; then
    rm -f "$ADAPTER_PID_FILE"
    echo "  ✓ PID ファイルを削除しました"
fi

# ---- [2] npm グローバルからアダプターフォルダを削除 ----
echo ""
echo -e "${CYAN}[2/4] npm グローバルの OpenClaw フォルダ内アダプターを削除中...${RESET}"

NPM_ROOT=$(npm root -g 2>/dev/null || echo "")
if [ -n "$NPM_ROOT" ]; then
    ADAPTER_IN_OPENCLAW="$NPM_ROOT/openclaw/openclaw-gemini-cli-adapter"
    if [ -d "$ADAPTER_IN_OPENCLAW" ]; then
        sudo rm -rf "$ADAPTER_IN_OPENCLAW"
        echo "  ✓ 削除: $ADAPTER_IN_OPENCLAW"
    else
        echo "  - アダプターはすでに存在しません: $ADAPTER_IN_OPENCLAW"
    fi
else
    echo "  - npm root が取得できませんでした"
fi

# ---- [3] OpenClaw グローバルアンインストール ----
echo ""
echo -e "${CYAN}[3/4] OpenClaw をグローバルアンインストール中...${RESET}"

if command -v openclaw >/dev/null 2>&1; then
    sudo npm uninstall -g openclaw
    echo "  ✓ openclaw をグローバルアンインストールしました"
else
    echo "  - openclaw コマンドが見つかりません（スキップ）"
fi

# ---- [4] ~/.openclaw/ の削除（任意） ----
echo ""
echo -e "${CYAN}[4/4] OpenClaw 設定ファイルの削除 (任意)${RESET}"
OPENCLAW_DIR="$HOME/.openclaw"
if [ -d "$OPENCLAW_DIR" ]; then
    echo ""
    read -p "  ~/.openclaw/ を削除しますか？ (y/N): " REMOVE_CONFIG
    if [[ "$REMOVE_CONFIG" =~ ^[Yy]$ ]]; then
        rm -rf "$OPENCLAW_DIR"
        echo "  ✓ 削除: $OPENCLAW_DIR"
    else
        echo "  - スキップしました（設定ファイルは保持されます）"
    fi
else
    echo "  - ~/.openclaw/ は存在しません"
fi

# ---- [5] GWS CLI 認証情報の削除（任意） ----
echo ""
echo -e "${CYAN}[5/5] GWS CLI 認証情報の削除 (任意)${RESET}"
GWS_DIR="$HOME/.config/gws"
if [ -d "$GWS_DIR" ]; then
    echo ""
    read -p "  ~/.config/gws/ を削除しますか？ (y/N): " REMOVE_GWS
    if [[ "$REMOVE_GWS" =~ ^[Yy]$ ]]; then
        rm -rf "$GWS_DIR"
        echo "  ✓ 削除: $GWS_DIR"
    else
        echo "  - スキップしました（GWS設定ファイルは保持されます）"
    fi
else
    echo "  - ~/.config/gws/ は存在しません"
fi

echo ""
echo -e "${BOLD}${GREEN}============================================================${RESET}"
echo -e "${BOLD}${GREEN} クリーン完了！再インストールするには setup スクリプトを実行してください${RESET}"
echo -e "${BOLD}${GREEN}============================================================${RESET}"
echo ""
