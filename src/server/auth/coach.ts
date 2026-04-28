import "@/server/_internal/node-only";
import crypto from "node:crypto";
import bcrypt  from "bcryptjs";
import prisma  from "@/server/db/client";

const COACH_COOKIE = "__Host-ak_coach";
export const COACH_SESSION_TTL_S = 4 * 60 * 60;

function signCoachSession(payload: string): string {
  const secret = process.env.COACH_SESSION_SECRET;
  if (!secret) throw new Error("COACH_SESSION_SECRET is not set");
  const data = Buffer.from(payload).toString("base64url");
  const sig  = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyCoachSessionHmac(cookieValue: string | null | undefined): string | null {
  const secret = process.env.COACH_SESSION_SECRET;
  if (!secret || !cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return null;
  const data = cookieValue.slice(0, lastDot);
  const sig  = cookieValue.slice(lastDot + 1);
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig,      "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch { return null; }
  return Buffer.from(data, "base64url").toString("utf8");
}

export function getCoachSessionToken(req: any): string {
  // eslint-disable-next-line security/detect-object-injection
  return req.cookies?.[COACH_COOKIE] ?? "";
}

export function verifyCoachSession(cookieValue: string): string | null {
  return verifyCoachSessionHmac(cookieValue);
}

export function buildCoachSessionCookie(payload: string): string {
  const value = signCoachSession(payload);
  return [
    `${COACH_COOKIE}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COACH_SESSION_TTL_S}`,
  ].join("; ");
}

export function clearCoachSessionCookie(): string {
  return `${COACH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

const SESSION_VERSION_KEY = "coach_session_version";

export async function getCoachSessionVersion(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SESSION_VERSION_KEY } });
    return setting ? parseInt(setting.value, 10) || 0 : 0;
  } catch { return 0; }
}

export async function incrementCoachSessionVersion(): Promise<void> {
  const current = await getCoachSessionVersion();
  await prisma.setting.upsert({
    where:  { key: SESSION_VERSION_KEY },
    update: { value: String(current + 1) },
    create: { key: SESSION_VERSION_KEY, value: String(current + 1) },
  });
}

export async function verifyCoachPassword(plaintext: string): Promise<boolean> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "coach_password_hash" } });
    if (setting?.value && (setting.value.startsWith("$2b$") || setting.value.startsWith("$2a$"))) {
      return bcrypt.compare(plaintext, setting.value);
    }
  } catch { /* fall through to env var */ }
  const hash = process.env.COACH_PASSWORD;
  if (!hash) { console.error("[coachAuth] COACH_PASSWORD is not set and no DB password found"); return false; }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) { console.error("[coachAuth] COACH_PASSWORD is not a bcrypt hash"); return false; }
  return bcrypt.compare(plaintext, hash);
}

export async function setCoachPasswordHash(hash: string): Promise<void> {
  await prisma.setting.upsert({
    where:  { key: "coach_password_hash" },
    update: { value: hash },
    create: { key: "coach_password_hash", value: hash },
  });
}

export function isValidCoachToken(token: string): boolean {
  const expected = process.env.COACH_TOKEN;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token,    "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
