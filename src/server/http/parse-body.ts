import type { ZodType } from "zod";

export function parseBody<T>(
  schema: ZodType<T>,
  body: unknown,
  res: any,
  errFmt: "issues" | "flatten" = "issues",
): T | null {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const error = errFmt === "flatten"
      ? parsed.error.flatten()
      : parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(400).json({ error });
    return null;
  }
  return parsed.data;
}
