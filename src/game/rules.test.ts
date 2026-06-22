import { describe, expect, it } from "vitest";
import {
  createDefaultUpgrades,
  getGuestRule,
  serviceOutcome,
} from "./rules";

describe("guest rules", () => {
  it("serves cats fish-blended ocean scrap chow", () => {
    const rule = getGuestRule("Cat");

    expect(rule.preferredStation).toBe("fishery");
    expect(rule.serviceName).toBe("Ocean scrap chow");
    expect(rule.flavor).toContain("Fish");
    expect(rule.flavor).toContain("Humans");
  });

  it("rewards aliens with bioreactor calibration", () => {
    const upgrades = createDefaultUpgrades();
    upgrades.alienCleanRoom = 1;

    const outcome = serviceOutcome("Alien", true, 0.9, upgrades, {
      hasHumanNearby: false,
    });

    expect(outcome.coins).toBeGreaterThan(
      serviceOutcome("Human", true, 0.9, upgrades, { hasHumanNearby: false })
        .coins,
    );
    expect(outcome.effects.alienCalibrationSeconds).toBeGreaterThan(12);
    expect(outcome.notes.join(" ")).toContain("calibration");
  });

  it("rewards agents with a rush bonus", () => {
    const upgrades = createDefaultUpgrades();
    upgrades.agentTerminal = 1;

    const outcome = serviceOutcome("Agent", true, 0.85, upgrades, {
      hasHumanNearby: true,
    });

    expect(outcome.effects.agentRushSeconds).toBeGreaterThan(12);
    expect(outcome.notes.join(" ")).toContain("service");
  });

  it("penalizes a zombie sent to the wrong station near humans", () => {
    const outcome = serviceOutcome(
      "Zombie",
      false,
      0.5,
      createDefaultUpgrades(),
      { hasHumanNearby: true },
    );

    expect(outcome.reputation).toBeLessThan(-1);
    expect(outcome.notes[0]).toContain("Wrong station");
  });

  it("has a safe fallback for unknown future types", () => {
    const rule = getGuestRule("Unknown");
    const outcome = serviceOutcome(
      "Unknown",
      true,
      1,
      createDefaultUpgrades(),
      { hasHumanNearby: false },
    );

    expect(rule.preferredStation).toBe("suite");
    expect(outcome.notes.join(" ")).toContain("Future type");
  });
});
