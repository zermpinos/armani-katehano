/**
 * Renders the subscription-confirmation email.
 *
 * Default mode:
 *   npx tsx scripts/preview-confirmation-email.ts
 *     Writes /tmp/ak-confirmation-preview.{html,txt}. No mail sent.
 *
 * Test-send mode:
 *   npx tsx scripts/preview-confirmation-email.ts --to=<email>
 *     Delivers the rendered confirmation to that one address for visual QA.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { sendConfirmationTestEmail } from "@/server/integrations/email/client";
import {
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
} from "@/server/integrations/email/templates/confirmation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_OUT    = "/tmp/ak-confirmation-preview.html";
const TEXT_OUT    = "/tmp/ak-confirmation-preview.txt";
const USAGE       = "Usage: npx tsx scripts/preview-confirmation-email.ts [--to=<email>]";

function parseTo(argv: string[]): string | null {
  let to: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--to=")) {
      const email = arg.slice("--to=".length);
      if (!EMAIL_REGEX.test(email)) { console.error(`Invalid email: ${email}`); process.exit(1); }
      to = email;
    } else {
      console.error(`Unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(1);
    }
  }
  return to;
}

async function main(): Promise<void> {
  const to     = parseTo(process.argv.slice(2));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://armani-katehano.com";
  const confirmUrl = `${appUrl}/api/confirm?token=PREVIEW_TOKEN`;

  const html = buildConfirmationEmailHtml(confirmUrl, appUrl);
  const text = buildConfirmationEmailText(confirmUrl, appUrl);

  writeFileSync(HTML_OUT, html, "utf8");
  writeFileSync(TEXT_OUT, text, "utf8");

  console.log(`HTML ->  ${HTML_OUT}`);
  console.log(`TEXT ->  ${TEXT_OUT}`);

  if (to) {
    console.log(`Sending test email to ${to}...`);
    try {
      await sendConfirmationTestEmail({ to });
      console.log(`Test send to ${to} dispatched.`);
    } catch (err: unknown) {
      console.error(`Test send failed: ${(err as Error).message}`);
      process.exit(2);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
