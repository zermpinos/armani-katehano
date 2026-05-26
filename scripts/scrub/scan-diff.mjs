import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BLOCKLIST_PATH = resolve(__dirname, "blocklist.json");

export function loadBlocklist(path = BLOCKLIST_PATH) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileRegexes(patterns) {
  // eslint-disable-next-line security/detect-non-literal-regexp
  return patterns.map((p) => ({ src: p, re: new RegExp(p) }));
}

export function findBlockedPath(filePaths, blocklist) {
  const compiled = compileRegexes(blocklist.paths);
  for (const path of filePaths) {
    for (const { src, re } of compiled) {
      if (re.test(path)) return { path, rule: src };
    }
  }
  return null;
}

export function findBlockedContent(content, blocklist) {
  const compiled = compileRegexes(blocklist.content_strings);
  for (const { src, re } of compiled) {
    const m = re.exec(content);
    if (m) return { match: m[0], rule: src, offset: m.index };
  }
  return null;
}

export function findBlockedSubject(subject, blocklist) {
  const compiled = compileRegexes(blocklist.subject_templates);
  for (const { src, re } of compiled) {
    if (re.test(subject)) return { subject, rule: src };
  }
  return null;
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const base = process.argv[2] || "origin/main";
  const blocklist = loadBlocklist();

  const changedPaths = git(`diff --name-only ${base}...HEAD`).split("\n").filter(Boolean);
  const blockedPath = findBlockedPath(changedPaths, blocklist);
  if (blockedPath) {
    console.error(`BLOCKED PATH: ${blockedPath.path}  (rule: ${blockedPath.rule})`);
    process.exit(1);
  }

  const diffContent = git(`diff ${base}...HEAD`);
  const blockedContent = findBlockedContent(diffContent, blocklist);
  if (blockedContent) {
    console.error(`BLOCKED CONTENT: "${blockedContent.match}"  (rule: ${blockedContent.rule})`);
    process.exit(1);
  }

  const subjects = git(`log ${base}..HEAD --pretty=%s`).split("\n").filter(Boolean);
  for (const subj of subjects) {
    const blocked = findBlockedSubject(subj, blocklist);
    if (blocked) {
      console.error(`BLOCKED SUBJECT: "${blocked.subject}"  (rule: ${blocked.rule})`);
      process.exit(1);
    }
  }

  console.log("scan-diff: clean");
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
