import type { NextApiRequest, NextApiResponse } from "next";
import { buildIcsContent } from "@/domain/shared/calendar";
import { securityHeaders } from "@/server/security/edge";

function sanitizeFilename(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.length > 0 ? cleaned : "AK-game";
}

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  // securityHeaders() already carries Cache-Control: no-store, which is what a
  // per-request .ics build wants.
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const { opponent, date, location, venue } = req.query;

  if (!opponent || !date || typeof opponent !== "string" || typeof date !== "string") {
    res.status(400).json({ error: "opponent and date are required" });
    return;
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: "invalid date" });
    return;
  }

  const opponentStr = opponent.slice(0, 200).trim();
  const venueStr    = typeof venue === "string" ? venue.slice(0, 200).trim() : undefined;

  void location;

  const icsContent = buildIcsContent(opponentStr, parsedDate.toISOString(), venueStr);
  const filename   = `AK-vs-${sanitizeFilename(opponentStr)}.ics`;

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(icsContent);
}
