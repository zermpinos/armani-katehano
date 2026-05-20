/**
 * scripts/send-courtesy-email.ts
 *
 * One-time courtesy email to existing confirmed subscribers announcing the
 * new post-game recap email category ("game emails"). Sent once, around the
 * 2026-05-19 rollout of the game-imported-email feature.
 *
 * IRREVERSIBLE. Emails cannot be unsent. The interactive SEND prompt and
 * the AuditLog-based idempotency guard are the only safety nets.
 *
 * Recommended workflow:
 *   1. npx tsx scripts/send-courtesy-email.ts --dry-run
 *      Renders /tmp/ak-courtesy-preview.html, prints recipient count + DB host.
 *   2. npx tsx scripts/send-courtesy-email.ts --to=<your-email>
 *      Sends a real email to one address for visual QA. Writes nothing to AuditLog.
 *   3. npx tsx scripts/send-courtesy-email.ts
 *      Full send. Type SEND at the prompt to confirm.
 *
 * Idempotency: refuses to run a full send if a courtesy_emails_summary event
 * already exists in AuditLog. Pass --force to override (you almost never want this).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import prisma from "@/server/db/client";
import { buildCourtesyEmailHtml } from "@/server/integrations/email/templates";
import {
  sendCourtesySubscriberEmail,
  sendCourtesyTestEmail,
} from "@/server/integrations/email/client";

const EMAIL_REGEX  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREVIEW_PATH = "/tmp/ak-courtesy-preview.html";
const USAGE        = "Usage: npx tsx scripts/send-courtesy-email.ts [--dry-run] [--to=<email>] [--force]";

interface Flags {
  dryRun: boolean;
  force:  boolean;
  to:     string | null;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, force: false, to: null };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--force") {
      flags.force = true;
    } else if (arg.startsWith("--to=")) {
      const email = arg.slice("--to=".length);
      if (!EMAIL_REGEX.test(email)) {
        console.error(`Invalid email: ${email}`);
        process.exit(1);
      }
      flags.to = email;
    } else {
      console.error(`Unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(1);
    }
  }
  return flags;
}

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "<DATABASE_URL not set>";
  try {
    return new URL(url).host;
  } catch {
    return "<unparseable>";
  }
}

async function promptSend(count: number, host: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>(resolve => {
    rl.question(
      `About to send to ${count} subscribers in ${host}. Type SEND to dispatch: `,
      answer => {
        rl.close();
        resolve(answer === "SEND");
      },
    );
  });
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  // --to=<email> test send: bypass DB read, idempotency, prompt.
  if (flags.to) {
    console.log(`Sending test email to ${flags.to}...`);
    try {
      await sendCourtesyTestEmail({ to: flags.to });
      console.log(`Test send to ${flags.to} dispatched.`);
      process.exit(0);
    } catch (err: unknown) {
      console.error(`Test send failed: ${(err as Error).message}`);
      process.exit(2);
    }
  }

  const appUrl             = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const privacyUrl         = `${appUrl}/privacy`;
  const previewUnsubscribe = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;
  const previewHtml        = buildCourtesyEmailHtml(previewUnsubscribe, privacyUrl);
  writeFileSync(PREVIEW_PATH, previewHtml, "utf-8");
  console.log(`Preview written to ${PREVIEW_PATH}`);

  const host = dbHost();
  console.log(`Database host: ${host}`);

  const subscribers = await prisma.subscriber.findMany({
    where:  { confirmedAt: { not: null } },
    select: { id: true, email: true, token: true },
  });
  console.log(`Confirmed subscribers: ${subscribers.length}`);

  if (flags.dryRun) {
    console.log("(dry run -- no send, no audit-log writes)");
    process.exit(0);
  }

  // Idempotency guard.
  if (!flags.force) {
    const prior = await prisma.auditLog.findFirst({
      where:   { event: "courtesy_emails_summary" },
      orderBy: { createdAt: "desc" },
    });
    if (prior) {
      const data = prior.data as { total?: number; sent?: number; failed?: number } | null;
      console.error(
        `Already sent on ${prior.createdAt.toISOString()} ` +
        `(total=${data?.total ?? "?"}, sent=${data?.sent ?? "?"}, failed=${data?.failed ?? "?"}).`,
      );
      console.error("Re-run with --force to override.");
      process.exit(1);
    }
  }

  if (flags.force) {
    console.warn("WARNING: --force passed; idempotency guard skipped.");
  }

  const confirmed = await promptSend(subscribers.length, host);
  if (!confirmed) {
    console.log("Aborted.");
    process.exit(0);
  }

  const result = await sendCourtesySubscriberEmail({ subscribers });
  console.log(`Sent: ${result.sent} / Failed: ${result.failed} / Total: ${result.total}`);
  process.exit(result.failed === 0 ? 0 : 2);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
