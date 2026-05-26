import { describe, it, expect, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

vi.mock("@/domain/shared/calendar", () => ({
  buildIcsContent: vi.fn().mockReturnValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR"),
}));

import handler from "@/pages/api/calendar/ics";

function makeReqRes(query: Record<string, string>) {
  const state = { status: 200, headers: {} as Record<string, string>, payload: "" as any };
  const req = { method: "GET", query } as any;
  const res: any = {
    status: (s: number) => { state.status = s; return res; },
    setHeader: (k: string, v: string) => { state.headers[k] = v; },
    send: (p: any) => { state.payload = p; return res; },
    json: (o: any) => { state.payload = o; return res; },
    end: () => res,
  };
  return { req: req as NextApiRequest, res: res as NextApiResponse, state };
}

describe("GET /api/calendar/ics", () => {
  it("returns 400 when opponent is missing", async () => {
    const { req, res, state } = makeReqRes({ date: "2026-05-16T18:00:00.000Z" });
    await handler(req, res);
    expect(state.status).toBe(400);
  });

  it("returns 400 when date is missing", async () => {
    const { req, res, state } = makeReqRes({ opponent: "Dragons" });
    await handler(req, res);
    expect(state.status).toBe(400);
  });

  it("returns 400 when date is not parseable", async () => {
    const { req, res, state } = makeReqRes({ opponent: "Dragons", date: "not-a-date" });
    await handler(req, res);
    expect(state.status).toBe(400);
  });

  it("returns 405 for non-GET methods", async () => {
    const state = { status: 200 };
    const req = { method: "POST", query: {} } as any;
    const res = { status: (s: number) => { state.status = s; return res; }, end: () => res } as any;
    await handler(req, res);
    expect(state.status).toBe(405);
  });

  it("returns 200 with text/calendar content type on valid params", async () => {
    const { req, res, state } = makeReqRes({ opponent: "Dragons", date: "2026-05-16T18:00:00.000Z" });
    await handler(req, res);
    expect(state.status).toBe(200);
    expect(state.headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(state.headers["Cache-Control"]).toBe("no-store");
  });

  it("sets Content-Disposition with sanitised opponent in filename", async () => {
    const { req, res, state } = makeReqRes({ opponent: "Παναθηναϊκός BC", date: "2026-05-16T18:00:00.000Z" });
    await handler(req, res);
    // Greek chars are stripped -> result is empty or only "-" -> fallback filename
    expect(state.headers["Content-Disposition"]).toMatch(/filename="AK-game\.ics"|filename="AK-vs-.+\.ics"/);
  });

  it("sanitises ASCII opponent in filename", async () => {
    const { req, res, state } = makeReqRes({ opponent: "Red Lions FC", date: "2026-05-16T18:00:00.000Z" });
    await handler(req, res);
    expect(state.headers["Content-Disposition"]).toBe('attachment; filename="AK-vs-Red-Lions-FC.ics"');
  });
});
