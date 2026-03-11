# syntax=docker/dockerfile:1
# 
# OpenClaw Gemini CLI Adapter - Dockerfile
#
FROM node:24-bookworm

# Install all necessary dependencies for native modules and external fetches (e.g. node-llama-cpp, libsignal-node, bun installer)
# Although node:bookworm has many already, we explicitly declare them to guarantee availability.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl bash git openssh-client ca-certificates unzip \
    build-essential cmake make python3 gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Bun for runner processes
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Add npm global path to avoid prompt errors
ENV NPM_CONFIG_PREFIX=/root/.npm-global
ENV PATH="/root/.npm-global/bin:${PATH}"

# Configure git to use https instead of ssh to avoid public key permission errors during npm install
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# Install specific version of OpenClaw to prevent future build breaks
RUN npm install -g openclaw@2026.3.8

# Set working directory
WORKDIR /app

# Copy adapter code
COPY package*.json ./
RUN npm ci

COPY . .

# Set permissions for scripts
RUN chmod +x start.sh launch.sh

# Environment variables expected by Adapter
ENV PLUGIN_DIR=/app
ENV GEMINI_CLI_HOME=/root/.gemini
ENV OPENCLAW_CONFIG=/root/.openclaw/openclaw.json

# Default port for Adapter
EXPOSE 3972
# Default port for Gateway
EXPOSE 18789

# Entrypoint: Start the adapter using our start.sh script
CMD ["bash", "start.sh"]
