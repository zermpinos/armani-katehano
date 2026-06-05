// @ts-nocheck
import { describe, it, expect } from "vitest";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";

const BASE = "https://res.cloudinary.com/demo/image/upload/v1/players/petros.jpg";

describe("cloudinaryThumb", () => {
  it("inserts transformation right after /image/upload/", () => {
    expect(cloudinaryThumb(BASE)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_64,h_64,f_auto,q_auto/v1/players/petros.jpg"
    );
  });
  it("respects the size argument", () => {
    expect(cloudinaryThumb(BASE, 128)).toContain("w_128,h_128");
  });
  it("returns non-Cloudinary URLs unchanged", () => {
    const url = "https://example.com/avatars/petros.jpg";
    expect(cloudinaryThumb(url)).toBe(url);
  });
  it("leaves the asset path intact after the transformation", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v9999/folder/sub/asset.png";
    const out = cloudinaryThumb(url, 32);
    expect(out.endsWith("v9999/folder/sub/asset.png")).toBe(true);
  });
});
