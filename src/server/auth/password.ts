import "@/server/_internal/node-only";
import bcrypt from "bcryptjs";

export const LOCKOUT_TTL_S      = 60 * 15;
export const MAX_LOGIN_ATTEMPTS = 5;
export const CAPTCHA_THRESHOLD  = 3;

export async function verifyPassword(plaintext: string) {
  const hash = process.env.ADMIN_PASSWORD;
  if (!hash) { console.error("[security] ADMIN_PASSWORD is not set"); return false; }
  if (!hash.startsWith("$2b$") && !hash.startsWith("$2a$")) {
    console.error("[security] ADMIN_PASSWORD is not a bcrypt hash.");
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

export async function verifyCredentials(username: string, plaintext: string): Promise<boolean> {
  const usersJson = process.env.ADMIN_USERS;
  if (usersJson) {
    let users: { username: string; passwordHash: string }[];
    try { users = JSON.parse(usersJson); } catch {
      console.error("[security] ADMIN_USERS is not valid JSON");
      return false;
    }
    const user = users.find(u => u.username === username);
    if (!user) return false;
    if (!user.passwordHash.startsWith("$2b$") && !user.passwordHash.startsWith("$2a$")) {
      console.error(`[security] passwordHash for "${username}" is not a bcrypt hash`);
      return false;
    }
    return bcrypt.compare(plaintext, user.passwordHash);
  }
  if (username !== "admin") return false;
  return verifyPassword(plaintext);
}

export type AdminUser = { username: string; passwordHash: string; totpSecret?: string };

export function getAdminUser(username: string): AdminUser | null {
  const usersJson = process.env.ADMIN_USERS;
  if (usersJson) {
    try {
      const users: AdminUser[] = JSON.parse(usersJson);
      return users.find(u => u.username === username) ?? null;
    } catch { return null; }
  }
  if (username !== "admin") return null;
  const hash = process.env.ADMIN_PASSWORD;
  return hash ? { username: "admin", passwordHash: hash } : null;
}

export async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[captcha] TURNSTILE_SECRET_KEY not set — denying CAPTCHA");
    return false;
  }
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await res.json();
  return data.success === true;
}
