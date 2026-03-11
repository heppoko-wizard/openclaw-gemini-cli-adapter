#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_NAME="openclaw-gemini-cli-adapter"

echo "================================================="
echo " Packaging for Docker Production Environment"
echo "================================================="

# Get version from package.json
VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version")
OUTPUT_DIR="${RELEASE_OUTPUT_DIR:-${HOME}}"
mkdir -p "$OUTPUT_DIR"
OUTPUT_TAR="$OUTPUT_DIR/${ADAPTER_NAME}-docker-v${VERSION}.tar.gz"

echo "Creating Docker release archive: $OUTPUT_TAR"

# Create a temp staging directory
TMPDIR="$(mktemp -d)"
STAGE_ROOT="$TMPDIR/$ADAPTER_NAME"
mkdir -p "$STAGE_ROOT"

# --- Copy essential files for Docker context ---
echo "Copying source files (excluding heavy/dev assets)..."

# Use rsync to copy while strictly ignoring development files (node_modules, logs, docs etc)
# This keeps the docker build context extremely lean.
rsync -a \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'docs' \
    --exclude 'logs' \
    --exclude '.gemini' \
    --exclude 'workspace' \
    --exclude '.docker-config' \
    --exclude '*.tar.gz' \
    --exclude '*.zip' \
    --exclude 'tmp' \
    --exclude 'pack_release.sh' \
    --exclude 'pack_docker.sh' \
    "$SCRIPT_DIR/" "$STAGE_ROOT/"

# Creating tar archive
echo "Compressing into TAR.GZ..."
cd "$TMPDIR"
rm -f "$OUTPUT_TAR"
tar -czf "$OUTPUT_TAR" "$ADAPTER_NAME"

# Clean up
rm -rf "$TMPDIR"

echo "-------------------------------------------------"
echo "✓ Docker Deployment Package created successfully!"
echo "Package located at: $OUTPUT_TAR"
echo ""
echo "[ Next Steps for Production Deployment ]"
echo "  1. Copy archive to your production server:"
echo "     scp $OUTPUT_TAR user@your-server:~/"
echo "  2. Extract the archive:"
echo "     tar -xzf ${ADAPTER_NAME}-docker-v${VERSION}.tar.gz"
echo "  3. Run the automated installer to set up workspaces and start the container:"
echo "     cd $ADAPTER_NAME && ./docker-install.sh"
echo "================================================="
