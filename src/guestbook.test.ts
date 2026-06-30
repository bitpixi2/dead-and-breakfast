import { describe, expect, it } from "vitest";
import { FALLBACK_GUESTS } from "./data/demoGuests";
import {
  buildGuestbookEntries,
  getCompletedGuestbookDays,
  getVisibleGuestbookEntries,
} from "./guestbook";
import { createGameState } from "./game/engine";
import { createDefaultSave } from "./save";
import type { CanvasStats } from "./types";

describe("guestbook", () => {
  it("reveals no entries during day 1 play", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "playing" as const,
      day: 1,
    };

    expect(getCompletedGuestbookDays(state)).toBe(0);
    expect(getVisibleGuestbookEntries(state, null)).toHaveLength(0);
  });

  it("reveals one entry at day 1 end", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "dayEnd" as const,
      day: 1,
    };

    expect(getCompletedGuestbookDays(state)).toBe(1);
    expect(getVisibleGuestbookEntries(state, null)[0].signature).toBe(
      "Normie #5652",
    );
  });

  it("keeps prior entries visible during later days", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "playing" as const,
      day: 4,
    };

    expect(getCompletedGuestbookDays(state)).toBe(3);
    expect(getVisibleGuestbookEntries(state, null)).toHaveLength(3);
  });

  it("shows all entries after a day 7 win", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "gameOver" as const,
      gameOverKind: "won" as const,
      day: 7,
    };

    expect(getCompletedGuestbookDays(state)).toBe(7);
    expect(getVisibleGuestbookEntries(state, null)).toHaveLength(7);
  });

  it("substitutes live stats when available", () => {
    const stats: CanvasStats = {
      totalBurnCommitments: 901,
      totalBurnedTokens: 2604,
      totalTransforms: 1104,
      totalTokenData: 10000,
      totalZombies: 22,
      totalLegendaryCanvases: 7,
      totalActionPointsDistributed: "40777",
    };
    const entries = buildGuestbookEntries(stats);

    expect(entries[0].quote).toContain("2,604 Normies");
    expect(entries[1].quote).toContain("22 Zombies");
    expect(entries[2].quote).toContain("1,104 Canvas transforms");
    expect(entries[5].quote).toContain("901 burn commitments");
    expect(entries[6].quote).toContain("40,777 action points");
  });
});
