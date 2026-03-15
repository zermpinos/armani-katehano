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

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT — column-mapped, fraction-aware, percentage-aware
// ─────────────────────────────────────────────────────────────────────────────
const PROMPT = `You are reading a Basket City basketball score sheet image.
Your job is to extract the ARMANI KATEHANO team's player statistics with 100% accuracy.
Return ONLY valid JSON — no markdown, no code fences, no explanation, no trailing commas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLUMN ORDER IN THE ARMANI KATEHANO TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The columns appear left-to-right in this exact order:

  NO   | ΟΝΟΜΑ ΑΘΛΗΤΗ | ΠΟ  | ΒΟΛ       | ΔΙΠ       | ΤΡΙΠ      | ΦΑ | ΚΦ | Ρ.Α. | Ρ.Ε. | ΡΙΜ | ΠΑΣ | ΚΛ. | ΚΟ. | ΛΑ. | RAN | ΧΡ.
  ---  | Player Name  | PTS | FT m/a %  | 2PT m/a % | 3PT m/a % | PF | TF | DREB | OREB | REB | AST | STL | BLK | TOV | EFF | MIN

Column meanings:
  NO        = jersey number (integer)
  ΟΝΟΜΑ     = player name in Greek (SURNAME FIRSTNAME format)
  ΠΟ        = total points scored (integer)
  ΒΟΛ       = free throws: shown as  made/attempted  then a % number — READ ONLY made and attempted, IGNORE the % number
  ΔΙΠ       = 2-point field goals: shown as  made/attempted  then a % number — READ ONLY made and attempted, IGNORE the %
  ΤΡΙΠ      = 3-point field goals: shown as  made/attempted  then a % number — READ ONLY made and attempted, IGNORE the %
  ΦΑ        = personal fouls committed (integer)
  ΚΦ        = technical fouls (integer, usually 0)
  Ρ.Α.      = DEFENSIVE rebounds (integer) ← this is listed BEFORE offensive
  Ρ.Ε.      = OFFENSIVE rebounds (integer) ← this is listed AFTER defensive
  ΡΙΜ       = total rebounds = Ρ.Α. + Ρ.Ε. (integer)
  ΠΑΣ       = assists (integer)
  ΚΛ.       = steals (integer)
  ΚΟ.       = blocks (integer)
  ΛΑ.       = turnovers (integer)
  RAN       = efficiency rating (integer, can be negative)
  ΧΡ.       = minutes played in MM:SS format (e.g. "26:34")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRACTION READING RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each shot column shows:  [made] / [attempted]  [percentage%]
Example: "3 / 5  60." means made=3, attempted=5. The "60." is the shooting % — DO NOT use it as a stat.
If the cell shows "0 / 0  0" that means 0 made, 0 attempted.
The number AFTER the fraction (the percentage) is always a separate visual element — never a stat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAGUE DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Look at the competition text printed near the top of the sheet:
  • Contains "ROOKIE" or "ΝΕΩΝ" or "ΝΕΑΝΙΚΟ"                     → league = "rookie"
  • Contains "BC6" or "Β' ΚΑΤΗΓΟΡΙΑ" or "B ΚΑΤΗΓΟΡΙΑ" or "B6"   → league = "bc6"
  • Contains "WINTER CUP" or "ΧΕΙΜΕΡΙΝΟ" or "WINTER SUPER CUP"  → league = "wintercup"
  • Anything else                                                  → league = ""

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OTHER RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Include EVERY player row in the ARMANI KATEHANO table, even substitutes with 0 minutes.
- If a player has "0:00" or no time listed, set did_not_play=true and all stats to 0.
- minutes_played.total_seconds = (minutes × 60) + seconds  e.g. "26:34" → 1594
- date: convert DD/MM/YYYY printed on sheet to YYYY-MM-DD format
- result: if ARMANI KATEHANO final score > opponent final score → "W", else → "L"
- home: ARMANI KATEHANO is the home team if their name appears on the LEFT side of the scoreboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED JSON SHAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "match_info": {
    "date": "YYYY-MM-DD",
    "home_team": "TEAM NAME",
    "away_team": "TEAM NAME",
    "home_score": 0,
    "away_score": 0,
    "competition": "exact competition text from top of sheet",
    "matchday": 0,
    "league": "rookie or bc6 or wintercup or empty string",
    "result": "W or L",
    "opponent": "the other team's name (not ARMANI KATEHANO)",
    "armani_katehano_score": 0,
    "opponent_score": 0
  },
  "armani_katehano": {
    "players": [
      {
        "jersey_number": 0,
        "name_greek": "SURNAME FIRSTNAME",
        "points": 0,
        "free_throws":     { "made": 0, "attempted": 0 },
        "two_point_fg":    { "made": 0, "attempted": 0 },
        "three_point_fg":  { "made": 0, "attempted": 0 },
        "fouls_committed": 0,
        "fouls_earned":    0,
        "defensive_rebounds": 0,
        "offensive_rebounds": 0,
        "total_rebounds":  0,
        "assists": 0,
        "steals":  0,
        "blocks":  0,
        "turnovers": 0,
        "efficiency": 0,
        "minutes_played": { "display": "MM:SS", "total_seconds": 0 },
        "did_not_play": false
      }
    ]
  }
}`;

