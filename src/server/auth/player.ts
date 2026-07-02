import "@/server/_internal/node-only";
import crypto from "node:crypto";

const PLAYER_COOKIE = "__Host-ak_player";
export const PLAYER_SESSION_TTL_S = 4 * 60 * 60;

function secret(): string {
  const s = process.env.PLAYER_SESSION_SECRET;
  if (!s || s.length < 48) throw new Error("PLAYER_SESSION_SECRET missing or too short");
  return s;
}

export function signPlayerSession(payload: string): string {
  const data = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPlayerSession(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return null;
  const data = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch { return null; }
  return Buffer.from(data, "base64url").toString("utf8");
}

export function getPlayerSessionToken(req: any): string {
  // eslint-disable-next-line security/detect-object-injection
  return req.cookies?.[PLAYER_COOKIE] ?? "";
}

export function buildPlayerSessionCookie(payload: string): string {
  const value = signPlayerSession(payload);
  return [
    `${PLAYER_COOKIE}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${PLAYER_SESSION_TTL_S}`,
  ].join("; ");
}

export function clearPlayerSessionCookie(): string {
  return `${PLAYER_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
