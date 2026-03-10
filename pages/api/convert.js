/**
 * pages/api/convert.js
 * POST /api/convert  →  { image: "<base64 jpg>", filename: "..." }  →  { data: {...} }
 *
 * Sends the Basket City score sheet image to Claude vision API and returns
 * structured game JSON in the same shape as the old PDF parser output,
 * so the existing buildDraft / confirm flow needs no changes.
 *
 * Protected by:
 *  - Session cookie auth (requireAuth)
 *  - 8 MB image size cap
 *  - Per-IP rate limiting (10 req/min via Upstash KV)
 */

import { Redis }       from "@upstash/redis";
import { requireAuth } from "../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../lib/security.js";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const RATE_LIMIT_RPM  = 10;

const PROMPT = `Extract ARMANI KATEHANO player stats from this Basket City basketball score sheet image.
Return ONLY valid JSON with no markdown, no code fences, no explanation.

Use this exact shape:
{
  "match_info": {
    "date": "DD/MM/YYYY",
    "home_team": "TEAM NAME",
    "away_team": "TEAM NAME",
    "home_score": 0,
    "away_score": 0,
    "competition": "league name from top of sheet",
    "matchday": 0,
    "league": "rookie or bc6 — see rules below",
    "result": "W or L",
    "opponent": "<other team name>",
    "armani_katehano_score": 0,
    "opponent_score": 0
  },
  "armani_katehano": {
    "players": [
      {
        "jersey_number": 0,
        "name_greek": "SURNAME NAME",
        "points": 0,
        "free_throws":     { "made": 0, "attempted": 0 },
        "two_point_fg":    { "made": 0, "attempted": 0 },
        "three_point_fg":  { "made": 0, "attempted": 0 },
        "fouls_made": 0,
        "fouls_earned": 0,
        "offensive_rebounds": 0,
        "defensive_rebounds": 0,
        "total_rebounds": 0,
        "assists": 0,
        "steals": 0,
        "blocks": 0,
        "turnovers": 0,
        "efficiency": 0,
        "minutes_played": { "display": "MM:SS", "total_seconds": 0 },
        "did_not_play": false
      }
    ]
  }
}

Rules:
- Include every player in the ARMANI KATEHANO section, even those who did not play (set did_not_play=true, all stats 0)
- minutes_played.total_seconds = minutes*60 + seconds (e.g. "26:34" → 1594)
- Derive result from scores: if AK score > opponent score then "W", else "L"
- For the "league" field: look at the competition name printed at the top of the score sheet.
  * If it contains words like "ROOKIE", "ΝΕΩΝ", "ΝΕΑΝΙΚΟ" → set league to "rookie"
  * If it contains "BC6", "Β' ΚΑΤΗΓΟΡΙΑ", "B ΚΑΤΗΓΟΡΙΑ", "B6" → set league to "bc6"
  * If unclear → set league to ""`;

async function convertHandler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rlKey = `rl:convert:${ip}:${Math.floor(Date.now() / 60000)}`;
  const count = ((await redis.get(rlKey)) ?? 0) + 1;
  await redis.set(rlKey, count, { ex: 60 });
  if (count > RATE_LIMIT_RPM) {
    auditLog("rate_limited", { ip, count });
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
  }

  // ── Input validation ───────────────────────────────────────────────────────
  const { image: base64, filename = "score_sheet.jpg" } = req.body ?? {};
  if (typeof base64 !== "string" || base64.length === 0)
    return res.status(400).json({ error: "Missing image field" });

  let imgBuffer;
  try { imgBuffer = Buffer.from(base64, "base64"); }
  catch { return res.status(400).json({ error: "Invalid base64 data" }); }

  if (imgBuffer.length > MAX_IMAGE_BYTES)
    return res.status(413).json({ error: "Image exceeds 8 MB limit" });

  const safeFilename = filename.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 128);

  // ── Call Claude vision API ─────────────────────────────────────────────────
  let gameData;
  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text",  text: PROMPT },
          ],
        }],
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Claude API error ${apiRes.status}`);
    }

    const apiData = await apiRes.json();
    const raw = apiData.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    gameData = JSON.parse(raw);
    gameData.match_info.source_file = safeFilename;

    // Normalise the league field — only allow "rookie", "bc6", or ""
    const rawLeague = (gameData.match_info.league || "").toLowerCase().trim();
    gameData.match_info.league = rawLeague === "rookie" || rawLeague === "bc6" ? rawLeague : "";

  } catch (err) {
    auditLog("vision_error", { ip, filename: safeFilename, error: err.message });
    return res.status(422).json({ error: `Failed to extract stats: ${err.message}` });
  }

  auditLog("convert_success", {
    ip,
    filename:      safeFilename,
    date:          gameData.match_info?.date,
    result:        gameData.match_info?.result,
    league:        gameData.match_info?.league,
    players_found: gameData.armani_katehano?.players?.filter(p => !p.did_not_play).length ?? 0,
  });

  return res.status(200).json({ data: gameData });
}

export default requireAuth(convertHandler);
