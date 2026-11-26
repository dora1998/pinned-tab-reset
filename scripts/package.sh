#!/usr/bin/env bash
# Chrome Web Store に提出する zip を dist/ に作る。
# 拡張機能の動作に必要なファイルだけを含める。
#
#   scripts/package.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

files=(
  manifest.json
  background.js
  options.html
  options.css
  options.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
)

version="$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' manifest.json)"
out="dist/pinned-tab-reset-$version.zip"

mkdir -p dist
rm -f "$out"
zip -X -q "$out" "${files[@]}"

echo "wrote $out"
unzip -l "$out"
