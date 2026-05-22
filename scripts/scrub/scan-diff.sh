#!/usr/bin/env bash
# Thin Bash wrapper around scripts/scrub/scan-diff.mjs.
# Exists because some CI runners and developers prefer a `.sh` entrypoint.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/scan-diff.mjs" "$@"
