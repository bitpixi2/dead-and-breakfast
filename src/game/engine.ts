import { FALLBACK_GUESTS } from "../data/demoGuests";
import type {
  GameSaveV1,
  GameState,
  GuestInstance,
  NormieGuest,
  ServiceJob,
  StationId,
} from "../types";
import {
  createDefaultUpgrades,
  getGuestRule,
  getPatienceSeconds,
  getServiceDurationSeconds,
  getStationCapacity,
  getUpgradeCost,
  missOutcome,
  serviceOutcome,
  UPGRADE_DEFS,
} from "./rules";
import { hitTestCanvas, OVERLAY_BUTTON_RECT, rectContains } from "./layout";

const MAX_LOG_LINES = 6;
const LAB_MEAT_START = 10;
const LAB_MEAT_MAX = 18;
const LAB_MEAT_CLICK_GAIN = 2;
const LAB_MEAT_DECAY_PER_SECOND = 0.25;
const LAB_MEAT_FLASH_SECONDS = 2.4;
const LAB_MEAT_CLICK_PULSE_SECONDS = 0.35;
const FINAL_DAY = 7;
const SHORTAGE_WARNING =
  "There's no more lab-grown Human meat. We're going to eat a Human if they're out of their room.";

interface DayDifficulty {
  spawnMultiplier: number;
  minSpawnSeconds: number;
  patienceMultiplier: number;
  serviceMultiplier: number;
  labDrainMultiplier: number;
}

export function createGameState(
  roster: NormieGuest[] = FALLBACK_GUESTS,
  save: GameSaveV1,
): GameState {
  return {
    mode: "menu",
    paused: false,
    day: save.day,
    dayTime: 0,
    dayDuration: 86,
    spawnTimer: 0,
    spawnIndex: 0,
    nextGuestId: 1,
    nextServiceId: 1,
    dayRoster: [],
    roster: roster.length > 0 ? roster : FALLBACK_GUESTS,
    queue: [],
    services: [],
    selectedGuestId: null,
    coins: save.coins,
    reputation: save.reputation,
    score: 0,
    bestScore: save.bestScore,
    streak: 0,
    served: 0,
    missed: 0,
    dayEndUpgradeChoiceMade: false,
    upgrades: { ...save.upgrades },
    log: [
      "Dead and Breakfast is open.",
      "Serve every type well. No wallet required.",
    ],
    agentRushUntil: 0,
    alienCalibrationUntil: 0,
    labMeat: LAB_MEAT_START,
    labMeatMax: LAB_MEAT_MAX,
    labMeatClickPulseUntil: 0,
    labMeatShortageUntil: 0,
    labMeatShortageWarned: false,
    gameOverReason: null,
    gameOverKind: null,
  };
}

export function setRoster(state: GameState, roster: NormieGuest[]): GameState {
  return {
    ...state,
    roster: roster.length > 0 ? roster : state.roster,
    log: pushLog(state.log, "Live and fallback guests are ready."),
  };
}

export function addGuestToRoster(
  state: GameState,
  guest: NormieGuest,
): GameState {
  const withoutExisting = state.roster.filter(
    (item) => item.tokenId !== guest.tokenId,
  );
  return {
    ...state,
    roster: [guest, ...withoutExisting],
    log: pushLog(state.log, `${guest.name} joined the guest book.`),
  };
}

export function startNextDay(state: GameState): GameState {
  const day = state.mode === "dayEnd" ? Math.min(FINAL_DAY, state.day + 1) : state.day;
  const dayDuration = Math.min(112, 76 + day * 5);
  const dayRoster = buildDayRoster(state.roster, day, Math.min(14, 6 + day));

  return {
    ...state,
    mode: "playing",
    paused: false,
    day,
    dayTime: 0,
    dayDuration,
    spawnTimer: 0,
    spawnIndex: 0,
    dayRoster,
    queue: [],
    services: [],
    selectedGuestId: null,
    served: 0,
    missed: 0,
    dayEndUpgradeChoiceMade: false,
    streak: 0,
    agentRushUntil: 0,
    alienCalibrationUntil: 0,
    labMeat: LAB_MEAT_START,
    labMeatMax: LAB_MEAT_MAX,
    labMeatClickPulseUntil: 0,
    labMeatShortageUntil: 0,
    labMeatShortageWarned: false,
    gameOverReason: null,
    gameOverKind: null,
    log: [`Day ${day}: doors open. Click a guest, then a station.`],
  };
}