// ─────────────────────────────────────────────────────────────────────────────

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
        max_tokens: 4000, // raised from 2000 — full box score can exceed 2000 tokens
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

    // Check for truncation — if finish_reason is not "end_turn" the JSON is likely cut off
    const stopReason = apiData.stop_reason;
    if (stopReason && stopReason !== "end_turn") {
      throw new Error(`Response was truncated (stop_reason: ${stopReason}). Try a cleaner image or contact support.`);
    }

    const raw = apiData.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    gameData = JSON.parse(raw);
    gameData.match_info.source_file = safeFilename;

    // Normalise the league field — only allow known values
    const rawLeague = (gameData.match_info.league || "").toLowerCase().trim();
    gameData.match_info.league = ["rookie", "bc6", "wintercup"].includes(rawLeague) ? rawLeague : "";

    // ── Sanity checks — catch obvious extraction errors before they reach the UI
    const players = gameData.armani_katehano?.players ?? [];
    const warnings = [];

    for (const p of players) {
      if (p.did_not_play) continue;

      // Points should equal 2*fg2m + 3*fg3m + ftm
      const expectedPts = (p.two_point_fg?.made ?? 0) * 2
                        + (p.three_point_fg?.made ?? 0) * 3
                        + (p.free_throws?.made ?? 0);
      if (p.points !== expectedPts) {
        warnings.push(`#${p.jersey_number} ${p.name_greek}: points=${p.points} but 2×${p.two_point_fg?.made}+3×${p.three_point_fg?.made}+FT${p.free_throws?.made}=${expectedPts}`);
      }

      // Total rebounds should equal drb + orb
      const expectedReb = (p.defensive_rebounds ?? 0) + (p.offensive_rebounds ?? 0);
      if (p.total_rebounds !== expectedReb) {
        warnings.push(`#${p.jersey_number} ${p.name_greek}: total_rebounds=${p.total_rebounds} but DREB${p.defensive_rebounds}+OREB${p.offensive_rebounds}=${expectedReb}`);
      }

      // Made can never exceed attempted
      for (const [label, stat] of [
        ["FT",  p.free_throws],
        ["2PT", p.two_point_fg],
        ["3PT", p.three_point_fg],
      ]) {
        if ((stat?.made ?? 0) > (stat?.attempted ?? 0)) {
          warnings.push(`#${p.jersey_number} ${p.name_greek}: ${label} made(${stat.made}) > attempted(${stat.attempted})`);
        }
      }
    }

    if (warnings.length > 0) {
      gameData._warnings = warnings;
      auditLog("sanity_warnings", { ip, filename: safeFilename, warnings });
    }

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
    warnings:      gameData._warnings?.length ?? 0,
  });

  return res.status(200).json({ data: gameData });
}

export default requireAuth(convertHandler);
