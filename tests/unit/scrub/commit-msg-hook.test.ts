import { describe, it, expect } from "vitest";
import { checkSubject } from "../../../scripts/git-hooks/commit-msg.mjs";

const BLOCKLIST = {
  paths: [],
  content_strings: [],
  subject_templates: ["^.+ \\| .+ \\| .+"],
};

describe("checkSubject", () => {
  it("accepts a conventional-commit subject", () => {
    expect(checkSubject("feat: add login flow", BLOCKLIST)).toBeNull();
  });

  it("accepts a short subject with no pipes", () => {
    expect(checkSubject("update README", BLOCKLIST)).toBeNull();
  });

  it("rejects the file|what|how template", () => {
    const subj = "src/x.ts | missing handler | added GET route";
    expect(checkSubject(subj, BLOCKLIST)?.subject).toBe(subj);
  });

  it("rejects template with leading whitespace (as audit found in some commits)", () => {
    const subj = "  src/x.ts | broken | fixed";
    expect(checkSubject(subj, BLOCKLIST)?.subject).toBe(subj);
  });

  it("does not reject a single pipe (table syntax)", () => {
    expect(checkSubject("docs: add table | header", BLOCKLIST)).toBeNull();
  });
});