function buildDayRoster(
  roster: NormieGuest[],
  day: number,
  count: number,
): NormieGuest[] {
  const pool = roster.length > 0 ? roster : FALLBACK_GUESTS;
  const priority = ["Human", "Zombie", "Cat", "Alien", "Agent"];
  const opening = priority
    .map((type) => pool.find((guest) => guest.type === type))
    .filter((guest): guest is NormieGuest => Boolean(guest));
  const ordered = [...opening];

  for (let index = 0; ordered.length < count; index += 1) {
    ordered.push(pool[(index + day) % pool.length]);
  }

  return ordered.slice(0, count);
}

export function advanceGame(state: GameState, ms: number): GameState {
  const steps = Math.max(1, Math.round(ms / (1000 / 30)));
  const stepMs = ms / steps;
  let next = state;

  for (let index = 0; index < steps; index += 1) {
    next = updateGame(next, stepMs);
  }

  return next;
}

export function updateGame(state: GameState, deltaMs: number): GameState {
  if (state.mode !== "playing" || state.paused) {
    return state;
  }

  let next = cloneState(state);
  const dt = deltaMs / 1000;
  next.dayTime += dt;
  next = drainLabMeat(next, dt);

  if (next.dayTime < next.dayDuration && next.spawnIndex < next.dayRoster.length) {
    next.spawnTimer -= dt;
    if (next.spawnTimer <= 0) {
      next = spawnNextGuest(next);
    }
  }

  const waitingGuests: GuestInstance[] = [];
  for (const guest of next.queue) {
    const updatedGuest = { ...guest, patience: guest.patience - dt };
    if (updatedGuest.patience > 0) {
      waitingGuests.push(updatedGuest);
    } else {
      next = applyMiss(next, updatedGuest);
    }
  }
  next.queue = waitingGuests;

  const remainingServices: ServiceJob[] = [];
  for (const service of next.services) {
    const updated = { ...service, remaining: service.remaining - dt };
    if (updated.remaining <= 0) {
      next = applyServiceComplete(next, updated);
    } else {
      remainingServices.push(updated);
    }
  }
  next.services = remainingServices;

  if (
    (next.dayTime >= next.dayDuration || next.spawnIndex >= next.dayRoster.length) &&
    next.queue.length === 0 &&
    next.services.length === 0
  ) {
    next.bestScore = Math.max(next.bestScore, next.score);
    if (next.day >= FINAL_DAY) {
      next.mode = "gameOver";
      next.gameOverReason = "You survived all 7 game-days. Dead and Breakfast lives.";
      next.gameOverKind = "won";
      next.log = pushLog(next.log, "Seven game-days survived. Service complete.");
    } else {
      next.mode = "dayEnd";
      next.dayEndUpgradeChoiceMade = false;
      next.log = pushLog(next.log, `Day ${next.day} closed. Buy upgrades.`);
    }
  }

  return maybeTriggerShortageWarning(next);
}

