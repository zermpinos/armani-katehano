/**
 * lib/email.ts
 *
 * Nodemailer + Gmail wrapper for roster announcement emails.
 *
 * Env vars required:
 *   GMAIL_USER         -- the Gmail address used to send (e.g. teamak2526@gmail.com)
 *   GMAIL_APP_PASSWORD -- 16-char Google App Password (not your Gmail login password)
 *                        Generate at: myaccount.google.com -> Security -> App Passwords
 *   NEXT_PUBLIC_APP_URL -- your Vercel URL, e.g. https://armani-katehano.vercel.app
 */

import nodemailer from "nodemailer";
import { auditLog } from "./security";

interface PlayerSlot {
  name:   string;
  number: number;
  note:   string | null;
}

interface Game {
  opponent:     string;
  scheduledFor: string; // ISO string
  location:     string;
  competition:  string | null;
}

interface Subscriber {
  email: string;
  token: string;
}

interface SendRosterAnnouncementParams {
  game:        Game;
  players:     PlayerSlot[];
  message?:    string | null;
  subscribers: Subscriber[];
}

function buildBody(
  game: Game,
  players: PlayerSlot[],
  message: string | null | undefined,
  unsubscribeUrl: string,
): string {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const dateStr = new Date(game.scheduledFor).toLocaleString("el-GR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens",
  });
  const venue = game.location === "home" ? "Home game" : "Away game";
  const comp  = game.competition ? `\nCompetition: ${game.competition}` : "";

  const rosterLines = players
    .sort((a, b) => a.number - b.number)
    .map(p => {
      const note = p.note ? ` [${p.note}]` : "";
      return `  #${p.number} ${p.name}${note}`;
    })
    .join("\n");

  const coachMsg = message
    ? `\nCoach's message:\n"${message.replace(/[\x00-\x1F\x7F]/g, "").slice(0, 1000)}"\n`
    : "";

  return [
    `Armani Katehano -- Roster Announcement`,
    ``,
    `${venue}: ${game.location === "home" ? "vs" : "@"} ${game.opponent}`,
    `Date: ${dateStr}${comp}`,
    ``,
    `Roster (${players.length} players):`,
    rosterLines,
    coachMsg,
    `---`,
    `View schedule and stats: ${appUrl}`,
    ``,
    `To unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
}

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendRosterAnnouncement({
  game,
  players,
  message,
  subscribers,
}: SendRosterAnnouncementParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] GMAIL_USER or GMAIL_APP_PASSWORD not set -- skipping email send");
    return;
  }
  if (subscribers.length === 0) return;

  const from    = `Armani Katehano <${process.env.GMAIL_USER}>`;
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const subject = `Roster Announced: ${game.location === "home" ? "vs" : "@"} ${game.opponent}`;

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${sub.token}`;
    const text = buildBody(game, players, message, unsubscribeUrl);
    try {
      await transport.sendMail({ from, to: sub.email, subject, text });
      sent++;
    } catch (err) {
      failed++;
      auditLog("roster_email_failed", { email: sub.email, error: (err as any).message });
    }
  }

  auditLog("roster_emails_sent", { sent, failed, opponent: game.opponent });
}
