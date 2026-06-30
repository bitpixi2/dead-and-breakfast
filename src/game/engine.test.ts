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
  getLabMeatClickGain,
  getSpawnBatchSize,
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
    const upgraded = buyUpgrade(blocked, "bioreactorSpeed");
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

  it("pauses for a shortage warning and game-overs if a Human is out of their room", () => {
    const playing = advanceGame(
      startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      100,
    );
    const warning = advanceGame({ ...playing, labMeat: 0 }, 100);
    const acknowledged = handleCanvasClick(warning, 500, 350);

    expect(warning.mode).toBe("shortageWarning");
    expect(warning.log[0]).toContain("eat a Human");
    expect(acknowledged.mode).toBe("gameOver");
    expect(acknowledged.gameOverKind).toBe("lost");
    expect(acknowledged.gameOverReason).toContain("Human");
  });

  it("resumes after shortage warning when Humans are safely in the suite", () => {
    const playing = advanceGame(
      startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      100,
    );
    const selected = handleCanvasClick(playing, 60, 215);
    const served = handleCanvasClick(selected, 310, 140);
    const warning = advanceGame(
      { ...served, labMeat: 0, labMeatShortageWarned: false },
      100,
    );
    const acknowledged = handleCanvasClick(warning, 500, 350);

    expect(warning.mode).toBe("shortageWarning");
    expect(acknowledged.mode).toBe("playing");
    expect(acknowledged.gameOverKind).toBeNull();
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

  it("can buy an operational upgrade for service flow", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      coins: 50,
    };
    const upgraded = buyUpgrade(state, "bioreactorSpeed");

    expect(upgraded.upgrades.bioreactorSpeed).toBe(1);
    expect(upgraded.coins).toBeLessThan(state.coins);
    expect(upgraded.log[0]).toContain("Zombie Room Service");
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

  it("uses steadier early arrivals and burstier later arrivals", () => {
    expect(getSpawnBatchSize(1, 8)).toBe(1);
    const lateBatches = Array.from({ length: 12 }, (_, index) =>
      getSpawnBatchSize(6, index),
    );

    expect(lateBatches.some((size) => size > 1)).toBe(true);
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

  it("makes day 6 and 7 harder on the lab-grown meat clicker", () => {
    const day5Drain = getDayDifficulty(5).labDrainMultiplier;
    const day6Drain = getDayDifficulty(6).labDrainMultiplier;
    const day7Drain = getDayDifficulty(7).labDrainMultiplier;

    expect(day6Drain).toBeGreaterThan(day5Drain * 2);
    expect(day7Drain).toBeGreaterThan(day6Drain);
    expect(getLabMeatClickGain(5)).toBe(2);
    expect(getLabMeatClickGain(6)).toBe(1);
    expect(getLabMeatClickGain(7)).toBe(1);

    const base = {
      ...startNextDay(createGameState(FALLBACK_GUESTS, createDefaultSave())),
      labMeat: 10,
      spawnTimer: 99,
    };
    const daySevenAfter = advanceGame({ ...base, day: 7 }, 4000);

    expect(daySevenAfter.labMeat).toBeLessThanOrEqual(6);
  });

  it("congratulates the player after surviving day 7", () => {
    const state = {
      ...startNextDay({
        ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
        mode: "dayEnd" as const,
        day: 6,
      }),
      dayTime: 120,
      dayDuration: 1,
      dayRoster: [],
      spawnIndex: 0,
      queue: [],
      services: [],
    };
    const won = advanceGame(state, 100);
    const text = JSON.parse(renderGameToText(won));

    expect(won.mode).toBe("gameOver");
    expect(won.gameOverKind).toBe("won");
    expect(won.gameOverReason).toContain("7 game-days");
    expect(text.gameOverKind).toBe("won");
  });
});