function spawnNextGuest(state: GameState): GameState {
  const maxQueue = 5 + state.upgrades.extraRooms;
  if (state.queue.length >= maxQueue) {
    return { ...state, spawnTimer: 1.5 };
  }

  if (shouldTakeArrivalLull(state.day, state.spawnIndex)) {
    return {
      ...state,
      spawnTimer: getArrivalLullSeconds(state.day, state.spawnIndex),
      log: pushLog(state.log, "The lobby goes quiet for a moment."),
    };
  }

  const difficulty = getDayDifficulty(state.day);
  const openSlots = maxQueue - state.queue.length;
  const remainingRoster = state.dayRoster.length - state.spawnIndex;
  const batchCount = Math.min(
    openSlots,
    remainingRoster,
    getSpawnBatchSize(state.day, state.spawnIndex),
  );
  const arrivals: GuestInstance[] = [];

  for (let offset = 0; offset < batchCount; offset += 1) {
    const guest = state.dayRoster[state.spawnIndex + offset];
    const patience = getScaledPatienceSeconds(guest.type, state.upgrades, state.day);
    arrivals.push({
      id: `g${state.nextGuestId + offset}`,
      guest,
      type: guest.type,
      patience,
      maxPatience: patience,
      arrivedAt: state.dayTime,
      serviceNote: getGuestRule(guest.type).serviceName,
    });
  }

  return {
    ...state,
    nextGuestId: state.nextGuestId + batchCount,
    spawnIndex: state.spawnIndex + batchCount,
    spawnTimer: getSpawnDelaySeconds(
      state.day,
      state.upgrades.agentTerminal,
      difficulty,
      state.spawnIndex + batchCount,
    ),
    queue: [...state.queue, ...arrivals],
    log: pushLog(
      state.log,
      batchCount === 1
        ? `${arrivals[0].guest.name} arrived as ${arrivals[0].type}.`
        : `${batchCount} guests arrived at once.`,
    ),
  };
}

export function inviteGuestNow(
  state: GameState,
  guest: NormieGuest,
): GameState {
  const withRoster = addGuestToRoster(state, { ...guest, source: "manual" });
  if (withRoster.mode !== "playing") {
    return withRoster;
  }

  const patience = getScaledPatienceSeconds(
    guest.type,
    withRoster.upgrades,
    withRoster.day,
  );
  const instance: GuestInstance = {
    id: `g${withRoster.nextGuestId}`,
    guest: { ...guest, source: "manual" },
    type: guest.type,
    patience,
    maxPatience: patience,
    arrivedAt: withRoster.dayTime,
    serviceNote: getGuestRule(guest.type).serviceName,
  };

  return {
    ...withRoster,
    nextGuestId: withRoster.nextGuestId + 1,
    queue: [instance, ...withRoster.queue].slice(0, 6 + withRoster.upgrades.extraRooms),
    log: pushLog(withRoster.log, `${guest.name} was invited right now.`),
  };
}

export function handleCanvasClick(
  state: GameState,
  x: number,
  y: number,
): GameState {
  if (state.mode === "menu") {
    return rectContains(OVERLAY_BUTTON_RECT, x, y) ? startNextDay(state) : state;
  }

  if (state.mode === "dayEnd") {
    return rectContains(OVERLAY_BUTTON_RECT, x, y) &&
      canStartNextDayFromDayEnd(state)
      ? startNextDay(state)
      : state;
  }

  if (state.mode === "shortageWarning") {
    return rectContains(OVERLAY_BUTTON_RECT, x, y)
      ? resolveShortageWarning(state)
      : state;
  }

  if (state.mode === "gameOver") {
    return rectContains(OVERLAY_BUTTON_RECT, x, y) ? restartGame(state) : state;
  }

  if (state.mode !== "playing") {
    return state;
  }

  const hit = hitTestCanvas(
    x,
    y,
    state.queue.map((guest) => guest.id),
  );

  if (hit.kind === "pause") {
    return togglePause(state);
  }

  if (state.paused) {
    return state;
  }

  if (hit.kind === "guest") {
    return {
      ...state,
      selectedGuestId: hit.guestId,
      log: pushLog(state.log, "Guest selected. Choose a station."),
    };
  }

  if (hit.kind === "labClicker") {
    return clickLabMeat(state);
  }

  if (hit.kind === "station" && state.selectedGuestId) {
    return startService(state, state.selectedGuestId, hit.stationId);
  }

  return state;
}

export function togglePause(state: GameState): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  return {
    ...state,
    paused: !state.paused,
    selectedGuestId: state.paused ? state.selectedGuestId : null,
    log: pushLog(state.log, state.paused ? "Service resumed." : "Service paused."),
  };
}

