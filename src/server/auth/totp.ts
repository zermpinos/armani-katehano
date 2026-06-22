import "@/server/_internal/node-only";
import { TOTP, Secret } from "otpauth";

export function verifyTotp(secret: string, token: string): boolean {
  try {
    const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}
