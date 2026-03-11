#!/usr/bin/env bash
#
# OpenClaw Gemini CLI Adapter - Docker Setup Entrypoint
#

set -euo pipefail

cd "$(dirname "$0")"

C_RESET='\033[0m'
C_CYAN='\033[36m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_BOLD='\033[1m'

echo -e "\n${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
echo -e "${C_BOLD}🚀 OpenClaw Gemini CLI Adapter: Docker Installation${C_RESET}"
echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}\n"

# 1. Check Docker
if command -v docker >/dev/null 2>&1; then
    echo -e "  ${C_GREEN}✓ Docker is installed ($(docker --version))${C_RESET}"
else
    echo -e "  ${C_YELLOW}⚠ Docker is not installed. Installing...${C_RESET}"
    echo -e "  ${C_CYAN}Downloading get.docker.com script...${C_RESET}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    echo -e "  ${C_CYAN}Executing Docker installation...${C_RESET}"
    sudo sh get-docker.sh
    rm -f get-docker.sh
    echo -e "  ${C_GREEN}✓ Docker installation completed.${C_RESET}"
fi

# 2. Check docker-compose plugin
if docker compose version >/dev/null 2>&1; then
    echo -e "  ${C_GREEN}✓ Docker Compose plugin is available${C_RESET}"
else
    echo -e "  ${C_RED}⚠ Docker Compose plugin not found. Please ensure it is installed.${C_RESET}"
    exit 1
fi

# 3. Add user to docker group if needed
USER_GROUPS=$(groups)
if [[ $USER_GROUPS != *"docker"* ]]; then
    echo -e "\n  ${C_YELLOW}⚠ Current user is not in the 'docker' group.${C_RESET}"
    echo -e "  ${C_CYAN}Adding $USER to docker group...${C_RESET}"
    sudo usermod -aG docker "$USER"
    echo -e "\n  ${C_BOLD}${C_GREEN}✓ Added to docker group.${C_RESET}"
    echo -e "  ${C_BOLD}Applying group changes and proceeding to setup automatically...${C_RESET}"
    exec sg docker -c "node docker-setup.js"
fi

# 4. Proceed to docker-setup.js
echo -e "\n  ${C_BOLD}Proceeding to the authentication and workspace setup...${C_RESET}"
node docker-setup.js
