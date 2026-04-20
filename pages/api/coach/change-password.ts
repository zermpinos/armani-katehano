/**
 * pages/api/coach/change-password.ts
 *
 * POST { currentPassword, newPassword }
 *   → verify current password, hash and store the new one in the DB.
 *
 * Protected by coach session (requireCoachAuth).
 * The new hash is stored in Setting("coach_password_hash"), so the coach
 * can rotate their own password without the site owner ever knowing it.
 */

import bcrypt from "bcryptjs";
import { requireCoachAuth } from "../../../lib/requireCoachAuth";
import { verifyCoachPassword, setCoachPasswordHash, incrementCoachSessionVersion, clearCoachSessionCookie } from "../../../lib/coachAuth";
import { auditLog, getClientIp } from "../../../lib/security";
import { prodError } from "../../../lib/utils";
import { ChangePasswordSchema } from "@/schemas/coach";

async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parsed = ChangePasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  const { currentPassword, newPassword } = parsed.data;

  const ip = getClientIp(req);

  try {
    const valid = await verifyCoachPassword(currentPassword);
    if (!valid) {
      auditLog("coach_change_password_wrong_current", { ip });
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await setCoachPasswordHash(hash);
    // Increment version — invalidates every issued session across all devices,
    // not just the current one. The coach must log in again with the new password.
    await incrementCoachSessionVersion();
    auditLog("coach_password_changed", { ip });

    res.setHeader("Set-Cookie", clearCoachSessionCookie());
    return res.status(200).json({ ok: true, sessionCleared: true });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
