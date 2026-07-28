// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import { sendSlackAlert, slackConfigured } from "@/server/integrations/slack/client";
import { auditLog } from "@/server/security/node/audit-log";

const HOOK = "https://hooks.slack.com/services/T000/B000/xxxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SLACK_WEBHOOK_URL = HOOK;
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => { delete process.env.SLACK_WEBHOOK_URL; });

describe("sendSlackAlert", () => {
  it("posts the alert text as json", async () => {
    expect(await sendSlackAlert("Import Poll Stuck")).toBe(true);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toBe(HOOK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "Import Poll Stuck" });
  });

  it("reports not-sent when no webhook is configured", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    expect(await sendSlackAlert("x")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // Alerts name source URLs and failure reasons. A swapped or mistyped variable
  // must not be able to post them somewhere that is not Slack.
  it.each([
    ["a different host",  "https://evil.example.com/services/T000/B000/x"],
    ["plain http",        "http://hooks.slack.com/services/T000/B000/x"],
    ["a lookalike host",  "https://hooks.slack.com.evil.example.com/x"],
    ["nonsense",          "not-a-url"],
  ])("refuses to post to %s", async (_label, value) => {
    process.env.SLACK_WEBHOOK_URL = value;
    expect(await sendSlackAlert("secret detail")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("reports not-sent when Slack rejects the post", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await sendSlackAlert("x")).toBe(false);
  });

  it("reports not-sent when the request throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("timed out"));
    expect(await sendSlackAlert("x")).toBe(false);
  });

  // The URL is a bearer credential, so it must never reach the audit trail.
  it("keeps the webhook url out of the audit log on failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error(`connect ${HOOK} refused`));
    await sendSlackAlert("x");
    expect(JSON.stringify(auditLog.mock.calls)).not.toContain("xxxxxxxx");
  });

  it("reports whether a usable webhook is configured", () => {
    expect(slackConfigured()).toBe(true);
    process.env.SLACK_WEBHOOK_URL = "https://evil.example.com/x";
    expect(slackConfigured()).toBe(false);
  });
});
