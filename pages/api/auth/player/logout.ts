import { clearPlayerSessionCookie } from "@/server/auth/player";
import { csrfCheck } from "@/server/auth/csrf";
import { securityHeaders } from "@/server/security/edge/headers";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!csrfCheck(req, { strict: true })) return res.status(403).json({ error: "Forbidden" });
  res.setHeader("Set-Cookie", clearPlayerSessionCookie());
  return res.status(200).json({ ok: true });
}
