import crypto from 'crypto';

/**
 * Validates the URL slug against the ADMIN_SLUG environment variable
 * using a timing-safe comparison to prevent timing attacks.
 *
 * Returns true only if both the env var and the provided slug are
 * non-empty strings that match byte-for-byte.
 */
export async function validateAdminSlug(slug: string | undefined): Promise<boolean> {
  const expected = process.env.ADMIN_SLUG;

  // Guard: if ADMIN_SLUG is not configured, never grant access.
  // Without this, Buffer.from(undefined) produces a 0-length buffer
  // which matches Buffer.from('') -- effectively bypassing auth.
  if (!expected || !slug) return false;

  const a = Buffer.from(slug);
  const b = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers.
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}