function startService(
  state: GameState,
  guestId: string,
  stationId: StationId,
): GameState {
  const guest = state.queue.find((item) => item.id === guestId);
  if (!guest) {
    return { ...state, selectedGuestId: null };
  }

  const activeCount = state.services.filter(
    (service) => service.stationId === stationId,
  ).length;
  const capacity = getEffectiveStationCapacity(stationId, state);
  if (activeCount >= capacity) {
    return {
      ...state,
      log: pushLog(state.log, "That station is full."),
    };
  }

  const correct = getGuestRule(guest.type).preferredStation === stationId;
  const service: ServiceJob = {
    id: `s${state.nextServiceId}`,
    guest: guest.guest,
    type: guest.type,
    stationId,
    total: getScaledServiceDurationSeconds(guest.type, stationId, state),
    remaining: 0,
    correct,
    startedAt: state.dayTime,
  };
  service.remaining = service.total;

  return {
    ...state,
    nextServiceId: state.nextServiceId + 1,
    queue: state.queue.filter((item) => item.id !== guestId),
    services: [...state.services, service],
    selectedGuestId: null,
    log: pushLog(
      state.log,
      `${guest.guest.name} sent to ${stationId}${correct ? "" : " (risky)"}.`,
    ),
  };
}

function drainLabMeat(state: GameState, dt: number): GameState {
  if (state.labMeat <= 0) {
    return { ...state, labMeat: 0 };
  }

  const regulatorMultiplier = Math.max(0.4, 1 - state.upgrades.patienceBoost * 0.18);
  const labMeat = Math.max(
    0,
    state.labMeat -
      dt *
        LAB_MEAT_DECAY_PER_SECOND *
        regulatorMultiplier *
        getDayDifficulty(state.day).labDrainMultiplier,
  );
  if (labMeat > 0) {
    return { ...state, labMeat };
  }

  return {
    ...state,
    mode: "shortageWarning",
    labMeat: 0,
    labMeatShortageUntil: state.dayTime + LAB_MEAT_FLASH_SECONDS,
    labMeatShortageWarned: true,
    log: pushLog(
      state.log,
      "OUT OF HUMAN LAB-GROWN MEAT. Human Suite closed; Cat chow space lost.",
    ),
  };
}

export function clickLabMeat(state: GameState): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  const wasOut = state.labMeat <= 0;
  const labMeat = Math.min(
    state.labMeatMax,
    Math.ceil(state.labMeat) + getLabMeatClickGain(state.day),
  );
  return {
    ...state,
    labMeat,
    labMeatShortageWarned: labMeat > 0 ? false : state.labMeatShortageWarned,
    labMeatClickPulseUntil: state.dayTime + LAB_MEAT_CLICK_PULSE_SECONDS,
    log: wasOut
      ? pushLog(state.log, "Lab-grown meat restored. Human and Cat rooms reopened.")
      : state.log,
  };
}

export function getLabMeatClickGain(day: number): number {
  if (day >= 7) return 1;
  if (day >= 6) return 1;
  return LAB_MEAT_CLICK_GAIN;
}

export function getEffectiveStationCapacity(
  stationId: StationId,
  state: GameState,
): number {
  const baseCapacity = getStationCapacity(stationId, state.upgrades);
  if (state.labMeat > 0) {
    return baseCapacity;
  }

  if (stationId === "suite") {
    return 0;
  }

  if (stationId === "fishery") {
    return Math.max(0, baseCapacity - 1);
  }

  return baseCapacity;
}

