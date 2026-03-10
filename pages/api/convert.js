/**
 * pages/api/convert.js
 * POST /api/convert  →  { pdf: "<base64>" }  →  { data: {...} }
 *
 * Extracts stats from a Basket City PDF using spatial text extraction
 * (pdfjs-dist). No external API. No cost. Works 100% server-side.
 *
 * Protected by:
 *  - Session cookie auth (requireAuth)
 *  - PDF magic byte validation
 *  - 5 MB file size cap
 *  - Per-IP rate limiting (10 req/min via Vercel KV)
 */

import kv          from "../../lib/redis.js";
import { requireAuth } from "../../lib/requireAuth.js";
import {
  isValidPDF,
  securityHeaders,
  auditLog,
  MAX_PDF_BYTES,
  RATE_LIMIT_RPM,
} from "../../lib/security.js";
import { parseBasketCityPDF } from "../../lib/parser.js";

async function convertHandler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rlKey = `rl:convert:${ip}:${Math.floor(Date.now() / 60000)}`;
  const count = (await kv.get(rlKey) ?? 0) + 1;
  await kv.set(rlKey, count, { ex: 60 });

  if (count > RATE_LIMIT_RPM) {
    auditLog("rate_limited", { ip, count });
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const { pdf: base64, filename = "game.pdf" } = req.body ?? {};

  if (typeof base64 !== "string" || base64.length === 0) {
    return res.status(400).json({ error: "Missing pdf field" });
  }

  let pdfBuffer;
  try {
    pdfBuffer = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64 data" });
  }

  if (pdfBuffer.length > MAX_PDF_BYTES) {
    auditLog("pdf_too_large", { ip, bytes: pdfBuffer.length });
    return res.status(413).json({ error: `PDF exceeds maximum size of ${MAX_PDF_BYTES / 1024 / 1024} MB` });
  }

  if (!isValidPDF(pdfBuffer)) {
    auditLog("invalid_pdf_magic", { ip, filename });
    return res.status(415).json({ error: "File does not appear to be a valid PDF" });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 128);

  // ── Parse PDF (pure local — no API call) ──────────────────────────────────
  let gameData;
  try {
    gameData = await parseBasketCityPDF(new Uint8Array(pdfBuffer));
    gameData.match_info.source_file = safeFilename;
  } catch (err) {
    auditLog("parse_error", { ip, filename: safeFilename, error: err.message });
    return res.status(422).json({
      error: "Could not parse game data from PDF. Make sure this is a Basket City stat sheet.",
    });
  }

  auditLog("convert_success", {
    ip,
    filename:  safeFilename,
    date:      gameData.match_info.date,
    matchday:  gameData.match_info.matchday,
    result:    gameData.match_info.result,
    players:   gameData.armani_katehano.players.length,
  });

  return res.status(200).json({ data: gameData });
}

export default requireAuth(convertHandler);
