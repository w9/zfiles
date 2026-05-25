#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

profile="${ZFILES_BUILD_PROFILE:-release}"
cargo build --profile "$profile" -p image-thumbnailer
cargo install --path . --profile "$profile" "$@"
