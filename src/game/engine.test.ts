import { describe, expect, it } from "vitest";
import { FALLBACK_GUESTS } from "../data/demoGuests";
import { createDefaultSave } from "../save";
import {
  advanceGame,
  buyUpgrade,
  canStartNextDayFromDayEnd,
  createGameState,
  getDayDifficulty,
  getEffectiveStationCapacity,
  handleCanvasClick,
  renderGameToText,
  startNextDay,
} from "./engine";

describe("game engine", () => {
  it("starts a day and exposes deterministic text state", () => {
    const state = startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave()));
    const advanced = advanceGame(state, 100);
    const text = JSON.parse(renderGameToText(advanced));

    expect(text.mode).toBe("playing");
    expect(text.queue.length).toBeGreaterThan(0);
    expect(text.coordinateSystem).toContain("top-left");
  });

  it("clicking menu canvas starts play", () => {
    const state = createGameState(FALLBACK_GUESTS, createDefaultSave());
    const next = handleCanvasClick(state, 500, 350);

    expect(next.mode).toBe("playing");
  });

  it("waits for a day-end upgrade before starting the next day", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "dayEnd" as const,
      day: 1,
      coins: 50,
    };
    const blocked = handleCanvasClick(state, 500, 350);
    const upgraded = buyUpgrade(blocked, "vipBell");
    const next = handleCanvasClick(upgraded, 500, 350);

    expect(blocked.mode).toBe("dayEnd");
    expect(canStartNextDayFromDayEnd(blocked)).toBe(false);
    expect(upgraded.dayEndUpgradeChoiceMade).toBe(true);
    expect(next.mode).toBe("playing");
    expect(next.day).toBe(2);
  });

  it("allows the next day when no day-end upgrades are affordable", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "dayEnd" as const,
      day: 1,
      coins: 0,
    };
    const next = handleCanvasClick(state, 500, 350);

    expect(canStartNextDayFromDayEnd(state)).toBe(true);
    expect(next.mode).toBe("playing");
  });

  it("removes guests after they lose patience", () => {
    const state = advanceGame(
      startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      100,
    );
    const withExpiredGuest = advanceGame(state, 30_000);
    const text = JSON.parse(renderGameToText(withExpiredGuest));

    expect(text.queue.some((guest: { patience: number }) => guest.patience <= 0))
      .toBe(false);
    expect(withExpiredGuest.missed).toBeGreaterThan(0);
  });

  it("keeps lab-grown meat above zero with the clicker", () => {
    const state = {
      ...startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      dayTime: 12,
      labMeat: 8,
    };
    const next = handleCanvasClick(state, 920, 400);
    const text = JSON.parse(renderGameToText(next));

    expect(next.labMeat).toBe(10);
    expect(next.labMeatClickPulseUntil).toBeGreaterThan(next.dayTime);
    expect(text.labMeat.displayAmount).toBe(10);
  });

  it("uses the bioreactor regulator upgrade to slow lab meat drain", () => {
    const base = {
      ...startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      labMeat: 10,
    };
    const regulated = {
      ...base,
      upgrades: { ...base.upgrades, patienceBoost: 3 },
    };

    const baseAfter = advanceGame(base, 4000);
    const regulatedAfter = advanceGame(regulated, 4000);

    expect(regulatedAfter.labMeat).toBeGreaterThan(baseAfter.labMeat);
  });

  it("pauses play without advancing time, patience, or lab meat", () => {
    const playing = advanceGame(
      startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      100,
    );
    const paused = handleCanvasClick(playing, 1000, 30);
    const pauseText = JSON.parse(renderGameToText(paused));
    const firstGuestPatience = paused.queue[0]?.patience;

    expect(paused.paused).toBe(true);
    expect(pauseText.paused).toBe(true);

    const advanced = advanceGame(paused, 5000);
    expect(advanced.dayTime).toBe(paused.dayTime);
    expect(advanced.labMeat).toBe(paused.labMeat);
    expect(advanced.queue[0]?.patience).toBe(firstGuestPatience);

    const ignoredGuestClick = handleCanvasClick(advanced, 60, 215);
    expect(ignoredGuestClick.selectedGuestId).toBeNull();

    const resumed = handleCanvasClick(ignoredGuestClick, 1000, 30);
    expect(resumed.paused).toBe(false);
  });

  it("alerts and penalizes Human and Cat rooms when lab meat hits zero", () => {
    const state = {
      ...startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      labMeat: 0.05,
    };
    const out = advanceGame(state, 1000);
    const text = JSON.parse(renderGameToText(out));

    expect(out.labMeat).toBe(0);
    expect(out.labMeatShortageUntil).toBeGreaterThan(out.dayTime);
    expect(text.labMeat.shortageActive).toBe(true);
    expect(getEffectiveStationCapacity("suite", out)).toBe(0);
    expect(getEffectiveStationCapacity("fishery", out)).toBe(0);
  });

  it("blocks Human Safe Suite service during lab meat outage", () => {
    const playing = advanceGame(
      startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      100,
    );
    const out = { ...playing, labMeat: 0 };
    const selected = handleCanvasClick(out, 60, 215);
    const attempted = handleCanvasClick(selected, 310, 140);

    expect(attempted.services).toHaveLength(0);
    expect(attempted.log[0]).toBe("That station is full.");
  });

  it("can buy the D&B House Upgrade for the check-in house", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      coins: 50,
    };
    const upgraded = buyUpgrade(state, "vipBell");

    expect(upgraded.upgrades.vipBell).toBe(1);
    expect(upgraded.coins).toBeLessThan(state.coins);
    expect(upgraded.log[0]).toContain("D&B House Upgrade");
  });

  it("ramps day 3, 4, and 5 into faster harder service days", () => {
    const day2 = getDayDifficulty(2);
    const day3 = getDayDifficulty(3);
    const day4 = getDayDifficulty(4);
    const day5 = getDayDifficulty(5);

    expect(day3.spawnMultiplier).toBeLessThan(day2.spawnMultiplier);
    expect(day4.spawnMultiplier).toBeLessThan(day3.spawnMultiplier);
    expect(day5.spawnMultiplier).toBeLessThan(day4.spawnMultiplier);
    expect(day3.patienceMultiplier).toBeLessThan(day2.patienceMultiplier);
    expect(day4.patienceMultiplier).toBeLessThan(day3.patienceMultiplier);
    expect(day5.patienceMultiplier).toBeLessThan(day4.patienceMultiplier);
    expect(day5.labDrainMultiplier).toBeGreaterThan(day4.labDrainMultiplier);
  });

  it("spawns guests with less patience and shorter gaps on harder days", () => {
    const base = createGameState(FALLBACK_GUESTS, createDefaultSave());
    const dayOne = advanceGame(startNextDay(base), 100);
    const dayFive = advanceGame(
      startNextDay({ ...base, mode: "dayEnd" as const, day: 4 }),
      100,
    );

    expect(dayFive.day).toBe(5);
    expect(dayFive.queue[0].patience).toBeLessThan(dayOne.queue[0].patience);
    expect(dayFive.spawnTimer).toBeLessThan(dayOne.spawnTimer);
  });

  it("drains lab-grown meat faster by day 5", () => {
    const base = {
      ...startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      labMeat: 10,
    };
    const dayFive = { ...base, day: 5 };

    const baseAfter = advanceGame(base, 4000);
    const dayFiveAfter = advanceGame(dayFive, 4000);

    expect(dayFiveAfter.labMeat).toBeLessThan(baseAfter.labMeat);
  });
});
