/**
 * pages/api/coach/change-password.ts
 *
 * POST { currentPassword, newPassword }
 *   -> verify current password, hash and store the new one in the DB.
 *
 * Protected by coach session (requireCoachAuth).
 * The new hash is stored in Setting("coach_password_hash"), so the coach
 * can rotate their own password without the site owner ever knowing it.
 */

import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireCoachAuth } from "../../../lib/requireCoachAuth";
import { verifyCoachPassword, setCoachPasswordHash } from "../../../lib/coachAuth";
import { auditLog } from "../../../lib/security";
import { prodError } from "../../../lib/utils";

const ChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword:     z.string().min(8).max(200),
});

async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parsed = ChangeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  const { currentPassword, newPassword } = parsed.data;

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  try {
    const valid = await verifyCoachPassword(currentPassword);
    if (!valid) {
      auditLog("coach_change_password_wrong_current", { ip });
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await setCoachPasswordHash(hash);
    auditLog("coach_password_changed", { ip });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: prodError(err) });
  }
}

export default requireCoachAuth(handler);
