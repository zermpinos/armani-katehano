import { getClientIp }                       from "@/server/security/node";
import { auditLog }                          from "@/server/security/node";
import { securityHeaders }                   from "@/server/security/edge";
import {
  consumeChallenge,
  verifyAuthResp,
}                                            from "@/server/auth/passkey";
import { getAdminUser }                      from "@/server/auth/password";
import { buildSessionCookie }                from "@/server/auth/session";
import { generateCsrfToken, buildCsrfCookie } from "@/server/auth/csrf";
import prisma                                from "@/server/db/client";

// base64url: no padding, URL-safe chars only, at least 4 chars
const CRED_ID_RE = /^[A-Za-z0-9_-]{4,1364}$/;
// challengeId: 64 lowercase hex chars (32 random bytes)
const CHALLENGE_ID_RE = /^[0-9a-f]{64}$/;

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);

  const { challengeId, response } = req.body ?? {};
  if (typeof challengeId !== "string" || !CHALLENGE_ID_RE.test(challengeId)) {
    return res.status(401).json({ error: "Authentication failed" });
  }
  const credentialId = response?.id;
  if (typeof credentialId !== "string" || !CRED_ID_RE.test(credentialId)) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  const challenge = await consumeChallenge(challengeId);
  if (!challenge) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  const credential = await prisma.passkeyCredential.findUnique({
    where: { credentialId },
  });
  if (!credential) {
    auditLog("login_passkey_failed", { ip, reason: "credential_not_found" });
    return res.status(401).json({ error: "Authentication failed" });
  }

  if (!getAdminUser(credential.username)) {
    auditLog("passkey_orphan_rejected", { ip, username: credential.username });
    return res.status(401).json({ error: "Authentication failed" });
  }

  let verification: Awaited<ReturnType<typeof verifyAuthResp>>;
  try {
    verification = await verifyAuthResp(response, challenge, credential as any);
  } catch {
    auditLog("login_passkey_failed", { ip, reason: "verify_threw" });
    return res.status(401).json({ error: "Authentication failed" });
  }

  if (!verification.verified) {
    auditLog("login_passkey_failed", { ip, reason: "assertion_invalid" });
    return res.status(401).json({ error: "Authentication failed" });
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? credential.counter;

  const updated = await prisma.$executeRaw`
    UPDATE "PasskeyCredential"
    SET counter = ${newCounter}, "lastUsedAt" = now()
    WHERE id = ${credential.id} AND counter = ${credential.counter}
  `;

  if (updated === 0) {
    auditLog("passkey_clone_suspected", {
      ip,
      credentialId: credentialId.slice(0, 8),
      username:     credential.username,
    });
    return res.status(401).json({ error: "Authentication failed" });
  }

  auditLog("login_passkey_success", {
    ip,
    credentialId: credentialId.slice(0, 8),
    username:     credential.username,
  });

  const payload = JSON.stringify({
    ts:   Date.now(),
    role: "admin",
    user: credential.username,
  });

  res.setHeader("Set-Cookie", [
    buildSessionCookie(payload),
    buildCsrfCookie(generateCsrfToken()),
  ]);

  return res.status(200).json({ ok: true });
}
