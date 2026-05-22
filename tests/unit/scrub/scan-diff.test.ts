import { describe, it, expect } from "vitest";
import {
  findBlockedPath,
  findBlockedContent,
  findBlockedSubject,
} from "../../../scripts/scrub/scan-diff.mjs";

const BLOCKLIST = {
  paths: ["^\\.claude(/|$)", "^docs/superpowers/", "^CLAUDE\\.md$"],
  content_strings: ["anthropic", "claude-(opus|sonnet|haiku)", "superpowers"],
  subject_templates: ["^.+ \\| .+ \\| .+"],
};

describe("findBlockedPath", () => {
  it("returns null when no paths match", () => {
    expect(findBlockedPath(["src/index.ts", "README.md"], BLOCKLIST)).toBeNull();
  });

  it("flags a .claude file", () => {
    const result = findBlockedPath([".claude/settings.json", "src/x.ts"], BLOCKLIST);
    expect(result).toEqual({ path: ".claude/settings.json", rule: "^\\.claude(/|$)" });
  });

  it("flags docs/superpowers files", () => {
    const result = findBlockedPath(["docs/superpowers/plans/x.md"], BLOCKLIST);
    expect(result?.path).toBe("docs/superpowers/plans/x.md");
  });

  it("flags CLAUDE.md at root only", () => {
    expect(findBlockedPath(["CLAUDE.md"], BLOCKLIST)?.path).toBe("CLAUDE.md");
    expect(findBlockedPath(["src/CLAUDE.md"], BLOCKLIST)).toBeNull();
  });
});

describe("findBlockedContent", () => {
  it("returns null when no strings match", () => {
    expect(findBlockedContent("hello world\nthis is fine\n", BLOCKLIST)).toBeNull();
  });

  it("flags the word anthropic", () => {
    const result = findBlockedContent("we use anthropic api here", BLOCKLIST);
    expect(result?.rule).toBe("anthropic");
  });

  it("flags model name claude-opus", () => {
    const result = findBlockedContent("model: claude-opus-4-7", BLOCKLIST);
    expect(result?.rule).toBe("claude-(opus|sonnet|haiku)");
  });

  it("flags the word superpowers", () => {
    const result = findBlockedContent("docs/superpowers/plans/x.md mentioned", BLOCKLIST);
    expect(result?.rule).toBe("superpowers");
  });
});

describe("findBlockedSubject", () => {
  it("returns null for a conventional-commit subject", () => {
    expect(findBlockedSubject("feat: add login flow", BLOCKLIST)).toBeNull();
  });

  it("flags the file|what|how template", () => {
    const subj = "src/index.ts | missing handler | added GET route";
    const result = findBlockedSubject(subj, BLOCKLIST);
    expect(result?.subject).toBe(subj);
  });
});
