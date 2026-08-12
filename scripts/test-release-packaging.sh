#!/usr/bin/env bash
# Smoke-test the release tar.gz layout used by .github/workflows/release.yml
# and the extract/install steps of scripts/install.sh (without hitting GitHub).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

stage="${tmpdir}/stage"
mkdir -p "$stage"
printf '#!/bin/sh\necho stub\n' >"${stage}/zfiles"
chmod 0755 "${stage}/zfiles"

asset="${tmpdir}/zfiles-linux-x86_64.tar.gz"
tar -C "$stage" -czf "$asset" zfiles

# Archive must contain a single member named zfiles with the executable bit.
listing="$(tar -tzf "$asset")"
if [[ "$listing" != "zfiles" ]]; then
  echo "error: expected archive member 'zfiles', got: ${listing@Q}" >&2
  exit 1
fi

# GNU tar prints mode in `tar -tv`; require owner execute bit.
mode="$(tar -tvzf "$asset" | awk '{print $1; exit}')"
if [[ "$mode" != -*x* ]]; then
  echo "error: expected executable mode in archive, got: ${mode@Q}" >&2
  exit 1
fi

extract="${tmpdir}/extract"
mkdir -p "$extract"
tar -xzf "$asset" -C "$extract"
if [[ ! -x "${extract}/zfiles" ]]; then
  echo "error: extracted zfiles is not executable" >&2
  exit 1
fi

install_dir="${tmpdir}/bin"
mkdir -p "$install_dir"
# Mirror install.sh post-extract steps.
chmod 0755 "${extract}/zfiles"
mv "${extract}/zfiles" "${install_dir}/zfiles"
if [[ ! -x "${install_dir}/zfiles" ]]; then
  echo "error: installed binary is not executable" >&2
  exit 1
fi

# install.sh must be executable in the repo (for curl|sh and local runs).
if [[ ! -x "${root}/scripts/install.sh" ]]; then
  echo "error: scripts/install.sh is not executable in the working tree" >&2
  exit 1
fi

# curl|sh ignores the shebang; the script must parse under plain POSIX sh (e.g. dash).
if ! sh -n "${root}/scripts/install.sh"; then
  echo "error: scripts/install.sh is not valid under sh (curl|sh would fail)" >&2
  exit 1
fi

echo "ok: release packaging and install layout"
