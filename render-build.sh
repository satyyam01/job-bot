#!/usr/bin/env bash
# exit on error
set -o errexit

# Download Tectonic compiler statically
echo "🌐 Downloading static Tectonic compiler..."
curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh

# Move to local bin directory
echo "💾 Relocating tectonic executable to local bin/ directory..."
mkdir -p bin
mv tectonic bin/
chmod +x bin/tectonic

echo "✅ Tectonic compiler successfully installed to bin/tectonic"
