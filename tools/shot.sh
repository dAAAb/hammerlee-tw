#!/bin/sh
# Headless screenshot of the local page: tools/shot.sh OUT.png "query" [width height wait]
G="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=$1; Q=$2; W=${3:-390}; H=${4:-844}; WAIT=${5:-14}
"$G" --headless=new --hide-scrollbars --user-data-dir="$(mktemp -d)" --force-device-scale-factor=2 \
  --window-size=$W,$H --virtual-time-budget=5000 --enable-unsafe-swiftshader \
  --screenshot="$OUT" "http://localhost:5391/?$Q" >/dev/null 2>&1 &
pid=$!; sleep $WAIT; kill $pid 2>/dev/null; wait $pid 2>/dev/null
[ -f "$OUT" ] && echo "shot $OUT" || echo "no shot"
