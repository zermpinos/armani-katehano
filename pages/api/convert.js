/**
 * api/convert.js
 * POST /api/convert  →  { pdf: "<base64>" }  →  { json: {...} }
 *
 * Protected by:
 *  - Session cookie auth
 *  - PDF magic byte validation
 *  - 5 MB file size cap
 *  - Per-IP rate limiting (10 req/min via Vercel KV)
 *  - Anthropic API key never leaves the server
 */

import { kv }           from "@vercel/kv";
import { requireAuth }  from "../../lib/requireAuth.js";
import {
  isValidPDF,
  securityHeaders,
  auditLog,
  MAX_PDF_BYTES,
  RATE_LIMIT_RPM,
} from "../../lib/security.js";

// ── Parser (mirrors Python script) ───────────────────────────────────────────
// Imported inline so the API function is self-contained.
import { parseGameText } from "../../lib/parser.js";

async function convertHandler(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Rate limiting (OWASP A04 / cost protection) ───────────────────────────
  const rlKey   = `rl:convert:${ip}:${Math.floor(Date.now() / 60000)}`;
  const count   = (await kv.get(rlKey) ?? 0) + 1;
  await kv.set(rlKey, count, { ex: 60 });

  if (count > RATE_LIMIT_RPM) {
    auditLog("rate_limited", { ip, count });
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
  }

  // ── Input validation ───────────────────────────────────────────────────────
  const { pdf: base64, filename = "game.pdf" } = req.body ?? {};

  if (typeof base64 !== "string" || base64.length === 0) {
    return res.status(400).json({ error: "Missing pdf field" });
  }

  // Decode and size-check before doing anything else
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

  // Magic byte check — rejects files merely renamed to .pdf (OWASP A03)
  if (!isValidPDF(pdfBuffer)) {
    auditLog("invalid_pdf_magic", { ip, filename });
    return res.status(415).json({ error: "File does not appear to be a valid PDF" });
  }

  // Sanitise filename for logging — strip any path traversal attempts
  const safeFilename = filename.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 128);

  // ── Call Anthropic API (server-side only — key never reaches the browser) ──
  let extractedText;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Extract ALL text from this basketball game PDF exactly as it appears. Return ONLY the raw text content, preserving spacing and line breaks. Do not summarize, translate, or modify anything.",
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      auditLog("anthropic_error", { ip, status: response.status });
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    extractedText = data.content.map(c => c.text || "").join("\n");
  } catch (err) {
    auditLog("convert_api_error", { ip, filename: safeFilename, error: err.message });
    return res.status(502).json({ error: "Failed to extract PDF text. Please try again." });
  }

  // ── Parse the extracted text ───────────────────────────────────────────────
  let gameData;
  try {
    gameData = parseGameText(extractedText);
    gameData.match_info.source_file = safeFilename;
  } catch (err) {
    auditLog("parse_error", { ip, filename: safeFilename, error: err.message });
    return res.status(422).json({ error: "Could not parse game data from PDF. Is this a Basket City report?" });
  }

  auditLog("convert_success", {
    ip,
    filename: safeFilename,
    date:     gameData.match_info.date,
    matchday: gameData.match_info.matchday,
    result:   gameData.match_info.result,
  });

  return res.status(200).json({ data: gameData });
}

export default requireAuth(convertHandler);
