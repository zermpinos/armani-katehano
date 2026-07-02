import "@/server/_internal/node-only";
import { securityHeaders } from "@/server/security/edge/headers";
import { auditLog } from "@/server/security/node/audit-log";
import { csrfCheck, csrfTokenCheck } from "@/server/auth/csrf";
import { getClientIp } from "@/server/security/node/client-ip";
import {
  getPlayerSessionToken,
  verifyPlayerSession,
  PLAYER_SESSION_TTL_S,
} from "@/server/auth/player";

// note: no server-side session version registry. Add if forced logout across all devices ever becomes a requirement.
export function requirePlayerAuth(handler: (req: any, res: any) => any) {
  return async function (req: any, res: any) {
    Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
    const ip = getClientIp(req);

    if (!csrfCheck(req, { strict: true })) {
      auditLog("player_csrf_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!csrfTokenCheck(req)) {
      auditLog("player_csrf_token_blocked", { ip, path: req.url, method: req.method });
      return res.status(403).json({ error: "Forbidden" });
    }

    const raw = getPlayerSessionToken(req);
    const payload = verifyPlayerSession(raw);
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    let parsed: any;
    try { parsed = JSON.parse(payload); }
    catch { return res.status(401).json({ error: "Invalid session" }); }

    if (parsed?.role !== "player" || typeof parsed?.playerId !== "string") {
      auditLog("player_wrong_role", { ip, role: parsed?.role });
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!parsed?.ts || Date.now() - parsed.ts > PLAYER_SESSION_TTL_S * 1000) {
      return res.status(401).json({ error: "Session expired" });
    }

    (req as any).playerId = parsed.playerId as string;
    return handler(req, res);
  };
}
