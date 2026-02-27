#!/bin/bash
set -e

# ==============================================================================
# 0. Language Selection
# ==============================================================================
echo "Select language / 言語選択 / 选择语言:"
echo "[1] English"
echo "[2] 日本語"
echo "[3] 简体中文"
read -r -p "> " lang_choice

SETUP_LANG="en"
case "$lang_choice" in
    2) SETUP_LANG="ja" ;;
    3) SETUP_LANG="zh" ;;
    *) SETUP_LANG="en" ;;
esac

export SETUP_LANG

# Define basic messages based on the selected language
if [ "$SETUP_LANG" = "ja" ]; then
    MSG_WELCOME="=================================================\n OpenClaw Gemini Gateway 自動インストーラー\n================================================="
    MSG_NODE_CHECK="Node.js と npm の存在を確認しています..."
    MSG_NODE_NOT_FOUND="[!] Node.js が見つかりません。NVM を使用して自動インストールします..."
    MSG_NODE_INSTALLED="✓ Node.js が利用可能です"
    MSG_BUN_CHECK="Bun の存在を確認しています (Gemini CLI を高速化するオプション)..."
    MSG_BUN_NOT_FOUND="[!] Bun が見つかりません。自動インストールします..."
    MSG_BUN_INSTALLED="✓ Bun が利用可能です"
    MSG_START_SETUP="バックエンドのセットアップを開始します..."
elif [ "$SETUP_LANG" = "zh" ]; then
    MSG_WELCOME="=================================================\n OpenClaw Gemini 网关自动安装程序\n================================================="
    MSG_NODE_CHECK="正在检查 Node.js 和 npm..."
    MSG_NODE_NOT_FOUND="[!] 未找到 Node.js。将使用 NVM 自动安装..."
    MSG_NODE_INSTALLED="✓ Node.js 可用"
    MSG_BUN_CHECK="正在检查 Bun (用于加速 Gemini CLI)..."
    MSG_BUN_NOT_FOUND="[!] 未找到 Bun。将自动安装..."
    MSG_BUN_INSTALLED="✓ Bun 可用"
    MSG_START_SETUP="正在启动后端安装程序..."
else
    MSG_WELCOME="=================================================\n OpenClaw Gemini Gateway Automated Installer\n================================================="
    MSG_NODE_CHECK="Checking for Node.js and npm..."
    MSG_NODE_NOT_FOUND="[!] Node.js not found. Installing automatically via NVM..."
    MSG_NODE_INSTALLED="✓ Node.js is available"
    MSG_BUN_CHECK="Checking for Bun (optional, for faster Gemini CLI)..."
    MSG_BUN_NOT_FOUND="[!] Bun not found. Installing automatically..."
    MSG_BUN_INSTALLED="✓ Bun is available"
    MSG_START_SETUP="Starting backend setup..."
fi

echo -e "\n${MSG_WELCOME}\n"

# ==============================================================================
# 1. NVM を必ずシェルに読み込む (インストール済みの場合もここで有効化する)
# ==============================================================================
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ==============================================================================
# 2. Node.js チェック (NVM 読込後に実施)
# ==============================================================================
echo "${MSG_NODE_CHECK}"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "${MSG_NODE_NOT_FOUND}"
    echo "-------------------------------------------------"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -s -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
        # NVM インストール直後にそのセッションへ読み込む
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    nvm install --lts
    nvm use --lts
    echo "-------------------------------------------------"
else
    echo "${MSG_NODE_INSTALLED}: $(node -v)"
fi

# ==============================================================================
# 3. Bun チェック (PATH 更新を考慮)
# ==============================================================================
# Bun は ~/.bun/bin に入る。既存インストールでも PATH に入っていないケースがある。
export PATH="$HOME/.bun/bin:$PATH"

echo ""
echo "${MSG_BUN_CHECK}"
if command -v bun >/dev/null 2>&1; then
    echo "${MSG_BUN_INSTALLED}: $(bun --version)"
else
    echo "${MSG_BUN_NOT_FOUND}"
    curl -fsSL https://bun.sh/install | bash
    # インストール直後も PATH を更新
    export PATH="$HOME/.bun/bin:$PATH"
fi

# ==============================================================================
# 4. setup.js の呼び出し
# ==============================================================================
echo ""
echo "${MSG_START_SETUP}"
SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v bun >/dev/null 2>&1; then
    bun "$SETUP_DIR/setup.js"
else
    node "$SETUP_DIR/setup.js"
fi
