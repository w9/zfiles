#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-./fixtures}"
mkdir -p "$ROOT/small" "$ROOT/unicode" "$ROOT/deep"

# small: mixed file types for general behavior
for i in $(seq 1 20); do
  printf 'sample-%03d\n' "$i" > "$ROOT/small/file-$(printf '%03d' "$i").txt"
done
mkdir -p "$ROOT/small/photos"
printf 'jpeg\n' > "$ROOT/small/photos/image.jpg"
printf 'notes\n' > "$ROOT/small/notes.txt"

# unicode: NFC/NFD and emoji filenames
printf 'nfc\n' > "$ROOT/unicode/$(printf '\xc3\xa9').txt"
printf 'nfd\n' > "$ROOT/unicode/$(printf 'e\xcc\x81').txt"
printf 'emoji\n' > "$ROOT/unicode/hello-\360\237\221\213.txt"

# deep: nested directories
current="$ROOT/deep"
for depth in $(seq 1 5); do
  current="$current/level-$depth"
  mkdir -p "$current"
  printf 'depth-%s\n' "$depth" > "$current/readme.txt"
done

echo "Generated fixture corpus under $ROOT"
