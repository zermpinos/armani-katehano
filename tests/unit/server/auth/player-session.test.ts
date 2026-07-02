import { describe, it, expect, beforeEach } from "vitest";
import {
  buildPlayerSessionCookie,
  verifyPlayerSession,
  clearPlayerSessionCookie,
} from "@/server/auth/player";

beforeEach(() => {
  process.env.PLAYER_SESSION_SECRET = "0".repeat(96);
});

describe("player session", () => {
  it("round-trips a payload", () => {
    const payload = JSON.stringify({ role: "player", playerId: "p_1", ts: 1_700_000_000_000 });
    const cookie = buildPlayerSessionCookie(payload);
    const value = cookie.split(";")[0].split("=")[1];
    expect(verifyPlayerSession(value)).toBe(payload);
  });

  it("rejects tampered signatures", () => {
    const cookie = buildPlayerSessionCookie(JSON.stringify({ role: "player", playerId: "p_1", ts: 1 }));
    const value = cookie.split(";")[0].split("=")[1];
    const tampered = value.slice(0, -3) + "AAA";
    expect(verifyPlayerSession(tampered)).toBeNull();
  });

  it("clear cookie has Max-Age=0", () => {
    expect(clearPlayerSessionCookie()).toContain("Max-Age=0");
  });
});
