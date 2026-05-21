#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-./fixtures/large}"
COUNT="${2:-1000}"

mkdir -p "$TARGET"
for i in $(seq 1 "$COUNT"); do
  printf 'file-%04d\n' "$i" > "$TARGET/file-$(printf '%04d' "$i").txt"
done

echo "Generated $COUNT files in $TARGET"
