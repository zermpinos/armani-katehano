import { describe, it, expect } from "vitest";
import {
  EMPTY_PLAYER, toPlayerDraft, validatePlayerDraft, toPlayerPayload,
  toLeagueNumbers, leaguesChanged, toOptimisticPlayer,
} from "@/client/admin/roster/player-draft";

const player = {
  id: "cmplayer00000000000000001", name: "Nikos Papas", number: 7, position: "SG",
  height: null, weight: "90 kg", photoUrl: null, contactEmail: null, isActive: true,
};

describe("player draft", () => {
  it("round-trips a player through the draft", () => {
    const d = toPlayerDraft(player as any);
    expect(d).toEqual({ name: "Nikos Papas", number: "7", position: "SG", isActive: true, height: "", weight: "90 kg", photoUrl: "", contactEmail: "" });
    expect(toPlayerPayload(d)).toEqual({ name: "Nikos Papas", number: 7, position: "SG", isActive: true, height: null, weight: "90 kg", photoUrl: null, contactEmail: null });
  });

  it("requires a name and a whole jersey number from 0 to 99", () => {
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, number: "7" }, [])).toBe("Name is required");
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, name: "A", number: "" }, [])).toBe("Jersey number must be a whole number 0-99");
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, name: "A", number: "100" }, [])).toBe("Jersey number must be a whole number 0-99");
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, name: "A", number: "4.5" }, [])).toBe("Jersey number must be a whole number 0-99");
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, name: "A", number: "0" }, [])).toBeNull();
  });

  it("names the competition whose jersey override is invalid", () => {
    const leagues = [{ seasonLeagueId: "sl1", label: "2025-26 - BC6", number: "x" }];
    expect(validatePlayerDraft({ ...EMPTY_PLAYER, name: "A", number: "7" }, leagues)).toBe("Jersey for 2025-26 - BC6 must be a whole number 0-99");
  });

  it("sends a blank override as null, meaning the player's own number", () => {
    expect(toLeagueNumbers([{ seasonLeagueId: "sl1", label: "L", number: "" }, { seasonLeagueId: "sl2", label: "M", number: "12" }]))
      .toEqual([{ seasonLeagueId: "sl1", number: null }, { seasonLeagueId: "sl2", number: 12 }]);
  });

  it("detects whether any override changed", () => {
    const a = [{ seasonLeagueId: "sl1", label: "L", number: "" }];
    expect(leaguesChanged(a, [{ ...a[0] }])).toBe(false);
    expect(leaguesChanged(a, [{ ...a[0], number: "5" }])).toBe(true);
  });

  it("builds the optimistic row from the draft over the stored player", () => {
    const row = toOptimisticPlayer(player.id, { ...toPlayerDraft(player as any), name: "N. Papas", isActive: false }, player as any);
    expect(row).toMatchObject({ id: player.id, name: "N. Papas", number: 7, isActive: false });
  });
});
