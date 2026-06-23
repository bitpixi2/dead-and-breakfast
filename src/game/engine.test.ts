import { describe, expect, it } from "vitest";
import { FALLBACK_GUESTS } from "../data/demoGuests";
import { createDefaultSave } from "../save";
import {
  advanceGame,
  createGameState,
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

  it("clicking the day-end overlay button starts the next day", () => {
    const state = {
      ...createGameState(FALLBACK_GUESTS, createDefaultSave()),
      mode: "dayEnd" as const,
      day: 1,
    };
    const next = handleCanvasClick(state, 500, 350);

    expect(next.mode).toBe("playing");
    expect(next.day).toBe(2);
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
});
