#!/usr/bin/env bash
# exit on error
set -o errexit

# Download Tectonic compiler statically using musl build to avoid GLIBC compatibility issues on Render
echo "🌐 Downloading static Tectonic musl compiler..."
curl -L -o tectonic.tar.gz https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic@0.16.9/tectonic-0.16.9-x86_64-unknown-linux-musl.tar.gz

# Extract
echo "📦 Extracting Tectonic..."
tar -xzf tectonic.tar.gz

# Move to local bin directory
echo "💾 Relocating tectonic executable to local bin/ directory..."
mkdir -p bin
mv tectonic bin/
chmod +x bin/tectonic

# Clean up
rm tectonic.tar.gz

echo "✅ Tectonic compiler successfully installed to bin/tectonic"
