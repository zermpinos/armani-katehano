import { TOTP, Secret } from "otpauth";

export function verifyTotp(secret: string, token: string): boolean {
  try {
    const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}

export function generateTotpSetup(username: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({ label: `AKAdmin:${username}`, issuer: "AKAdmin", secret, digits: 6, period: 30 });
  return { secret: secret.base32, uri: totp.toString() };
}
