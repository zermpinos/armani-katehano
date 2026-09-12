import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { sendAdminAlert } from "@/server/integrations/email/client";

const DEBOUNCE_MS  = 15 * 60 * 1000;
const SENT_MARKER  = "security_alert_sent";
const MAX_VALUE_LEN = 120;

// Debounce is keyed on the delivery marker rather than on the event itself: the
// event row is written fire-and-forget by auditLog, so counting those races the
// write and can suppress the very first alert. The marker is awaited here, which
// makes a lockout storm one message instead of forty.
export async function dispatchSecurityAlert(
  event: string,
  data:  Record<string, unknown> = {},
): Promise<boolean> {
  const since = new Date(Date.now() - DEBOUNCE_MS);
  const alreadySent = await prisma.auditLog.count({
    where: {
      event:     SENT_MARKER,
      createdAt: { gt: since },
      data:      { path: ["for"], equals: event },
    },
  });
  if (alreadySent > 0) return false;

  const detail = Object.entries(data)
    .map(([k, v]) => `${k}=${String(v).slice(0, MAX_VALUE_LEN)}`)
    .join(" ");
  const minutes = DEBOUNCE_MS / 60_000;
  const via = await sendAdminAlert(
    `Security alert: ${event}`,
    `${event}\n${detail}\n\nRepeats of this event are suppressed for ${minutes} minutes.`,
  );

  // Written even when delivery failed, so a dead channel is retried on the next
  // window rather than on every request.
  await prisma.auditLog.create({ data: { event: SENT_MARKER, data: { for: event, via } } });
  return via !== "none";
}
