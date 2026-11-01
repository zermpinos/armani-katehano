import "@/server/_internal/node-only";
import crypto from "node:crypto";
import type { GetServerSidePropsContext } from "next";
import { getSessionToken, isLiveAdminSession } from "@/server/auth/session";

export async function validateAdminSlug(slug: string | undefined): Promise<boolean> {
  const expected = process.env.ADMIN_SLUG;
  if (!expected || !slug) return false;
  const a = Buffer.from(slug);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type AdminPageProps = { authed: boolean };

export async function getAdminPageProps(
  ctx: Pick<GetServerSidePropsContext, "params" | "req">,
): Promise<{ notFound: true } | { props: AdminPageProps }> {
  const slug = typeof ctx.params?.slug === "string" ? ctx.params.slug : undefined;
  if (!(await validateAdminSlug(slug))) return { notFound: true };
  return { props: { authed: isLiveAdminSession(getSessionToken(ctx.req)) } };
}
