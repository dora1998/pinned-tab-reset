#!/usr/bin/env bash
# Chrome Web Store 用のプロモーションタイル（小: 440x280）を生成する。
# 必要なもの: python3, ImageMagick (magick), macOS のシステムフォント
#
#   scripts/gen_promo.sh [出力先ディレクトリ]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/store}"
mkdir -p "$out"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/promo.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

title_font="${TITLE_FONT:-/System/Library/Fonts/Avenir Next.ttc}"
body_font="${BODY_FONT:-/System/Library/Fonts/Avenir Next.ttc}"

python3 -I "$root/scripts/gen_icons.py" --glyph 200 "$tmp/glyph.png"

magick -size 440x280 -define gradient:angle=135 gradient:'#8B5CF6-#4F46E5' \
  \( "$tmp/glyph.png" \) -gravity west -geometry +4+0 -composite \
  -fill white -font "$title_font" -pointsize 38 -gravity northwest \
  -annotate +200+86 'Pinned Tab' -annotate +200+128 'Reset' \
  -fill '#E4E0FF' -font "$body_font" -pointsize 15 \
  -annotate +202+184 'Snap tabs back to their' -annotate +202+204 'home URL with one key.' \
  -alpha off -strip "PNG24:$out/promo-small-440x280.png"

echo "wrote $out/promo-small-440x280.png"
