#!/bin/sh
# Download the OFL fonts the 3D letters are made from (not kept in git).
set -e
cd "$(dirname "$0")/../assets/fonts"
UA="Mozilla/4.0"
for fam in "Huninn:Huninn-Regular.ttf" "Chiron+GoRound+TC:ChironGoRoundTC-Regular.ttf"; do
  name=${fam%%:*}; file=${fam#*:}
  [ -f "$file" ] && continue
  url=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=$name" | grep -o "https://[^)]*\.ttf" | head -1)
  curl -sL "$url" -o "$file"
  echo "fetched $file"
done
