#!/bin/sh
# Install the latest zfiles Linux release binary into ~/.local/bin (no sudo).
# Usage: curl -fsSL https://raw.githubusercontent.com/w9/zfiles/main/scripts/install.sh | sh
# Must stay POSIX sh: curl|sh ignores the shebang (e.g. dash on Debian/Ubuntu).
set -eu

REPO="${ZFILES_REPO:-w9/zfiles}"
INSTALL_DIR="${ZFILES_INSTALL_DIR:-${HOME}/.local/bin}"

if [ "$(uname -s)" != "Linux" ]; then
  echo "error: this installer currently supports Linux only" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64 | amd64) asset="zfiles-linux-x86_64.tar.gz" ;;
  aarch64 | arm64) asset="zfiles-linux-aarch64.tar.gz" ;;
  *)
    echo "error: unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is required" >&2
  exit 1
fi

url="https://github.com/${REPO}/releases/latest/download/${asset}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "Downloading ${url}"
curl -fsSL "$url" -o "${tmpdir}/${asset}"

tar -xzf "${tmpdir}/${asset}" -C "$tmpdir"
if [ ! -f "${tmpdir}/zfiles" ]; then
  echo "error: archive did not contain zfiles" >&2
  exit 1
fi
chmod 0755 "${tmpdir}/zfiles"

mkdir -p "$INSTALL_DIR"
mv "${tmpdir}/zfiles" "${INSTALL_DIR}/zfiles"

echo "Installed ${INSTALL_DIR}/zfiles"
if ! command -v zfiles >/dev/null 2>&1; then
  echo "Note: add ${INSTALL_DIR} to your PATH if it is not already."
fi
