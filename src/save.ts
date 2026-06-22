import type { GameSaveV1, GameState, UpgradeLevels } from "./types";
import { createDefaultUpgrades } from "./game/rules";

const SAVE_KEY = "dead-and-breakfast:save:v1";

export function createDefaultSave(): GameSaveV1 {
  return {
    version: 1,
    day: 1,
    coins: 24,
    reputation: 10,
    bestScore: 0,
    upgrades: createDefaultUpgrades(),
    discoveredTokenIds: [],
    settings: { reducedMotion: false },
    savedAt: new Date().toISOString(),
  };
}

function coerceUpgradeLevels(value: unknown): UpgradeLevels {
  const defaults = createDefaultUpgrades();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const record = value as Partial<Record<keyof UpgradeLevels, unknown>>;
  return {
    bioreactorSpeed: readLevel(record.bioreactorSpeed, defaults.bioreactorSpeed),
    extraRooms: readLevel(record.extraRooms, defaults.extraRooms),
    oceanLine: readLevel(record.oceanLine, defaults.oceanLine),
    scrapChowStation: readLevel(
      record.scrapChowStation,
      defaults.scrapChowStation,
    ),
    alienCleanRoom: readLevel(record.alienCleanRoom, defaults.alienCleanRoom),
    agentTerminal: readLevel(record.agentTerminal, defaults.agentTerminal),
    patienceBoost: readLevel(record.patienceBoost, defaults.patienceBoost),
    vipBell: readLevel(record.vipBell, defaults.vipBell),
  };
}

function readLevel(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

export function parseGameSave(raw: string | null): GameSaveV1 {
  if (!raw) {
    return createDefaultSave();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GameSaveV1>;
    if (parsed.version !== 1) {
      return createDefaultSave();
    }

    return {
      version: 1,
      day: readLevel(parsed.day, 1) || 1,
      coins: readLevel(parsed.coins, 24),
      reputation: readLevel(parsed.reputation, 10),
      bestScore: readLevel(parsed.bestScore, 0),
      upgrades: coerceUpgradeLevels(parsed.upgrades),
      discoveredTokenIds: Array.isArray(parsed.discoveredTokenIds)
        ? parsed.discoveredTokenIds
            .filter((id): id is number => Number.isInteger(id))
            .filter((id) => id >= 0 && id <= 9999)
        : [],
      settings: {
        reducedMotion: Boolean(parsed.settings?.reducedMotion),
      },
      savedAt:
        typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : new Date().toISOString(),
    };
  } catch {
    return createDefaultSave();
  }
}

export function loadGameSave(storage: Storage | null = localStorage): GameSaveV1 {
  if (!storage) {
    return createDefaultSave();
  }

  try {
    return parseGameSave(storage.getItem(SAVE_KEY));
  } catch {
    return createDefaultSave();
  }
}

export function writeGameSave(
  save: GameSaveV1,
  storage: Storage | null = localStorage,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Local-only progress should fail quietly if storage is blocked.
  }
}

export function clearGameSave(storage: Storage | null = localStorage): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function saveFromGameState(
  state: GameState,
  currentSave: GameSaveV1,
): GameSaveV1 {
  const discovered = new Set(currentSave.discoveredTokenIds);
  for (const guest of state.roster) {
    if (guest.source === "api" || guest.source === "manual") {
      discovered.add(guest.tokenId);
    }
  }

  return {
    ...currentSave,
    day: state.day,
    coins: state.coins,
    reputation: state.reputation,
    bestScore: Math.max(currentSave.bestScore, state.bestScore, state.score),
    upgrades: { ...state.upgrades },
    discoveredTokenIds: Array.from(discovered).sort((a, b) => a - b),
    savedAt: new Date().toISOString(),
  };
}
