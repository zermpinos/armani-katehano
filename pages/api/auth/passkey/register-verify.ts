import { requireAuth }              from "@/server/auth/middleware/require-admin";
import { securityHeaders }          from "@/server/security/edge";
import {
  consumeChallenge,
  verifyRegistrationResp,
}                                   from "@/server/auth/passkey";
import { auditLog }                 from "@/server/security/node";
import prisma                       from "@/server/db/client";

const CHALLENGE_ID_RE = /^[0-9a-f]{64}$/;

async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { challengeId, label: rawLabel, response } = req.body ?? {};

  if (typeof challengeId !== "string" || !CHALLENGE_ID_RE.test(challengeId)) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
  if (!label || label.length > 100) {
    return res.status(400).json({ error: "Label must be 1-100 characters" });
  }

  const challenge = await consumeChallenge(challengeId);
  if (!challenge) {
    return res.status(400).json({ error: "Registration session expired, please try again" });
  }

  let verification: Awaited<ReturnType<typeof verifyRegistrationResp>>;
  try {
    verification = await verifyRegistrationResp(response, challenge);
  } catch {
    return res.status(400).json({ error: "Registration verification failed" });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: "Registration verification failed" });
  }

  const { id: credentialId, publicKey, counter, transports } =
    verification.registrationInfo.credential;

  const username = req.adminUser as string;

  let row: { id: string; label: string; createdAt: Date };
  try {
    row = await prisma.passkeyCredential.create({
      data: {
        credentialId,
        publicKey:  Buffer.from(publicKey),
        counter,
        transports: transports ?? [],
        username,
        label,
      },
      select: { id: true, label: true, createdAt: true },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "This authenticator is already registered" });
    }
    throw err;
  }

  auditLog("passkey_register", {
    username,
    label,
    credentialId: credentialId.slice(0, 8),
  });

  return res.status(200).json({ ok: true, id: row.id, label, createdAt: row.createdAt });
}

export default requireAuth(handler);
