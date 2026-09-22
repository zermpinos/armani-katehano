import "@/server/_internal/node-only";
import { auditLog } from "@/server/security/node/audit-log";

const TIMEOUT_MS = 5_000;

// An incoming webhook URL is a bearer credential: anyone holding it can post as
// the app. It is read from the environment, never logged, and never surfaced in
// an audit entry or an error message.
const WEBHOOK_HOST = "hooks.slack.com";

function webhook(): URL | null {
  const raw = process.env.SLACK_WEBHOOK_URL;
  if (!raw) return null;

  let url: URL;
  try { url = new URL(raw); } catch { return null; }

  // Pinning the host keeps a mistyped or swapped variable from posting alert
  // contents, which name source URLs and failures, to somewhere else entirely.
  if (url.protocol !== "https:" || url.hostname !== WEBHOOK_HOST) return null;
  return url;
}

// fetch puts the request URL into its error message, and for a webhook that URL
// is the credential. Anything derived from a failure is scrubbed before it can
// reach the audit trail, which is persisted.
function scrub(message: unknown): string {
  return String(message ?? "unknown")
    .replace(/https:\/\/hooks\.slack\.com\/\S*/gi, "[webhook]");
}

// Returns whether Slack accepted the message, so the caller can fall back to
// email rather than dropping an alert when Slack is unset or unreachable.
export async function sendSlackAlert(text: string): Promise<boolean> {
  const url = webhook();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    if (!res.ok) {
      await auditLog("slack_alert_failed", { status: res.status });
      return false;
    }
    return true;
  } catch (err: any) {
    await auditLog("slack_alert_failed", { error: scrub(err?.message) });
    return false;
  }
}

export function slackConfigured(): boolean {
  return webhook() !== null;
}

export interface AliasPrompt {
  scrapedName: string;
  suggestion:  string;
  dateText:    string;
}

// Reports a name the alias table does not cover, with the spelling we would
// suggest. Deliberately not interactive: acting on it needs a write, and this
// app has no endpoint Slack can reach without one that takes writes from the
// public internet.
export async function sendAliasPrompt(entries: AliasPrompt[]): Promise<boolean> {
  if (entries.length === 0) return false;

  const lines = entries.map(e =>
    `- "${e.scrapedName}" on ${e.dateText}, suggested: ${e.suggestion}`);

  return sendSlackAlert(
    [
      `${entries.length} fixture${entries.length > 1 ? "s" : ""} not published: opponent name not set.`,
      ...lines,
      "Add the name in the admin portal to publish it on the next run.",
    ].join("\n"),
  );
}
