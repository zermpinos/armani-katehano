#!/usr/bin/env bash
# Unified per-gate verifier for the public-release history scrub.
# Usage: verify.sh <phase>
#   <phase> is one of: 1, 2, 3, 4, 5, post-push
#
# Each phase runs the gate checks defined in
# docs/superpowers/specs/2026-05-21-public-release-history-scrub-design.md §5/§6.
# Exit 0 = pass. Exit non-zero = stop.

set -euo pipefail

PHASE="${1:-}"
FAIL=0

fail() {
  echo "FAIL: $1" >&2
  FAIL=1
}

ok() {
  echo "ok:   $1"
}

assert_zero_lines() {
  local label="$1"
  local count
  count=$(eval "$2" | wc -l | tr -d ' ')
  if [ "$count" = "0" ]; then ok "$label (0 lines)"; else fail "$label ($count lines): $(eval "$2" | head -3)"; fi
}

case "$PHASE" in
  1)
    assert_zero_lines "V1: no .claude/superpowers/convert.js paths in history" \
      "git log --all --pretty=format: --name-only | sort -u | grep -E '^\.claude|^docs/superpowers/|^pages/api/convert\.js$' || true"
    assert_zero_lines "V2: no claude/superpower in added-files history" \
      "git log --all --diff-filter=A --pretty=format: --name-only | grep -iE 'claude|superpower' || true"
    ;;
  2)
    for s in 'CLAUDE.md ' 'docs/superpowers' 'P. Zermpinos' 'webmaster@armani-katehano.com' 'webmaster@armani-katehano.com' 'webmaster@armani-katehano.com' 'webmaster@armani-katehano.com' 'api.anthropic.com'; do
      hits=$(git log --all -p -S "$s" --pickaxe-regex 2>/dev/null | head -1 || true)
      if [ -z "$hits" ]; then ok "V2: no occurrences of '$s'"; else fail "V2: '$s' still in history"; fi
    done
    ;;
  3)
    identities=$(git log --all --format='%an <%ae>' | sort -u)
    count=$(echo "$identities" | wc -l | tr -d ' ')
    if [ "$count" = "2" ]; then
      ok "V3: exactly 2 author identities"
    else
      fail "V3: $count identities found, expected 2:"
      echo "$identities"
    fi
    ;;
  4)
    assert_zero_lines "V4a: no file|what|how subjects" \
      "git log --all --pretty=%s | grep -E ' \| .+ \| ' || true"
    assert_zero_lines "V4b: no anthropic/claude/superpower in subjects" \
      "git log --all --pretty=%s | grep -iE 'anthropic|\.claude|superpower' || true"
    assert_zero_lines "V4c: no numbered-plan bodies" \
      "git log --all --pretty=%B | grep -E '^[[:space:]]+[0-9]+\.[[:space:]]' || true"
    assert_zero_lines "V4d: no personal-email shapes in messages" \
      "git log --all --pretty=%B | grep -iE 'pzermpinos@proton|panoszermpinos@|panos@armani-katehano' || true"
    ;;
  5)
    tags=$(git tag -l | wc -l | tr -d ' ')
    if [ "$tags" = "0" ]; then ok "V5a: no tags"; else fail "V5a: $tags tags remain: $(git tag -l)"; fi
    branches=$(git for-each-ref refs/heads/ --format='%(refname:short)')
    if [ "$branches" = "main" ]; then
      ok "V5b: only refs/heads/main remains"
    else
      fail "V5b: unexpected branches:"
      echo "$branches"
    fi
    ;;
  post-push)
    bash "$0" 1
    bash "$0" 2
    bash "$0" 3
    bash "$0" 4
    bash "$0" 5
    # Plus: build still works
    if npm test >/dev/null 2>&1 && npm run lint >/dev/null 2>&1; then
      ok "post-push: npm test + lint pass"
    else
      fail "post-push: npm test or lint failed"
    fi
    ;;
  *)
    echo "Usage: $0 <1|2|3|4|5|post-push>" >&2
    exit 2
    ;;
esac

exit $FAIL
