#!/usr/bin/env bash
# Builds the self-contained Windows bundle for the site PC:
#   biometric-agent/falcon-biometric-agent.zip
# The zip carries a portable node.exe, the Prisma client with its Windows engine
# and the filled .env, so the PC needs nothing installed — just run SETUP.bat.
#
# Usage (from the repo root): bash biometric-agent/build.sh
# Needs biometric-agent/.env.agent (gitignored) with the production DATABASE_URL.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_MAJOR=24
PRISMA_VERSION=5.22.0
CACHE=biometric-agent/.cache
OUT=biometric-agent/dist/falcon-biometric-agent

if [ ! -f biometric-agent/.env.agent ]; then
  echo "Missing biometric-agent/.env.agent (copy biometric-agent/windows/.env.example and fill it)" >&2
  exit 1
fi
if grep -q 'postgresql://\.\.\.' biometric-agent/.env.agent; then
  echo "biometric-agent/.env.agent still has the placeholder DATABASE_URL" >&2
  exit 1
fi

rm -rf biometric-agent/dist biometric-agent/falcon-biometric-agent.zip
mkdir -p "$OUT" "$CACHE"

# 1) Agent code
npx --yes esbuild@0.24.0 biometric-agent/src/index.ts \
  --bundle --platform=node --target=node20 --format=cjs \
  --tsconfig=tsconfig.json --external:@prisma/client \
  --outfile="$OUT/agent.js" --log-level=warning

# 2) Prisma client generated for Windows (engine downloaded here, not on the PC)
PRISMA_DIR="$CACHE/prisma-win"
rm -rf "$PRISMA_DIR" && mkdir -p "$PRISMA_DIR"
sed 's/^\(  binaryTargets *= *\).*/\1["native", "windows"]/' prisma/schema.prisma > "$PRISMA_DIR/schema.prisma"
echo '{"private":true}' > "$PRISMA_DIR/package.json"
(cd "$PRISMA_DIR" \
  && npm install --silent --no-audit --no-fund "@prisma/client@$PRISMA_VERSION" "prisma@$PRISMA_VERSION" \
  && npx prisma generate --schema=schema.prisma >/dev/null)
mkdir -p "$OUT/node_modules/@prisma" "$OUT/node_modules/.prisma"
cp -R "$PRISMA_DIR/node_modules/@prisma/client" "$OUT/node_modules/@prisma/client"
cp -R "$PRISMA_DIR/node_modules/.prisma/client" "$OUT/node_modules/.prisma/client"
# Keep only the Windows query engine.
find "$OUT/node_modules/.prisma/client" -name 'libquery_engine-*' -delete
ls "$OUT/node_modules/.prisma/client/"query_engine-windows.dll.node >/dev/null

# 3) Portable Node for Windows x64 (checksum-verified, cached)
SUMS=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt")
LINE=$(echo "$SUMS" | grep -E "  node-v${NODE_MAJOR}\.[0-9.]+-win-x64\.zip$")
NODE_ZIP=$(echo "$LINE" | awk '{print $2}')
NODE_SHA=$(echo "$LINE" | awk '{print $1}')
if [ ! -f "$CACHE/$NODE_ZIP" ]; then
  curl -fsSL -o "$CACHE/$NODE_ZIP.part" "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$NODE_ZIP"
  mv "$CACHE/$NODE_ZIP.part" "$CACHE/$NODE_ZIP"
fi
echo "$NODE_SHA  $CACHE/$NODE_ZIP" | shasum -a 256 -c - >/dev/null
mkdir -p "$OUT/node"
unzip -qj "$CACHE/$NODE_ZIP" "${NODE_ZIP%.zip}/node.exe" -d "$OUT/node"

# 4) Scripts, config, docs
cp biometric-agent/windows/{SETUP.bat,run.bat,uninstall.bat} "$OUT/"
cp biometric-agent/.env.agent "$OUT/.env"
cp biometric-agent/README.md "$OUT/README.md"

(cd biometric-agent/dist && zip -qr ../falcon-biometric-agent.zip falcon-biometric-agent)
echo "Built biometric-agent/falcon-biometric-agent.zip ($(du -h biometric-agent/falcon-biometric-agent.zip | cut -f1), node $NODE_ZIP)"
