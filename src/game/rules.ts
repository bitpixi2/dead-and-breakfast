import type { NormieType, StationId, UpgradeLevels } from "../types";

export interface StationDef {
  id: StationId;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

export interface GuestRule {
  type: NormieType;
  preferredStation: StationId;
  serviceName: string;
  serviceSeconds: number;
  patienceSeconds: number;
  baseCoins: number;
  baseReputation: number;
  flavor: string;
  color: string;
}

export interface ServiceOutcome {
  coins: number;
  reputation: number;
  score: number;
  effects: {
    alienCalibrationSeconds: number;
    agentRushSeconds: number;
  };
  notes: string[];
}

export interface UpgradeDef {
  id: keyof UpgradeLevels;
  label: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

export const STATIONS: StationDef[] = [
  {
    id: "suite",
    label: "Human Safe Suite",
    shortLabel: "Human Suite",
    description: "Quiet Human beds, locked menus, and calm breakfast trays.",
    color: "#48494b",
  },
  {
    id: "bioreactor",
    label: "Zombie Room Service",
    shortLabel: "Zombie Room",
    description: "Lab-grown human cuts for Zombies, no actual Humans involved.",
    color: "#48494b",
  },
  {
    id: "cleanRoom",
    label: "Alien Clean Capsule",
    shortLabel: "Alien Capsule",
    description: "Sterile suite, calibration tastings, and proper tech respect.",
    color: "#48494b",
  },
  {
    id: "frontDesk",
    label: "Agent Terminal Stay",
    shortLabel: "Agent Stay",
    description: "Rapid check-in, secure comms, and punctual meals.",
    color: "#48494b",
  },
  {
    id: "fishery",
    label: "Cat Nap n' Feed",
    shortLabel: "Cat Feed",
    description: "Caught fish blended with scraps so Cats never eye Humans.",
    color: "#48494b",
  },
];

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "bioreactorSpeed",
    label: "Zombie Room Service",
    description: "Adds Zombie service space and makes lab-grown meals faster.",
    maxLevel: 3,
    baseCost: 24,
  },
  {
    id: "extraRooms",
    label: "Human Safe Suite",
    description: "Adds more protected Human room space.",
    maxLevel: 2,
    baseCost: 30,
  },
  {
    id: "scrapChowStation",
    label: "Cat Nap n' Feed",
    description: "Adds fish-blended scrap space and speeds Cat service.",
    maxLevel: 2,
    baseCost: 22,
  },
  {
    id: "alienCleanRoom",
    label: "Alien Clean Capsule",
    description: "Adds sterile Alien capsule space and improves calibration service.",
    maxLevel: 2,
    baseCost: 34,
  },
  {
    id: "agentTerminal",
    label: "Agent Terminal Stay",
    description: "Adds secure Agent terminal space and speeds Agent service.",
    maxLevel: 2,
    baseCost: 32,
  },
];

export function createDefaultUpgrades(): UpgradeLevels {
  return {
    bioreactorSpeed: 0,
    extraRooms: 0,
    oceanLine: 0,
    scrapChowStation: 0,
    alienCleanRoom: 0,
    agentTerminal: 0,
    patienceBoost: 0,
    vipBell: 0,
  };
}

export function normalizeNormieType(value: unknown): NormieType {
  if (typeof value !== "string") {
    return "Unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "human") return "Human";
  if (normalized === "zombie") return "Zombie";
  if (normalized === "alien") return "Alien";
  if (normalized === "agent") return "Agent";
  if (normalized === "cat") return "Cat";
  return "Unknown";
}

export function getGuestRule(type: NormieType): GuestRule {
  const rules: Record<NormieType, GuestRule> = {
    Zombie: {
      type: "Zombie",
      preferredStation: "bioreactor",
      serviceName: "Lab-grown human cut",
      serviceSeconds: 6.3,
      patienceSeconds: 19,
      baseCoins: 18,
      baseReputation: 3,
      flavor: "Feed fast, keep Humans safe.",
      color: "#48494b",
    },
    Human: {
      type: "Human",
      preferredStation: "suite",
      serviceName: "Safety breakfast",
      serviceSeconds: 4.9,
      patienceSeconds: 24,
      baseCoins: 12,
      baseReputation: 2,
      flavor: "A calm room and proof they are not dinner.",
      color: "#48494b",
    },
    Alien: {
      type: "Alien",
      preferredStation: "cleanRoom",
      serviceName: "Sterile calibration tasting",
      serviceSeconds: 6.8,
      patienceSeconds: 22,
      baseCoins: 20,
      baseReputation: 4,
      flavor: "Honor the source of the tech.",
      color: "#48494b",
    },
    Agent: {
      type: "Agent",
      preferredStation: "frontDesk",
      serviceName: "Priority dossier breakfast",
      serviceSeconds: 5.7,
      patienceSeconds: 18,
      baseCoins: 17,
      baseReputation: 3,
      flavor: "Clean paperwork, secure comms, punctual meals.",
      color: "#48494b",
    },
    Cat: {
      type: "Cat",
      preferredStation: "fishery",
      serviceName: "Ocean scrap chow",
      serviceSeconds: 4.4,
      patienceSeconds: 20,
      baseCoins: 10,
      baseReputation: 2,
      flavor: "Fish blended with scraps keeps Cats from turning on Humans.",
      color: "#48494b",
    },
    Unknown: {
      type: "Unknown",
      preferredStation: "suite",
      serviceName: "House special",
      serviceSeconds: 5.2,
      patienceSeconds: 21,
      baseCoins: 9,
      baseReputation: 1,
      flavor: "A safe fallback for future Normie types.",
      color: "#48494b",
    },
  };

  return rules[type];
}

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * (1 + currentLevel * 0.75));
}

