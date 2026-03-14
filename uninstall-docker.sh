#!/usr/bin/env bash
#
# OpenClaw Gemini CLI Adapter - Docker version Uninstaller
#

set -euo pipefail

cd "$(dirname "$0")"

C_RESET='\033[0m'
C_CYAN='\033[36m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_BOLD='\033[1m'
C_DIM='\033[2m'

# --- Interactive Arrow Key Selection UI ---
function select_option() {
    local question="$1"
    shift
    local options=("$@")
    local selected=0
    local opt_count=${#options[@]}

    # Check if tput is available for advanced UI
    if ! command -v tput >/dev/null 2>&1; then
        echo -e "  ${C_BOLD}${question}${C_RESET}"
        for i in "${!options[@]}"; do
            echo -e "    $((i + 1))) ${options[$i]}"
        done
        while true; do
            read -p "  選択 [1-${opt_count}]: " input
            if [[ "$input" =~ ^[0-9]+$ ]] && [ "$input" -ge 1 ] && [ "$input" -le "$opt_count" ]; then
                return $((input - 1))
            fi
        done
    fi

    # Hide cursor
    tput civis

    # Print question
    echo -e "  ${C_BOLD}${question}${C_RESET}"

    while true; do
        for i in "${!options[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                echo -e "    ${C_CYAN}❯ ${C_BOLD}${options[$i]}${C_RESET}"
            else
                echo -e "      ${C_DIM}${options[$i]}${C_RESET}"
            fi
        done

        read -rsn1 key

        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 key
            if [[ "$key" == "[A" ]]; then # Up arrow
                ((selected--))
                if [ "$selected" -lt 0 ]; then selected=$((opt_count - 1)); fi
            elif [[ "$key" == "[B" ]]; then # Down arrow
                ((selected++))
                if [ "$selected" -ge "$opt_count" ]; then selected=0; fi
            fi
        elif [[ "$key" == "" ]]; then # Enter key
            break
        fi

        # Move cursor up to redraw
        tput cuu "$opt_count"
    done

    # Restore cursor
    tput cnorm
    echo ""

    return "$selected"
}

echo -e "\n${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
echo -e "${C_BOLD}🗑️  OpenClaw Gemini CLI Adapter: Docker Uninstaller${C_RESET}"
echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}\n"

echo -e "このスクリプトは、Docker版の環境をクリーンアップします。"
echo -e "${C_RED}注意: この操作は元に戻せません。${C_RESET}\n"

opts=("開始する" "キャンセルして終了する (推奨)")
select_option "アンインストールを開始しますか？" "${opts[@]}"
choice=$?

if [ "$choice" -eq 1 ]; then
    echo -e "\n  ${C_DIM}アンインストールをキャンセルしました。${C_RESET}"
    exit 0
fi

# --- Docker Command Resolution ---
DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
    else
        echo -e "\n  ${C_RED}⚠ Dockerデーモンに接続できません。コンテナの削除をスキップします。${C_RESET}"
        DOCKER_CMD=""
    fi
fi

# --- Phase 1: Docker Cleanup ---
echo -e "\n${C_BOLD}[Phase 1/2] Docker コンテナとイメージの破棄${C_RESET}"

if [ -n "$DOCKER_CMD" ]; then
    echo -e "  ${C_CYAN}コンテナとネットワークを停止・削除しています...${C_RESET}"
    $DOCKER_CMD compose down 2>/dev/null || echo -e "  ${C_DIM}(コンテナは既に存在しないか、エラーが発生しました)${C_RESET}"

    echo -e "  ${C_CYAN}Dockerイメージ (openclaw-gemini-adapter:latest) を削除しています...${C_RESET}"
    $DOCKER_CMD rmi openclaw-gemini-adapter:latest 2>/dev/null || echo -e "  ${C_DIM}(イメージは既に存在しないか、エラーが発生しました)${C_RESET}"
    
    echo -e ""
    opts=("はい、すべてのビルドキャッシュを削除する" "いいえ、保持する (推奨)")
    select_option "Dockerのビルドキャッシュ（他プロジェクトのキャッシュも含む）を掃除しますか？" "${opts[@]}"
    choice=$?
    
    if [ "$choice" -eq 0 ]; then
        echo -e "  ${C_CYAN}ビルドキャッシュを削除しています...${C_RESET}"
        $DOCKER_CMD builder prune -a -f
        echo -e "  ${C_GREEN}✓ キャッシュを削除しました。${C_RESET}"
    else
        echo -e "  ${C_DIM}キャッシュの削除をスキップしました。${C_RESET}"
    fi

    echo -e "  ${C_GREEN}✓ Docker環境のクリーンアップ完了${C_RESET}"
else
    echo -e "  ${C_DIM}Dockerコマンドが使用できないためスキップしました。${C_RESET}"
fi

echo -e "\n  ${C_CYAN}マウント用設定フォルダ (.docker-config) を削除しています...${C_RESET}"
if [ -d ".docker-config" ]; then
    # root権限で作成されている可能性があるためsudoを使う
    sudo rm -rf .docker-config
    echo -e "  ${C_GREEN}✓ .docker-config を削除しました。${C_RESET}"
else
    echo -e "  ${C_DIM}(.docker-config は見つかりませんでした)${C_RESET}"
fi


# --- Phase 2: Host Pollution Cleanup ---
echo -e "\n${C_BOLD}[Phase 2/2] ホスト環境のディープクリーン (任意)${C_RESET}"

# 1. Workspace
WORKSPACE_DIR="${HOST_WORKSPACE_DIR:-$HOME/openclaw-workspace}"
if [ -d "$WORKSPACE_DIR" ]; then
    echo -e "\n  ${C_YELLOW}AIが作成したファイルが含まれるワークスペースが見つかりました:${C_RESET}"
    echo -e "  ${C_DIM}$WORKSPACE_DIR${C_RESET}"
    opts=("はい、ワークスペースを完全に削除する" "いいえ、保持する (推奨)")
    select_option "🗑️ このワークスペースも完全に削除しますか？" "${opts[@]}"
    choice=$?
    
    if [ "$choice" -eq 0 ]; then
        sudo rm -rf "$WORKSPACE_DIR"
        echo -e "  ${C_GREEN}✓ ワークスペースを削除しました。${C_RESET}"
    else
        echo -e "  ${C_DIM}ワークスペースを保持しました。${C_RESET}"
    fi
fi

# 2. Tailscale
if command -v tailscale >/dev/null 2>&1; then
    echo -e "\n  ${C_YELLOW}Tailscale (リモートアクセスツール) がインストールされています。${C_RESET}"
    opts=("はい、Tailscaleをログアウト・アンインストールする" "いいえ、保持する (推奨)")
    select_option "🗑️ Tailscale からログアウトし、サービスを無効化・削除しますか？" "${opts[@]}"
    choice=$?
    
    if [ "$choice" -eq 0 ]; then
        echo -e "  ${C_CYAN}Tailscale からログアウトしています...${C_RESET}"
        sudo tailscale logout || true
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
             if command -v brew >/dev/null 2>&1; then
                echo -e "  ${C_CYAN}Tailscale をアンインストールしています...${C_RESET}"
                brew uninstall tailscale || true
             fi
        elif [ -x "$(command -v systemctl)" ]; then
            echo -e "  ${C_CYAN}tailscaled サービスを無効化しています...${C_RESET}"
            sudo systemctl disable --now tailscaled || true
        fi

        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo -e "  ${C_CYAN}Tailscale をアンインストールしています...${C_RESET}"
            if [ -x "$(command -v apt-get)" ]; then
                sudo apt-get remove -y tailscale || true
            elif [ -x "$(command -v dnf)" ]; then
                sudo dnf remove -y tailscale || true
            else
                echo -e "  ${C_RED}⚠ パッケージマネージャが不明なため、自動削除をスキップしました。手動でアンインストールしてください。${C_RESET}"
            fi
        fi
        echo -e "  ${C_GREEN}✓ Tailscale のクリーンアップ完了${C_RESET}"
    else
        echo -e "  ${C_DIM}Tailscale を保持しました。${C_RESET}"
    fi
fi

# 3. Auto-start settings (macOS / Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST_PATH="$HOME/Library/LaunchAgents/com.openclaw.gemini.plist"
    if [ -f "$PLIST_PATH" ]; then
        echo -e "\n  ${C_YELLOW}macOS の自動起動設定が見つかりました。${C_RESET}"
        opts=("はい、自動起動設定を削除する" "いいえ、保持する")
        select_option "🗑️ 自動起動設定を削除しますか？" "${opts[@]}"
        choice=$?
        if [ "$choice" -eq 0 ]; then
            rm -f "$PLIST_PATH"
            echo -e "  ${C_GREEN}✓ 自動起動設定 (.plist) を削除しました。${C_RESET}"
        fi
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    DESKTOP_PATH="$HOME/.config/autostart/openclaw-gemini.desktop"
    if [ -f "$DESKTOP_PATH" ]; then
        echo -e "\n  ${C_YELLOW}Linux の自動起動設定が見つかりました。${C_RESET}"
        opts=("はい、自動起動設定を削除する" "いいえ、保持する")
        select_option "🗑️ 自動起動設定を削除しますか？" "${opts[@]}"
        choice=$?
        if [ "$choice" -eq 0 ]; then
            rm -f "$DESKTOP_PATH"
            echo -e "  ${C_GREEN}✓ 自動起動設定 (.desktop) を削除しました。${C_RESET}"
        fi
    fi
fi

echo -e "\n${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"

echo -e "${C_BOLD}${C_GREEN}🎉 アンインストールが完了しました！${C_RESET}"
echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}\n"

echo -e "以下の項目はシステム全体に影響するため、自動削除していません。不要な場合は手動で削除してください:"
echo -e "  - ${C_BOLD}Docker エンジン${C_RESET} (例: sudo apt-get remove docker-ce)"
echo -e "  - ${C_BOLD}現在のディレクトリ${C_RESET} ($(pwd))"
echo -e "\n完了しました。\n"

