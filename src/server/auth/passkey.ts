import "@/server/_internal/node-only";
import crypto from "node:crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import prisma from "@/server/db/client";
import { getAdminUser } from "@/server/auth/password";
import { validateAdminSlug } from "@/server/auth/admin-slug";
import type { ParsedUrlQuery } from "node:querystring";

// Validated at call time (not module load) so next build doesn't fail when
// runtime secrets aren't present in the CI build environment.
function getOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    throw new Error(
      `[passkey] NEXT_PUBLIC_APP_URL must be https:// in production. Got: "${url}"`
    );
  }
  return url;
}

export function getExpectedOrigin(): string {
  return getOrigin();
}

export function getRpId(): string {
  // Call getOrigin() before the try/catch so the production check throws;
  // only the URL parse error for malformed strings is caught.
  const origin = getOrigin();
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

type ExcludedCredential = { credentialId: string; transports: string[] };

export async function generateRegistrationOpts(
  username: string,
  excludeCredentials: ExcludedCredential[]
) {
  return generateRegistrationOptions({
    rpName:    "Armani Katehano",
    rpID:      getRpId(),
    userName:  username,
    userID:    new Uint8Array(Buffer.from(username)),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: excludeCredentials.map((c) => ({
      id:         c.credentialId,
      transports: c.transports as any,
    })),
  });
}

export async function verifyRegistrationResp(
  response: RegistrationResponseJSON,
  expectedChallenge: string
) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin:          getExpectedOrigin(),
    expectedRPID:            getRpId(),
    requireUserVerification: true,
  });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function generateAuthOpts() {
  return generateAuthenticationOptions({
    rpID:             getRpId(),
    userVerification: "required",
    allowCredentials: [],
  });
}

export type StoredCredential = {
  id:           string;
  credentialId: string;
  publicKey:    Buffer;
  counter:      number;
  transports:   string[];
  username:     string;
};

export async function verifyAuthResp(
  response:          AuthenticationResponseJSON,
  expectedChallenge: string,
  credential:        StoredCredential
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin:          getExpectedOrigin(),
    expectedRPID:            getRpId(),
    requireUserVerification: true,
    credential: {
      id:         credential.credentialId,
      publicKey:  new Uint8Array(credential.publicKey),
      counter:    credential.counter,
      transports: credential.transports as any,
    },
  });
}

// ---------------------------------------------------------------------------
// Challenge helpers
// ---------------------------------------------------------------------------

export function generateChallengeId(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function issueChallenge(challenge: string): Promise<string> {
  const id        = generateChallengeId();
  const expiresAt = new Date(Date.now() + 60_000);
  await prisma.webAuthnChallenge.create({ data: { id, challenge, expiresAt } });
  return id;
}

/** Atomically consumes a challenge. Returns the challenge string or null if expired/missing. */
export async function consumeChallenge(challengeId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ challenge: string }[]>`
    DELETE FROM "WebAuthnChallenge"
    WHERE id = ${challengeId} AND "expiresAt" > now()
    RETURNING challenge
  `;
  return rows[0]?.challenge ?? null;
}

// ---------------------------------------------------------------------------
// SSR login props helper (used by getServerSideProps in all admin pages)
// ---------------------------------------------------------------------------

export type AdminLoginProps = {
  validSlug:   boolean;
  showFallback: boolean;
  noPasskeys:  boolean;
};

export async function getAdminPasskeyLoginProps(
  params: { slug: string },
  query:  ParsedUrlQuery
): Promise<{ notFound: true } | { props: AdminLoginProps }> {
  const validSlug = await validateAdminSlug(params.slug);
  if (!validSlug) return { notFound: true };

  // Timing-safe fallback token comparison - NEVER use ===
  const envToken   = process.env.PASSKEY_FALLBACK_TOKEN ?? "";
  const queryToken = typeof query.fallback === "string" ? query.fallback : "";
  let showFallback = false;
  if (envToken && queryToken) {
    const a = Buffer.from(envToken,   "utf8");
    const b = Buffer.from(queryToken, "utf8");
    showFallback = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // Check for zero passkeys - determines bootstrap hint (SSR only, never via auth API)
  const count     = await prisma.passkeyCredential.count();
  const noPasskeys = count === 0;

  return { props: { validSlug, showFallback, noPasskeys } };
}
