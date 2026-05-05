import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

// GDPR Art. 5(1)(e): unconfirmed sign-ups that were never acted on have no
// legitimate basis for retention. Purge after 7 days.
const UNCONFIRMED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function purgeUnconfirmedSubscribers(): Promise<number> {
  const cutoff = new Date(Date.now() - UNCONFIRMED_TTL_MS);
  const result = await prisma.subscriber.deleteMany({
    where: { confirmedAt: null, createdAt: { lt: cutoff } },
  });
  return result.count;
}
