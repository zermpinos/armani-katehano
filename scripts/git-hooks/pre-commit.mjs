import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BLOCKLIST_PATH = resolve(__dirname, "..", "scrub", "blocklist.json");

export function checkStagedFiles(stagedPaths, blocklist) {
  const compiled = blocklist.paths.map((p) => ({ src: p, re: new RegExp(p) }));
  for (const path of stagedPaths) {
    for (const { src, re } of compiled) {
      if (re.test(path)) return { path, rule: src };
    }
  }
  return null;
}

function main() {
  const blocklist = JSON.parse(readFileSync(BLOCKLIST_PATH, "utf8"));
  const stagedRaw = execSync("git diff --cached --name-only", { encoding: "utf8" });
  const stagedPaths = stagedRaw.split("\n").filter(Boolean);

  const blocked = checkStagedFiles(stagedPaths, blocklist);
  if (blocked) {
    console.error(`ERROR: ${blocked.path} is blocked by scripts/scrub/blocklist.json (paths).`);
    console.error(`       Matched rule: ${blocked.rule}`);
    console.error(`       See scripts/git-hooks/README.md.`);
    console.error(`       Bypass with --no-verify if you really mean it.`);
    process.exit(1);
  }
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
