#!/usr/bin/env node
// Resolve the postcss version next would pull on its own, ignoring our override.
//
// Why: package.json pins `overrides.postcss` to keep transitive postcss above the
// vulnerable range next ships. The weekly audit needs to know when next's bundled
// postcss has caught up so the override can be dropped. Reading next's *declared*
// range (`npm view next dependencies.postcss`) can mislead — a caret range may
// satisfy a newer safe version even when next *bundles* an older one. The
// reliable signal is what `npm install` actually resolves.
//
// We do the resolve in a temp directory using a stub package.json that mirrors
// our project deps minus the postcss override. That way the working tree's
// package.json and package-lock.json are never modified — no restoration logic
// needed, no risk to the user's checkout.
//
// On success: prints the resolved version (e.g. "8.4.31") to stdout, exit 0.
// On error: prints nothing, exit non-zero — callers fall back to "unknown".

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// Build a stub package.json: keep dependencies (next is the postcss consumer)
// and devDependencies (some pull postcss too, e.g. @tailwindcss/postcss).
// Drop the postcss override so we see what npm resolves without our patch.
const stub = {
  name: 'postcss-resolution-probe',
  version: '0.0.0',
  private: true,
  dependencies: pkg.dependencies ?? {},
  devDependencies: pkg.devDependencies ?? {},
  overrides: { ...(pkg.overrides ?? {}) },
};
delete stub.overrides.postcss;

const dir = mkdtempSync(join(tmpdir(), 'postcss-probe-'));
try {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(join(dir, 'package.json'), JSON.stringify(stub, null, 2));
  execSync('npm install --package-lock-only --ignore-scripts --silent', {
    cwd: dir,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  const version = lock.packages?.['node_modules/postcss']?.version;
  if (version) process.stdout.write(version);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
