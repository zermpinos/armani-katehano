import { requireAuth } from "@/server/auth";
import { prodError }   from "@/domain/shared/format";
import prisma from "@/server/db/client";
import { z } from "zod";

const VALID_PHASES = ["regular", "quarterfinal", "semifinal", "final"] as const;
const PhaseSchema = z.enum(VALID_PHASES);

async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const setting = await prisma.setting.findUnique({ where: { key: "seasonPhase" } });
      return res.status(200).json({ seasonPhase: setting?.value ?? "regular" });
    } catch (err) {
      console.error("[admin/season-phase:GET]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const parsed = PhaseSchema.safeParse(body.phase);
    if (!parsed.success) {
      return res.status(400).json({ error: `phase must be one of: ${VALID_PHASES.join(", ")}` });
    }
    const phase = parsed.data;
    try {
      await prisma.setting.upsert({
        where:  { key: "seasonPhase" },
        update: { value: phase },
        create: { key: "seasonPhase", value: phase },
      });
      await Promise.allSettled([res.revalidate?.("/"), res.revalidate?.("/games")]);
      return res.status(200).json({ seasonPhase: phase });
    } catch (err) {
      console.error("[admin/season-phase:POST]", err);
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
