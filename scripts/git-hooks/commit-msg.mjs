import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BLOCKLIST_PATH = resolve(__dirname, "..", "scrub", "blocklist.json");

export function checkSubject(subject, blocklist) {
  const compiled = blocklist.subject_templates.map((p) => ({ src: p, re: new RegExp(p) }));
  for (const { src, re } of compiled) {
    if (re.test(subject)) return { subject, rule: src };
  }
  return null;
}

function firstNonBlankLine(text) {
  for (const line of text.split("\n")) {
    if (line.trim()) return line;
  }
  return "";
}

function main() {
  const msgPath = process.argv[2];
  if (!msgPath) {
    console.error("ERROR: commit-msg hook expects message-file argument");
    process.exit(2);
  }
  const blocklist = JSON.parse(readFileSync(BLOCKLIST_PATH, "utf8"));
  const msg = readFileSync(msgPath, "utf8");
  const subject = firstNonBlankLine(msg);
  if (!subject) process.exit(0); // empty commit message — git will reject

  const blocked = checkSubject(subject, blocklist);
  if (blocked) {
    console.error(`ERROR: commit subject matches a blocked template.`);
    console.error(`       Subject: "${blocked.subject}"`);
    console.error(`       Matched rule: ${blocked.rule}`);
    console.error(`       Templates of the form \`<file> | <what> | <how>\` are reserved`);
    console.error(`       for local working notes. Use a conventional-commit subject`);
    console.error(`       (feat:/fix:/refactor:/chore:/test:/docs:).`);
    process.exit(1);
  }
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
