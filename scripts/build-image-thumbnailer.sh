#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

build_plugin() {
  local package="$1"
  local binary="$2"
  local plugin_dir="$3"

  cargo build -p "$package" --quiet
  mkdir -p "$plugin_dir/bin"
  cp "target/debug/$binary" "$plugin_dir/bin/$binary"
  echo "Built $plugin_dir/bin/$binary"
}

build_plugin image-thumbnailer image-thumbnailer plugins/image-thumbnailer
build_plugin thumbnailer-raw thumbnailer-raw plugins/thumbnailer-raw
build_plugin thumbnailer-heic thumbnailer-heic plugins/thumbnailer-heic
