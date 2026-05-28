import { requireAuth }                         from "@/server/auth/middleware/require-admin";
import { securityHeaders }                     from "@/server/security/edge";
import {
  generateRegistrationOpts,
  issueChallenge,
}                                              from "@/server/auth/passkey";
import prisma                                  from "@/server/db/client";

async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = req.adminUser as string;

  const existing = await prisma.passkeyCredential.findMany({
    where:  { username },
    select: { credentialId: true, transports: true },
  });

  const options     = await generateRegistrationOpts(username, existing);
  const challengeId = await issueChallenge(options.challenge);

  return res.status(200).json({ options, challengeId });
}

export default requireAuth(handler);
