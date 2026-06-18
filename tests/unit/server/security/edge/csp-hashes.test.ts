// @ts-nocheck
import { describe, it, expect } from "vitest";
import { scriptHashes, styleHashes } from "@/server/security/edge/csp-hashes";

const SHA256_B64 = /^sha256-[A-Za-z0-9+/]{43}=$/;

describe("csp-hashes", () => {
  it("scriptHashes is a readonly array", () => {
    expect(Array.isArray(scriptHashes)).toBe(true);
  });

  it("styleHashes is a readonly array", () => {
    expect(Array.isArray(styleHashes)).toBe(true);
  });

  it("every scriptHash matches sha256-<43-char-base64>= format", () => {
    for (const h of scriptHashes) expect(h).toMatch(SHA256_B64);
  });

  it("every styleHash matches sha256-<43-char-base64>= format", () => {
    for (const h of styleHashes) expect(h).toMatch(SHA256_B64);
  });
});
