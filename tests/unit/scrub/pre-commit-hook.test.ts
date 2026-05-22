import { describe, it, expect } from "vitest";
import { checkStagedFiles } from "../../../scripts/git-hooks/pre-commit.mjs";

const BLOCKLIST = {
  paths: ["^\\.claude(/|$)", "^docs/superpowers/", "^CLAUDE\\.md$", "^\\.worktrees/"],
  content_strings: [],
  subject_templates: [],
};

describe("checkStagedFiles", () => {
  it("returns null when all paths are clean", () => {
    expect(checkStagedFiles(["src/index.ts", "tests/x.test.ts"], BLOCKLIST)).toBeNull();
  });

  it("flags .claude/settings.json", () => {
    const result = checkStagedFiles([".claude/settings.json"], BLOCKLIST);
    expect(result?.path).toBe(".claude/settings.json");
  });

  it("flags docs/superpowers/plans/anything.md", () => {
    const result = checkStagedFiles(["docs/superpowers/plans/x.md"], BLOCKLIST);
    expect(result?.path).toBe("docs/superpowers/plans/x.md");
  });

  it("flags root CLAUDE.md but not nested CLAUDE.md", () => {
    expect(checkStagedFiles(["CLAUDE.md"], BLOCKLIST)?.path).toBe("CLAUDE.md");
    expect(checkStagedFiles(["docs/CLAUDE.md"], BLOCKLIST)).toBeNull();
  });

  it("flags .worktrees/anything", () => {
    expect(checkStagedFiles([".worktrees/x"], BLOCKLIST)?.path).toBe(".worktrees/x");
  });
});
