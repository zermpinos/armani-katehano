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

# Retention-aware ref scope.
# During the post-force-push retention window, the working repo keeps:
#   - refs/tags/backup/*   (pre-rewrite snapshot tag)
#   - refs/original/*      (filter-repo safety refs, if any)
# Those refs intentionally carry pre-scrub content. Audit walks must
# exclude them so they don't surface as false-positive leaks.
# (In a fresh mirror clone these refs are absent and EXCLUDE_BACKUP is a no-op.)
# Note: --exclude=<glob> must precede --all.
EXCLUDE_BACKUP="--exclude=refs/tags/backup/* --exclude=refs/original/*"

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
      "git log $EXCLUDE_BACKUP --all --pretty=format: --name-only | sort -u | grep -E '^\.claude|^docs/superpowers/|^pages/api/convert\.js$' || true"
    assert_zero_lines "V2: no claude/superpower in added-files history" \
      "git log $EXCLUDE_BACKUP --all --diff-filter=A --pretty=format: --name-only | grep -iE 'claude|superpower' || true"
    ;;
  2)
    # V2 checks string-content NOT covered by V1 (paths) and gitleaks (secret shapes).
    # We intentionally only list strings that SURVIVE Phase 2's substitution rules
    # — listing post-scrub values (e.g. the new author name/email) would put them
    # into the verifier's own committed text, and any subsequent Phase 2 run would
    # re-scrub the verifier, producing spurious failures.
    # Personal-email shapes are covered by V4d (regex-based, never substituted).
    # Author identities are covered by V3.
    # Exclude scrub-config self-references from the pickaxe search.
    for s in 'CLAUDE.md ' 'docs/superpowers' 'api.anthropic.com'; do
      hits=$(git log $EXCLUDE_BACKUP --all -p -S "$s" --pickaxe-regex -- \
        ':(exclude).gitleaks.toml' \
        ':(exclude).gitignore' \
        ':(exclude)scripts/scrub/' \
        ':(exclude)scripts/git-hooks/' \
        ':(exclude)tests/unit/scrub/' \
        ':(exclude).github/workflows/internal-config-scan.yml' \
        2>/dev/null | head -1 || true)
      if [ -z "$hits" ]; then ok "V2: no occurrences of '$s'"; else fail "V2: '$s' still in history"; fi
    done
    ;;
  3)
    identities=$(git log $EXCLUDE_BACKUP --all --format='%an <%ae>' | sort -u)
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
      "git log $EXCLUDE_BACKUP --all --pretty=%s | grep -E ' \| .+ \| ' || true"
    assert_zero_lines "V4b: no anthropic/claude/superpower in subjects" \
      "git log $EXCLUDE_BACKUP --all --pretty=%s | grep -iE 'anthropic|\.claude|superpower' || true"
    assert_zero_lines "V4c: no numbered-plan bodies" \
      "git log $EXCLUDE_BACKUP --all --pretty=%B | grep -E '^[[:space:]]+[0-9]+\.[[:space:]]' || true"
    assert_zero_lines "V4d: no personal-email shapes in messages" \
      "git log $EXCLUDE_BACKUP --all --pretty=%B | grep -iE 'pzermpinos@proton|panoszermpinos@|panos@armani-katehano' || true"
    ;;
  5)
    # V5a: origin must have zero tags. The local repo may keep refs/tags/backup/*
    # during the retention window — these are private and never pushed.
    if git ls-remote origin >/dev/null 2>&1; then
      origin_tags=$(git ls-remote --tags origin 2>/dev/null | wc -l | tr -d ' ')
      if [ "$origin_tags" = "0" ]; then ok "V5a: origin has 0 tags"; else fail "V5a: origin has $origin_tags tags"; fi
    fi
    # Local non-backup tags should also be 0.
    local_nonbackup_tags=$(git for-each-ref refs/tags/ --format='%(refname)' | grep -v '^refs/tags/backup/' || true)
    if [ -z "$local_nonbackup_tags" ]; then
      ok "V5a-local: no local tags outside refs/tags/backup/*"
    else
      fail "V5a-local: unexpected local tags: $local_nonbackup_tags"
    fi
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
