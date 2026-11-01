import { getClientIp, auditLog }            from "@/server/security/node";
import { atomicRecordAndCheck }              from "@/server/auth/login-attempts";
import { validateAdminSlug }                 from "@/server/auth/admin-slug";
import { generateAuthOpts, issueChallenge }  from "@/server/auth/passkey";
import { securityHeaders }                   from "@/server/security/edge";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Before any write, so a caller without the admin URL adds no rows.
  if (!(await validateAdminSlug(req.body?.slug))) {
    return res.status(404).json({ error: "Not found" });
  }

  const ip = getClientIp(req);

  const { locked } = await atomicRecordAndCheck(`pk:${ip}`, 30, 60);
  if (locked) {
    return res.status(429).json({ error: "Too many requests", retryAfter: 60 });
  }

  await auditLog("passkey_challenge_issued", { ip });

  const options     = await generateAuthOpts();
  const challengeId = await issueChallenge(options.challenge);

  return res.status(200).json({ options, challengeId });
}
