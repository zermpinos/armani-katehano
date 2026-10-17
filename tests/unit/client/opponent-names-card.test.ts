import { describe, it, expect } from "vitest";
import { savedMessage } from "@/client/admin/schedule/OpponentNamesCard";

describe("savedMessage", () => {
  it("says what was published", () => {
    expect(savedMessage({ published: [{}], syncError: null }, "fixture"))
      .toEqual({ msg: "Saved. 1 fixture published.", type: "success" });
    expect(savedMessage({ published: [{}, {}], syncError: null }, "fixture").msg).toBe("Saved. 2 fixtures published.");
  });

  it("says when the listing could not be read", () => {
    expect(savedMessage({ published: [], syncError: "Super League: Upstream unreachable: fetch failed" }, "fixture"))
      .toEqual({ msg: "Saved. The fixture could not be published now (Super League: Upstream unreachable: fetch failed). The nightly run will publish it.", type: "error" });
  });

  it("points a waiting result to the nightly run or the Import page", () => {
    expect(savedMessage({ published: [], syncError: null }, "result").msg)
      .toBe("Saved. The result imports on the nightly run, or from Import now.");
  });

  it("says so when nothing was waiting any more", () => {
    expect(savedMessage({ published: [], syncError: null }, "fixture").msg).toBe("Saved. No fixture was waiting on it any more.");
  });
});
