#!/usr/bin/env node
// Production deps are audited separately with no exceptions. This judges the full
// audit, where a dev-only advisory may be accepted with a reason and a review date.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAX_DAYS = 90;
const DAY_MS = 86_400_000;

export function evaluate(audit, exceptions, today) {
  // Fail closed: a registry or npm error must not read as "no advisories".
  if (!audit || typeof audit.vulnerabilities !== "object" || audit.vulnerabilities === null) {
    throw new Error(`npm audit returned no report: ${JSON.stringify(audit?.error ?? audit).slice(0, 200)}`);
  }

  const found = new Map();
  for (const vuln of Object.values(audit.vulnerabilities)) {
    for (const via of vuln.via ?? []) {
      if (typeof via === "object") found.set(String(via.url ?? via.source).split("/").pop(), via.name);
    }
  }

  const limit = new Date(Date.parse(today) + MAX_DAYS * DAY_MS).toISOString().slice(0, 10);
  const result = { accepted: [], unlisted: [], expired: [], invalid: [], stale: [] };
  for (const [id, entry] of Object.entries(exceptions)) {
    const date = entry?.review_by ?? "";
    if (!entry?.reason || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > limit) result.invalid.push(id);
    else if (!found.has(id)) result.stale.push(id);
    else if (date < today) result.expired.push(`${id} (${found.get(id)}, review_by ${date})`);
    else result.accepted.push(`${id} (${found.get(id)}, review_by ${date})`);
  }
  for (const [id, pkg] of found) if (!(id in exceptions)) result.unlisted.push(`${id} (${pkg})`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw;
  // npm audit exits 1 whenever it finds anything; the JSON is what gets judged.
  try {
    raw = execSync("npm audit --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    raw = err.stdout;
  }
  const exceptions = JSON.parse(readFileSync(".github/audit-exceptions.json", "utf8"));
  const r = evaluate(JSON.parse(raw), exceptions, new Date().toISOString().slice(0, 10));

  for (const a of r.accepted) console.log(`accepted: ${a}`);
  for (const s of r.stale) console.log(`::warning::stale exception ${s}: no longer reported, remove it from .github/audit-exceptions.json`);
  for (const i of r.invalid) console.log(`::error::invalid exception ${i}: needs a reason and a review_by date within ${MAX_DAYS} days`);
  for (const x of r.expired) console.log(`::error::exception past its review date: ${x}`);
  for (const u of r.unlisted) console.log(`::error::advisory not accepted: ${u}`);
  process.exit(r.unlisted.length + r.expired.length + r.invalid.length ? 1 : 0);
}
