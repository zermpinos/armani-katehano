// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import {
  invalidateForGameMutation,
  invalidateForScheduleMutation,
  invalidateForRecalc,
  invalidateForSeasonMutation,
  invalidateForLeagueMutation,
  invalidateForSeasonPhaseChange,
  invalidateForPlayerMutation,
  invalidateForRosterAnnouncement,
  invalidateForPopupConfig,
} from "@/server/services/cache-invalidation";

function recorder() {
  const calls: string[] = [];
  const fn = vi.fn(async (p: string) => { calls.push(p); });
  return { fn, calls };
}

describe("cache-invalidation", () => {
  describe("invalidateForGameMutation", () => {
    it("invalidates all listings, the per-game page, and a per-player page for every affected slug", async () => {
      const { fn, calls } = recorder();
      await invalidateForGameMutation({
        revalidate: fn,
        gameId: "game-123",
        affectedPlayerSlugs: ["alex", "marios"],
      });
      expect(calls.sort()).toEqual([
        "/",
        "/games",
        "/games/game-123",
        "/leaderboard",
        "/players",
        "/players/alex",
        "/players/marios",
        "/sitemap.xml",
        "/team-stats",
      ]);
    });

    it("still invalidates the per-game page when no players are passed", async () => {
      const { fn, calls } = recorder();
      await invalidateForGameMutation({ revalidate: fn, gameId: "g1" });
      expect(calls).toContain("/games/g1");
      expect(calls.some((p) => p.startsWith("/players/"))).toBe(false);
    });

    it("is a no-op when no revalidate function is provided", async () => {
      await expect(
        invalidateForGameMutation({ gameId: "g1", affectedPlayerSlugs: ["alex"] }),
      ).resolves.toBeUndefined();
    });

    it("does not let a rejected revalidate call reject the batch", async () => {
      const fn = vi.fn(async (p: string) => {
        if (p === "/players") throw new Error("boom");
      });
      await expect(
        invalidateForGameMutation({ revalidate: fn, gameId: "g1", affectedPlayerSlugs: ["alex"] }),
      ).resolves.toBeUndefined();
      expect(fn).toHaveBeenCalledWith("/players/alex");
    });
  });

  describe("invalidateForScheduleMutation", () => {
    it("hits home and games listing only", async () => {
      const { fn, calls } = recorder();
      await invalidateForScheduleMutation({ revalidate: fn });
      expect(calls.sort()).toEqual(["/", "/games", "/sitemap.xml"]);
    });
  });

  describe("invalidateForRecalc", () => {
    it("hits every public listing", async () => {
      const { fn, calls } = recorder();
      await invalidateForRecalc({ revalidate: fn });
      expect(calls.sort()).toEqual(["/", "/games", "/leaderboard", "/players", "/sitemap.xml", "/team-stats"]);
    });
  });

  describe("invalidateForSeasonMutation", () => {
    it("hits stats listings but not home", async () => {
      const { fn, calls } = recorder();
      await invalidateForSeasonMutation({ revalidate: fn });
      expect(calls.sort()).toEqual(["/games", "/leaderboard", "/players", "/team-stats"]);
    });
  });

  describe("invalidateForLeagueMutation", () => {
    it("hits only the games listing", async () => {
      const { fn, calls } = recorder();
      await invalidateForLeagueMutation({ revalidate: fn });
      expect(calls).toEqual(["/games"]);
    });
  });

  describe("invalidateForSeasonPhaseChange", () => {
    it("hits home and games listing", async () => {
      const { fn, calls } = recorder();
      await invalidateForSeasonPhaseChange({ revalidate: fn });
      expect(calls.sort()).toEqual(["/", "/games", "/sitemap.xml"]);
    });
  });

  describe("invalidateForPlayerMutation", () => {
    it("hits roster listings and the per-player page when a slug is passed", async () => {
      const { fn, calls } = recorder();
      await invalidateForPlayerMutation({ revalidate: fn, playerSlug: "alex" });
      expect(calls.sort()).toEqual(["/", "/leaderboard", "/players", "/players/alex", "/team-stats"]);
    });

    it("invalidates the previous slug too on rename, deduplicating same-slug edits", async () => {
      const { fn, calls } = recorder();
      await invalidateForPlayerMutation({ revalidate: fn, playerSlug: "alex-new", previousSlug: "alex-old" });
      expect(calls.filter((p) => p.startsWith("/players/")).sort()).toEqual([
        "/players/alex-new",
        "/players/alex-old",
      ]);
    });

    it("does not double-invalidate when the new slug equals the previous slug", async () => {
      const { fn, calls } = recorder();
      await invalidateForPlayerMutation({ revalidate: fn, playerSlug: "alex", previousSlug: "alex" });
      expect(calls.filter((p) => p === "/players/alex")).toHaveLength(1);
    });

    it("skips the per-player path when no slug is known", async () => {
      const { fn, calls } = recorder();
      await invalidateForPlayerMutation({ revalidate: fn });
      expect(calls.some((p) => p.startsWith("/players/"))).toBe(false);
    });
  });

  describe("invalidateForRosterAnnouncement", () => {
    it("hits home only", async () => {
      const { fn, calls } = recorder();
      await invalidateForRosterAnnouncement({ revalidate: fn });
      expect(calls).toEqual(["/"]);
    });
  });

  describe("invalidateForGameMutation — sitemap included", () => {
    it("includes /sitemap.xml in the fan-out", async () => {
      const { fn, calls } = recorder();
      await invalidateForGameMutation({ revalidate: fn, gameId: "g1" });
      expect(calls).toContain("/sitemap.xml");
    });
  });

  describe("invalidateForScheduleMutation — sitemap included", () => {
    it("includes /sitemap.xml in the fan-out", async () => {
      const { fn, calls } = recorder();
      await invalidateForScheduleMutation({ revalidate: fn });
      expect(calls).toContain("/sitemap.xml");
    });
  });

  describe("invalidateForPopupConfig", () => {
    it("fans out exactly ['/']", async () => {
      const { fn, calls } = recorder();
      await invalidateForPopupConfig({ revalidate: fn });
      expect(calls).toEqual(["/"]);
    });

    it("is a no-op when no revalidate is provided", async () => {
      await expect(invalidateForPopupConfig({})).resolves.toBeUndefined();
    });

    it("does not let a rejected revalidate call reject the batch", async () => {
      const fn = vi.fn(async () => { throw new Error("boom"); });
      await expect(invalidateForPopupConfig({ revalidate: fn })).resolves.toBeUndefined();
    });
  });
});
