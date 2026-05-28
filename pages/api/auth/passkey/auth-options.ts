import { getClientIp, auditLog }            from "@/server/security/node";
import { atomicRecordAndCheck }              from "@/server/auth/login-attempts";
import { generateAuthOpts, issueChallenge }  from "@/server/auth/passkey";
import { securityHeaders }                   from "@/server/security/edge";
import crypto                                from "node:crypto";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);

  const { locked } = await atomicRecordAndCheck(`pk:${ip}`, 30, 60);
  if (locked) {
    return res.status(429).json({ error: "Too many requests", retryAfter: 60 });
  }

  auditLog("passkey_challenge_issued", { ip: crypto.createHash("sha256").update(ip).digest("hex") });

  const options     = await generateAuthOpts();
  const challengeId = await issueChallenge(options.challenge);

  return res.status(200).json({ options, challengeId });
}
