import { PHASE_PRODUCTION_BUILD } from "next/constants";

// The fallback is for a build with no database. At runtime a throw makes Next keep the last good page.
export function rethrowOutsideBuild(err: unknown): void {
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw err;
}
