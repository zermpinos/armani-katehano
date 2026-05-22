#!/usr/bin/env bash
# Symlinks scripts/git-hooks/{pre-commit,commit-msg} into .git/hooks/.
# Re-running is idempotent.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_SRC="$REPO_ROOT/scripts/git-hooks"
HOOK_DST="$(git rev-parse --git-path hooks)"

for hook in pre-commit commit-msg; do
  ln -sf "$HOOK_SRC/$hook" "$HOOK_DST/$hook"
  chmod +x "$HOOK_SRC/$hook"
  echo "linked $HOOK_DST/$hook -> $HOOK_SRC/$hook"
done
echo "Hooks installed: pre-commit, commit-msg"