function applyServiceComplete(
  state: GameState,
  service: ServiceJob,
): GameState {
  const patienceRatio = Math.max(
    0.1,
    1 - (state.dayTime - service.startedAt) / Math.max(1, service.total + 8),
  );
  const outcome = serviceOutcome(
    service.type,
    service.correct,
    patienceRatio,
    state.upgrades,
    { hasHumanNearby: hasHumanNearby(state) },
  );

  return {
    ...state,
    coins: Math.max(0, state.coins + outcome.coins),
    reputation: Math.max(0, state.reputation + outcome.reputation),
    score: Math.max(0, state.score + outcome.score + state.streak * 5),
    streak: service.correct ? state.streak + 1 : 0,
    served: state.served + 1,
    agentRushUntil:
      outcome.effects.agentRushSeconds > 0
        ? state.dayTime + outcome.effects.agentRushSeconds
        : state.agentRushUntil,
    alienCalibrationUntil:
      outcome.effects.alienCalibrationSeconds > 0
        ? state.dayTime + outcome.effects.alienCalibrationSeconds
        : state.alienCalibrationUntil,
    log: pushLog(state.log, outcome.notes[0]),
  };
}

function applyMiss(state: GameState, guest: GuestInstance): GameState {
  const outcome = missOutcome(guest.type, { hasHumanNearby: hasHumanNearby(state) });
  return {
    ...state,
    reputation: Math.max(0, state.reputation + outcome.reputation),
    score: Math.max(0, state.score + outcome.score),
    streak: 0,
    missed: state.missed + 1,
    selectedGuestId:
      state.selectedGuestId === guest.id ? null : state.selectedGuestId,
    log: pushLog(state.log, outcome.notes[0]),
  };
}

function hasHumanNearby(state: GameState): boolean {
  return (
    state.queue.some((guest) => guest.type === "Human") ||
    state.services.some((service) => service.type === "Human")
  );
}

function hasUnsafeHumanOutOfRoom(state: GameState): boolean {
  return (
    state.queue.some((guest) => guest.type === "Human") ||
    state.services.some(
      (service) => service.type === "Human" && service.stationId !== "suite",
    )
  );
}

function maybeTriggerShortageWarning(state: GameState): GameState {
  if (state.mode !== "playing" || state.labMeat > 0) {
    return state;
  }

  if (hasUnsafeHumanOutOfRoom(state) || !state.labMeatShortageWarned) {
    return {
      ...state,
      mode: "shortageWarning",
      labMeatShortageWarned: true,
      labMeatShortageUntil: Math.max(
        state.labMeatShortageUntil,
        state.dayTime + LAB_MEAT_FLASH_SECONDS,
      ),
      log: pushLog(state.log, SHORTAGE_WARNING),
    };
  }

  return state;
}

function resolveShortageWarning(state: GameState): GameState {
  if (hasUnsafeHumanOutOfRoom(state)) {
    return {
      ...state,
      mode: "gameOver",
      paused: false,
      selectedGuestId: null,
      bestScore: Math.max(state.bestScore, state.score),
      gameOverReason:
        "A Human was out of their Safe Suite during the meat shortage.",
      gameOverKind: "lost",
      log: pushLog(state.log, "GAME OVER: A Human was out of their Safe Suite."),
    };
  }

  return {
    ...state,
    mode: "playing",
    paused: false,
    log: pushLog(state.log, "Warning acknowledged. Keep Humans in their Safe Suite."),
  };
}

function restartGame(state: GameState): GameState {
  return createGameState(state.roster, {
    version: 1,
    day: 1,
    coins: 24,
    reputation: 10,
    bestScore: state.bestScore,
    upgrades: createDefaultUpgrades(),
    discoveredTokenIds: state.roster
      .filter((guest) => guest.source === "api" || guest.source === "manual")
      .map((guest) => guest.tokenId),
    settings: { reducedMotion: false },
    savedAt: new Date().toISOString(),
  });
}

