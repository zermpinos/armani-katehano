# Dependency holds

These bumps are intentionally pinned below latest until conditions clear.

## eslint (held at ^9)

**Latest:** 10.3.0
**Condition to unblock:** `eslint-plugin-import` publishes a release with `peerDependencies.eslint` matching `^10`. Today (2026-05-12) the latest `eslint-plugin-import@2.32.0` peer is `^2 || ... || ^9`.
**To check:** `npm view eslint-plugin-import@latest peerDependencies.eslint`
**To bump:** remove the eslint `version-update:semver-major` entry from `.github/dependabot.yml`'s `ignore` block, then update `package.json` `"eslint": "^10"`.

## typescript (held at ^5.8.0)

**Latest:** 6.0.3
**Condition to unblock:** `tsconfig.json` no longer uses `baseUrl` — completed 2026-05-13 (Task 8 of `docs/superpowers/plans/2026-05-12-deps-and-workflows-audit-fixes.md`). Verify no other deprecated options remain.
**To check:** `npx -y typescript@latest --noEmit` against the repo.
**To bump:** remove the typescript entry from `.github/dependabot.yml`'s `ignore` block, then update `package.json` `"typescript": "^6"`.
