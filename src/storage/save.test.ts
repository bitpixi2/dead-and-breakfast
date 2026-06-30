import { describe, expect, it } from "vitest";
import { parseGameSave } from "./save";
import { createDefaultUpgrades } from "../game/rules";

describe("save parsing", () => {
  it("falls back safely on corrupt save data", () => {
    const save = parseGameSave("{not json");

    expect(save.version).toBe(1);
    expect(save.day).toBe(1);
    expect(save.coins).toBe(24);
  });

  it("coerces upgrade levels and filters discovered IDs", () => {
    const save = parseGameSave(
      JSON.stringify({
        version: 1,
        day: 3,
        coins: 77,
        reputation: 12,
        bestScore: 400,
        upgrades: { ...createDefaultUpgrades(), oceanLine: 2.7 },
        discoveredTokenIds: [12, -1, 10000, 9009],
        settings: { reducedMotion: true },
        savedAt: "now",
      }),
    );

    expect(save.day).toBe(3);
    expect(save.upgrades.oceanLine).toBe(2);
    expect(save.discoveredTokenIds).toEqual([12, 9009]);
    expect(save.settings.reducedMotion).toBe(true);
  });
});