export function getDayDifficulty(day: number): DayDifficulty {
  const cappedDay = Math.min(FINAL_DAY, day);
  const extraDay = Math.max(0, cappedDay - 5);

  if (cappedDay <= 2) {
    return {
      spawnMultiplier: 1,
      minSpawnSeconds: 3.4,
      patienceMultiplier: 1,
      serviceMultiplier: 1,
      labDrainMultiplier: 1,
    };
  }

  if (cappedDay === 3) {
    return {
      spawnMultiplier: 0.9,
      minSpawnSeconds: 3.1,
      patienceMultiplier: 0.94,
      serviceMultiplier: 0.95,
      labDrainMultiplier: 1.12,
    };
  }

  if (cappedDay === 4) {
    return {
      spawnMultiplier: 0.82,
      minSpawnSeconds: 2.85,
      patienceMultiplier: 0.88,
      serviceMultiplier: 0.91,
      labDrainMultiplier: 1.22,
    };
  }

  if (cappedDay === 6) {
    return {
      spawnMultiplier: 0.7,
      minSpawnSeconds: 2.45,
      patienceMultiplier: 0.8,
      serviceMultiplier: 0.86,
      labDrainMultiplier: 1.72,
    };
  }

  if (cappedDay >= 7) {
    return {
      spawnMultiplier: 0.64,
      minSpawnSeconds: 2.25,
      patienceMultiplier: 0.74,
      serviceMultiplier: 0.82,
      labDrainMultiplier: 2.05,
    };
  }

  return {
    spawnMultiplier: Math.max(0.68, 0.76 - extraDay * 0.03),
    minSpawnSeconds: Math.max(2.4, 2.65 - extraDay * 0.08),
    patienceMultiplier: Math.max(0.76, 0.84 - extraDay * 0.02),
    serviceMultiplier: Math.max(0.84, 0.88 - extraDay * 0.015),
    labDrainMultiplier: Math.min(1.48, 1.32 + extraDay * 0.04),
  };
}

function getSpawnDelaySeconds(
  day: number,
  agentTerminalLevel: number,
  difficulty = getDayDifficulty(day),
  spawnIndex = 0,
): number {
  const baseDelay = 7.2 - day * 0.25 - agentTerminalLevel * 0.4;
  const jitter =
    day <= 2 ? 1 : 0.72 + pseudoRandom01(day, spawnIndex, 23) * (0.24 + day * 0.055);
  return Number(
    Math.max(
      difficulty.minSpawnSeconds,
      baseDelay * difficulty.spawnMultiplier * jitter,
    ).toFixed(2),
  );
}

export function getSpawnBatchSize(day: number, spawnIndex: number): number {
  if (day <= 2) return 1;
  const roll = pseudoRandom01(day, spawnIndex, 11);
  if (day >= 6) {
    if (roll > 0.78) return 3;
    if (roll > 0.38) return 2;
    return 1;
  }
  if (day >= 4) {
    return roll > 0.54 ? 2 : 1;
  }
  return roll > 0.72 ? 2 : 1;
}

function shouldTakeArrivalLull(day: number, spawnIndex: number): boolean {
  if (day < 3 || spawnIndex === 0) return false;
  const threshold = day >= 6 ? 0.34 : day >= 4 ? 0.22 : 0.12;
  return pseudoRandom01(day, spawnIndex, 41) < threshold;
}

function getArrivalLullSeconds(day: number, spawnIndex: number): number {
  return Number((1.8 + day * 0.34 + pseudoRandom01(day, spawnIndex, 59) * 3.4).toFixed(2));
}

function pseudoRandom01(day: number, spawnIndex: number, salt: number): number {
  const value = Math.sin(day * 129.9721 + spawnIndex * 37.719 + salt * 11.131) * 10000;
  return value - Math.floor(value);
}

function getScaledPatienceSeconds(
  type: GuestInstance["type"],
  upgrades: GameState["upgrades"],
  day: number,
): number {
  return Number(
    Math.max(
      8,
      getPatienceSeconds(type, upgrades) * getDayDifficulty(day).patienceMultiplier,
    ).toFixed(2),
  );
}

function getScaledServiceDurationSeconds(
  type: GuestInstance["type"],
  stationId: StationId,
  state: GameState,
): number {
  const duration = getServiceDurationSeconds(type, stationId, state.upgrades, {
    agentRushActive: state.agentRushUntil > state.dayTime,
    alienCalibrationActive: state.alienCalibrationUntil > state.dayTime,
  });

  return Number(
    Math.max(1.9, duration * getDayDifficulty(state.day).serviceMultiplier).toFixed(2),
  );
}

