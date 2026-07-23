import { describe, it, expect } from "vitest";
import { smoothPath } from "@/client/charts/native-line-chart";

// Sample the y of every cubic segment so we can check the curve against the data.
function sampledYs(d: string): number[] {
  const nums = d.split(/[^\d.-]+/).filter(Boolean).map(Number);
  let y0 = nums[1];
  const ys = [y0];
  const rest = nums.slice(2);
  for (let g = 0; g + 6 <= rest.length; g += 6) {
    const [, c1y, , c2y, , y1] = rest.slice(g, g + 6);
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const mt = 1 - t;
      ys.push(mt * mt * mt * y0 + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y1);
    }
    y0 = y1;
  }
  return ys;
}

describe("smoothPath (monotone cubic)", () => {
  it("is a bare move for a single point", () => {
    expect(smoothPath([[0, 5]])).toBe("M 0,5");
  });

  it("never overshoots the data envelope (invents no peak or dip)", () => {
    const pts: Array<[number, number]> = [[0, 1], [1, 10], [2, 2], [3, 9], [4, 4]];
    const dataYs = pts.map(p => p[1]);
    const sampled = sampledYs(smoothPath(pts));
    expect(Math.max(...sampled)).toBeLessThanOrEqual(Math.max(...dataYs) + 1e-6);
    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(Math.min(...dataYs) - 1e-6);
  });

  it("stays monotonic where the data is monotonic", () => {
    const sampled = sampledYs(smoothPath([[0, 0], [1, 2], [2, 5], [3, 20]]));
    sampled.reduce((prev, y) => { expect(y).toBeGreaterThanOrEqual(prev - 1e-6); return y; }, -Infinity);
  });
});
