import { describe, it, expect } from "vitest";
import {
  buildImportHeartbeat,
  type HeartbeatPayload,
  type HeartbeatRun,
} from "@/server/integrations/email/templates/import-heartbeat";

const WINDOW_START = new Date("2026-04-24T05:05:00Z");
const WINDOW_END   = new Date("2026-05-01T05:05:00Z");

function basePayload(overrides: Partial<HeartbeatPayload> = {}): HeartbeatPayload {
  return {
    windowStart:    WINDOW_START,
    windowEnd:      WINDOW_END,
    runs:           [],
    inWindow:       [],
    dropouts:       [],
    upcomingNext7d: [],
    ...overrides,
  };
}

function okRun(startedAt: Date): HeartbeatRun {
  return { startedAt, ok: true, summary: { candidates: 1, imported: 1 }, error: null };
}

function failRun(startedAt: Date, error: string): HeartbeatRun {
  return { startedAt, ok: false, summary: null, error };
}

describe("buildImportHeartbeat -- runs section", () => {
  it("renders the empty-runs copy when there are no runs", () => {
    const { html, text, subject } = buildImportHeartbeat(basePayload());
    expect(subject).toBe("Auto-import heartbeat -- 0/0 OK");
    expect(html).toContain("no runs in the last 24 h");
    expect(text).toContain("no runs in the last 24 h");
    expect(html).not.toContain("<table");
  });

  it("collapses to a single summary line when all runs are OK", () => {
    const runs = Array.from({ length: 15 }, (_, i) =>
      okRun(new Date(WINDOW_END.getTime() - (15 - i) * 3600_000)),
    );
    const { html, text, subject } = buildImportHeartbeat(basePayload({ runs }));

    expect(subject).toBe("Auto-import heartbeat -- 15/15 OK");

    expect(html).toContain("All 15 runs OK · last at");
    expect(text).toContain("All 15 runs OK · last at");

    // No per-run table; no failure rows
    expect(html).not.toMatch(/<th[^>]*>When<\/th>/);
    expect(html).not.toContain(">FAIL<");
    expect(text).not.toContain(" · FAIL · ");
  });

  it("renders only failed rows plus an 'other runs OK' tail when there is a mix", () => {
    const runs: HeartbeatRun[] = [
      okRun(new Date(WINDOW_END.getTime() - 5 * 3600_000)),
      failRun(new Date(WINDOW_END.getTime() - 4 * 3600_000), "upstream 429"),
      okRun(new Date(WINDOW_END.getTime() - 3 * 3600_000)),
      okRun(new Date(WINDOW_END.getTime() - 2 * 3600_000)),
      okRun(new Date(WINDOW_END.getTime() - 1 * 3600_000)),
    ];
    const { html, text, subject } = buildImportHeartbeat(basePayload({ runs }));

    expect(subject).toBe("Auto-import heartbeat -- 4/5 OK");

    // Failure row is in the table
    expect(html).toContain(">FAIL<");
    expect(html).toContain("upstream 429");
    expect(text).toContain(" · FAIL · upstream 429");

    // Trailing line summarizes the OK runs
    expect(html).toContain("+4 other runs OK");
    expect(text).toContain("+4 other runs OK");

    // Only one row in the runs table (the failure), not five
    const runRowCount = (html.match(/border-top:1px solid #e5e7eb;font-size:12px;color:#15803d/g) ?? []).length
                     + (html.match(/border-top:1px solid #e5e7eb;font-size:12px;color:#c92a2a/g) ?? []).length;
    expect(runRowCount).toBe(1);
  });

  it("uses singular 'run' in the trailing line when exactly one other run is OK", () => {
    const runs: HeartbeatRun[] = [
      failRun(new Date(WINDOW_END.getTime() - 2 * 3600_000), "boom"),
      okRun(new Date(WINDOW_END.getTime() - 1 * 3600_000)),
    ];
    const { html, text } = buildImportHeartbeat(basePayload({ runs }));
    expect(html).toContain("+1 other run OK");
    expect(text).toContain("+1 other run OK");
    expect(html).not.toContain("+1 other runs OK");
  });

  it("does not append the trailing line when every run failed", () => {
    const runs: HeartbeatRun[] = [
      failRun(new Date(WINDOW_END.getTime() - 2 * 3600_000), "a"),
      failRun(new Date(WINDOW_END.getTime() - 1 * 3600_000), "b"),
    ];
    const { html, text, subject } = buildImportHeartbeat(basePayload({ runs }));
    expect(subject).toBe("Auto-import heartbeat -- 0/2 OK");
    expect(html).not.toContain("other run");
    expect(text).not.toContain("other run");
  });

  it("appends the dropout suffix to the subject when dropouts are present", () => {
    const runs = [okRun(new Date(WINDOW_END.getTime() - 3600_000))];
    const dropouts = [{
      opponent:     "AEK",
      scheduledFor: new Date(WINDOW_END.getTime() - 10 * 24 * 3600_000),
      hasListing:   false,
      jobState:     null,
      attempts:     0,
      lastError:    null,
    }];
    const { subject } = buildImportHeartbeat(basePayload({ runs, dropouts }));
    expect(subject).toBe("Auto-import heartbeat -- 1/1 OK · 1 DROPOUT(s)");
  });
});
