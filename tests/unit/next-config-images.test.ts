import { describe, it, expect } from "vitest";
import { CLOUDINARY_CLOUD } from "@/domain/shared/cloudinary";

describe("next.config.mjs images", () => {
  it("lets the optimiser fetch only the team's Cloudinary account, with no query string", async () => {
    const { default: cfg } = await import("../../next.config.mjs");
    expect(cfg.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "res.cloudinary.com", pathname: `/${CLOUDINARY_CLOUD}/**`, search: "" },
    ]);
  });
});
