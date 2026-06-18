#!/usr/bin/env bash
# Optimize card art for screen/repo using macOS `sips` (built in — no installs, no C++ build).
# NON-DESTRUCTIVE: reads from $SRC, writes resized+compressed JPEGs to $DST (mirroring folders).
# Your 4K originals stay untouched as print masters.
#
# Usage:  bash tools/optimize-images.sh [MAX_PX] [JPEG_QUALITY] [SRC_DIR] [DST_DIR]
#   defaults: MAX_PX=1024  JPEG_QUALITY=85  SRC=imgs  DST=imgs_web
set -uo pipefail
MAX="${1:-1024}"; Q="${2:-85}"; SRC="${3:-imgs}"; DST="${4:-imgs_web}"

n=0
while IFS= read -r -d '' f; do
  rel="${f#"$SRC"/}"            # path under SRC, e.g. "card images/Tavern night.png"
  out="$DST/${rel%.*}.jpg"      # same path, .jpg
  mkdir -p "$(dirname "$out")"
  if sips -s format jpeg -s formatOptions "$Q" -Z "$MAX" "$f" --out "$out" >/dev/null 2>&1; then
    n=$((n + 1)); printf '\r  optimized %d files…' "$n"
  else
    printf '\n  ! failed: %s\n' "$f"
  fi
done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0)

echo
echo "source $SRC: $(du -sh "$SRC" | cut -f1)   ->   $DST: $(du -sh "$DST" | cut -f1)   ($n files, max ${MAX}px, JPEG q${Q})"
