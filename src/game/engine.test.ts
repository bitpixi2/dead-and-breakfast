import { describe, expect, it } from "vitest";
import { FALLBACK_GUESTS } from "../data/demoGuests";
import { createDefaultSave } from "../save";
import {
  advanceGame,
  createGameState,
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
    const next = handleCanvasClick(state, 500, 300);

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
});
