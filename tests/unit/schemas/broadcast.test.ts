import { describe, it, expect } from "vitest";
import { BroadcastSchema, ResolveSchema, PreviewSendSchema } from "@/schemas/broadcast";

describe("ResolveSchema", () => {
  it("accepts valid targetEmails", () => {
    const result = ResolveSchema.safeParse({ mode: "resolve", targetEmails: ["a@b.com"] });
    expect(result.success).toBe(true);
  });
  it("rejects missing targetEmails", () => {
    const result = ResolveSchema.safeParse({ mode: "resolve" });
    expect(result.success).toBe(false);
  });
  it("rejects empty targetEmails array", () => {
    const result = ResolveSchema.safeParse({ mode: "resolve", targetEmails: [] });
    expect(result.success).toBe(false);
  });
  it("rejects more than 500 emails", () => {
    const emails = Array.from({ length: 501 }, (_, i) => `user${i}@example.com`);
    const result = ResolveSchema.safeParse({ mode: "resolve", targetEmails: emails });
    expect(result.success).toBe(false);
  });
  it("rejects invalid email format", () => {
    const result = ResolveSchema.safeParse({ mode: "resolve", targetEmails: ["not-an-email"] });
    expect(result.success).toBe(false);
  });
});

describe("PreviewSendSchema", () => {
  it("accepts valid preview payload", () => {
    const result = PreviewSendSchema.safeParse({ mode: "preview", subject: "Hello", body: "World" });
    expect(result.success).toBe(true);
  });
  it("accepts valid send payload with targetEmails", () => {
    const result = PreviewSendSchema.safeParse({ mode: "send", subject: "Hello", body: "World", targetEmails: ["a@b.com"] });
    expect(result.success).toBe(true);
  });
  it("rejects subject longer than 200 chars", () => {
    const result = PreviewSendSchema.safeParse({ mode: "preview", subject: "x".repeat(201), body: "body" });
    expect(result.success).toBe(false);
  });
  it("rejects body longer than 50000 chars", () => {
    const result = PreviewSendSchema.safeParse({ mode: "send", subject: "Hello", body: "x".repeat(50_001) });
    expect(result.success).toBe(false);
  });
  it("rejects empty subject", () => {
    const result = PreviewSendSchema.safeParse({ mode: "preview", subject: "", body: "body" });
    expect(result.success).toBe(false);
  });
  it("rejects empty body", () => {
    const result = PreviewSendSchema.safeParse({ mode: "preview", subject: "Hi", body: "" });
    expect(result.success).toBe(false);
  });
  it("rejects more than 500 targetEmails", () => {
    const emails = Array.from({ length: 501 }, (_, i) => `user${i}@example.com`);
    const result = PreviewSendSchema.safeParse({ mode: "send", subject: "Hi", body: "body", targetEmails: emails });
    expect(result.success).toBe(false);
  });
});

describe("BroadcastSchema -- discriminated union", () => {
  it("routes mode=resolve to ResolveSchema (no subject/body required)", () => {
    const result = BroadcastSchema.safeParse({ mode: "resolve", targetEmails: ["a@b.com"] });
    expect(result.success).toBe(true);
  });
  it("routes mode=preview to PreviewSendSchema (requires subject/body)", () => {
    const result = BroadcastSchema.safeParse({ mode: "preview" });
    expect(result.success).toBe(false);
  });
  it("rejects unknown mode", () => {
    const result = BroadcastSchema.safeParse({ mode: "nuke", subject: "x", body: "y" });
    expect(result.success).toBe(false);
  });
});
