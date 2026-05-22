# Git hooks

This directory holds two repo-local git hooks installed via `npm run hooks:install`:

- **`pre-commit`** — blocks staged paths matching `scripts/scrub/blocklist.json`'s `paths` list. Prevents accidental commits of local-only tooling config.
- **`commit-msg`** — blocks commit subjects matching `subject_templates`. Enforces conventional-commit subjects.

Both hooks read their blocklist from `scripts/scrub/blocklist.json` so adding or removing rules only requires editing one file.

## Install

```bash
npm run hooks:install
```

The install script symlinks the hooks into `.git/hooks/`. Re-running is safe and idempotent.

## Bypass

`git commit --no-verify` skips both hooks. The CI workflow `.github/workflows/internal-config-scan.yml` provides a second-chance check on pull requests, so a `--no-verify` commit will still be flagged before merge.