export function buyUpgrade(
  state: GameState,
  upgradeId: keyof GameState["upgrades"],
): GameState {
  const def = UPGRADE_DEFS.find((item) => item.id === upgradeId);
  if (!def) return state;

  const currentLevel = state.upgrades[upgradeId];
  if (currentLevel >= def.maxLevel) {
    return { ...state, log: pushLog(state.log, `${def.label} is maxed.`) };
  }

  const cost = getUpgradeCost(def, currentLevel);
  if (state.coins < cost) {
    return { ...state, log: pushLog(state.log, `Need ${cost} coins.`) };
  }

  return {
    ...state,
    coins: state.coins - cost,
    dayEndUpgradeChoiceMade:
      state.mode === "dayEnd" ? true : state.dayEndUpgradeChoiceMade,
    upgrades: {
      ...state.upgrades,
      [upgradeId]: currentLevel + 1,
    },
    log: pushLog(state.log, `${def.label} upgraded.`),
  };
}

export function hasAffordableUpgrade(state: GameState): boolean {
  return UPGRADE_DEFS.some((def) => {
    const level = state.upgrades[def.id];
    return level < def.maxLevel && state.coins >= getUpgradeCost(def, level);
  });
}

export function canStartNextDayFromDayEnd(state: GameState): boolean {
  return state.dayEndUpgradeChoiceMade || !hasAffordableUpgrade(state);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    upgrades: { ...state.upgrades },
    dayRoster: [...state.dayRoster],
    roster: [...state.roster],
    queue: state.queue.map((guest) => ({ ...guest })),
    services: state.services.map((service) => ({ ...service })),
    log: [...state.log],
  };
}

function pushLog(log: string[], message: string): string[] {
  return [message, ...log].slice(0, MAX_LOG_LINES);
}

export function renderGameToText(state: GameState): string {
  return JSON.stringify({
    coordinateSystem:
      "Canvas origin is top-left; x increases right and y increases down.",
    mode: state.mode,
    paused: state.paused,
    gameOverKind: state.gameOverKind,
    gameOverReason: state.gameOverReason,
    day: state.day,
    dayTime: Number(state.dayTime.toFixed(1)),
    resources: {
      coins: state.coins,
      reputation: state.reputation,
      score: state.score,
      bestScore: state.bestScore,
      streak: state.streak,
    },
    dayEndUpgradeChoiceMade: state.dayEndUpgradeChoiceMade,
    canStartNextDay:
      state.mode === "dayEnd" ? canStartNextDayFromDayEnd(state) : undefined,
    selectedGuestId: state.selectedGuestId,
    queue: state.queue.map((guest) => ({
      id: guest.id,
      tokenId: guest.guest.tokenId,
      type: guest.type,
      patience: Number(guest.patience.toFixed(1)),
      maxPatience: Number(guest.maxPatience.toFixed(1)),
      service: guest.serviceNote,
    })),
    services: state.services.map((service) => ({
      id: service.id,
      tokenId: service.guest.tokenId,
      type: service.type,
      stationId: service.stationId,
      remaining: Number(service.remaining.toFixed(1)),
      correct: service.correct,
    })),
    effects: {
      agentRushActive: state.agentRushUntil > state.dayTime,
      alienCalibrationActive: state.alienCalibrationUntil > state.dayTime,
    },
    labMeat: {
      amount: Number(state.labMeat.toFixed(1)),
      displayAmount: Math.ceil(state.labMeat),
      max: state.labMeatMax,
      shortageActive: state.labMeat <= 0,
      shortageFlashActive: state.labMeatShortageUntil > state.dayTime,
      shortageWarned: state.labMeatShortageWarned,
      clickGain: getLabMeatClickGain(state.day),
    },
    log: state.log.slice(0, 3),
  });
}
