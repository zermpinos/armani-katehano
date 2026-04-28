import "@/server/_internal/node-only";
import crypto from "node:crypto";

export async function validateAdminSlug(slug: string | undefined): Promise<boolean> {
  const expected = process.env.ADMIN_SLUG;
  if (!expected || !slug) return false;
  const a = Buffer.from(slug);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
