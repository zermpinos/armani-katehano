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
// Blocks carry buttons; text stays the notification and the fallback for any
// client that cannot render them.
export async function sendSlackAlert(text: string, blocks?: unknown[]): Promise<boolean> {
  const url = webhook();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(blocks ? { text, blocks } : { text }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    if (!res.ok) {
      auditLog("slack_alert_failed", { status: res.status });
      return false;
    }
    return true;
  } catch (err: any) {
    auditLog("slack_alert_failed", { error: scrub(err?.message) });
    return false;
  }
}

export function slackConfigured(): boolean {
  return webhook() !== null;
}

// Slack reads these three characters as markup, and a team name is scraped
// text we did not write.
function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface AliasPrompt {
  scrapedName: string;
  suggestion:  string;
  dateText:    string;
}

// Asks for a name the alias table does not cover. Confirm writes it and the
// next run publishes the fixture; reject leaves it off the site. The buttons
// carry the pair, and the endpoint revalidates it before writing.
export async function sendAliasPrompt(entries: AliasPrompt[]): Promise<boolean> {
  if (entries.length === 0) return false;

  const blocks = entries.flatMap(e => {
    const value = JSON.stringify({ scrapedName: e.scrapedName, displayName: e.suggestion });
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Fixture not published: *${escapeMrkdwn(e.scrapedName)}* on ${escapeMrkdwn(e.dateText)} has no name set.\nSuggested: *${escapeMrkdwn(e.suggestion)}*`,
        },
      },
      {
        type: "actions",
        elements: [
          { type: "button", action_id: "alias_confirm", style: "primary",
            text: { type: "plain_text", text: "Confirm" }, value },
          { type: "button", action_id: "alias_reject",
            text: { type: "plain_text", text: "Reject" }, value },
        ],
      },
    ];
  });

  const text = `${entries.length} fixture${entries.length > 1 ? "s" : ""} waiting on an opponent name`;
  return sendSlackAlert(text, blocks);
}