export function getStationCapacity(
  stationId: StationId,
  upgrades: UpgradeLevels,
): number {
  if (stationId === "suite") {
    return 1 + upgrades.extraRooms;
  }

  if (stationId === "bioreactor") {
    return 1 + Math.floor(upgrades.bioreactorSpeed / 2);
  }

  if (stationId === "cleanRoom") {
    return 1 + upgrades.alienCleanRoom;
  }

  if (stationId === "frontDesk") {
    return 1 + upgrades.agentTerminal;
  }

  if (stationId === "fishery") {
    return 1 + upgrades.scrapChowStation;
  }

  return 1;
}

export function getPatienceSeconds(
  type: NormieType,
  upgrades: UpgradeLevels,
): number {
  const rule = getGuestRule(type);
  return rule.patienceSeconds;
}

export function getServiceDurationSeconds(
  type: NormieType,
  stationId: StationId,
  upgrades: UpgradeLevels,
  effects: { agentRushActive: boolean; alienCalibrationActive: boolean },
): number {
  const rule = getGuestRule(type);
  let duration = rule.serviceSeconds;

  if (stationId !== rule.preferredStation) {
    duration *= 1.35;
  }

  if (type === "Zombie") {
    duration *= 1 - upgrades.bioreactorSpeed * 0.12;
    if (effects.alienCalibrationActive) duration *= 0.82;
  }

  if (type === "Cat") {
    duration *= 1 - upgrades.scrapChowStation * 0.12;
  }

  if (type === "Alien") {
    duration *= 1 - upgrades.alienCleanRoom * 0.1;
  }

  if (type === "Agent") {
    duration *= 1 - upgrades.agentTerminal * 0.12;
  }

  if (effects.agentRushActive) {
    duration *= 0.86;
  }

  return Math.max(2.2, Number(duration.toFixed(2)));
}

export function serviceOutcome(
  type: NormieType,
  correctStation: boolean,
  patienceRatio: number,
  upgrades: UpgradeLevels,
  context: { hasHumanNearby: boolean },
): ServiceOutcome {
  const rule = getGuestRule(type);
  const cleanRatio = Math.max(0, Math.min(1, patienceRatio));

  if (!correctStation) {
    const dangerPenalty =
      type === "Zombie" && context.hasHumanNearby ? -2 : type === "Alien" ? -1 : 0;
    return {
      coins: Math.max(1, Math.round(rule.baseCoins * 0.25)),
      reputation: -1 + dangerPenalty,
      score: 8,
      effects: { alienCalibrationSeconds: 0, agentRushSeconds: 0 },
      notes: [`Wrong station for ${type}; ${rule.serviceName} was missed.`],
    };
  }

  let coins = rule.baseCoins + Math.round(rule.baseCoins * cleanRatio * 0.45);
  let reputation = rule.baseReputation;
  let score = Math.round(rule.baseCoins * 10 + cleanRatio * 60);
  const effects = { alienCalibrationSeconds: 0, agentRushSeconds: 0 };
  const notes = [`${type} loved the ${rule.serviceName}.`];

  if (type === "Zombie" && context.hasHumanNearby) {
    reputation += 1;
    score += 45;
    notes.push("Humans stayed safely off the menu.");
  }

  if (type === "Alien") {
    reputation += upgrades.alienCleanRoom;
    coins += 4 + upgrades.alienCleanRoom * 3;
    effects.alienCalibrationSeconds = 12 + upgrades.alienCleanRoom * 5;
    notes.push("Alien calibration improved the bioreactor.");
  }

  if (type === "Agent") {
    reputation += upgrades.agentTerminal;
    coins += 3 + upgrades.agentTerminal * 3;
    effects.agentRushSeconds = 12 + upgrades.agentTerminal * 5;
    notes.push("Agent paperwork kicked service into high gear.");
  }

  if (type === "Cat") {
    coins += upgrades.scrapChowStation * 2;
    notes.push("Fish-blended scraps kept Cat cravings harmless.");
  }

  if (type === "Unknown") {
    notes.push("Future type handled with the safe house special.");
  }

  return { coins, reputation, score, effects, notes };
}

export function missOutcome(
  type: NormieType,
  context: { hasHumanNearby: boolean },
): ServiceOutcome {
  let reputation = -1;
  const notes = [`${type} left unhappy.`];

  if (type === "Zombie") {
    reputation = context.hasHumanNearby ? -4 : -3;
    notes.push("A hungry Zombie made the lobby nervous.");
  } else if (type === "Human") {
    reputation = -3;
    notes.push("Human trust fell.");
  } else if (type === "Alien") {
    reputation = -3;
    notes.push("Alien calibration was lost.");
  } else if (type === "Agent") {
    reputation = -2;
    notes.push("Agent delays slowed the desk.");
  } else if (type === "Cat") {
    reputation = -2;
    notes.push("Unserved Cats started sniffing around the Human wing.");
  }

  return {
    coins: 0,
    reputation,
    score: -15,
    effects: { alienCalibrationSeconds: 0, agentRushSeconds: 0 },
    notes,
  };
}
