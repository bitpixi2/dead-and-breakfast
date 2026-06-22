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

export function createGameState(
  roster: NormieGuest[] = FALLBACK_GUESTS,
  save: GameSaveV1,
): GameState {
  return {
    mode: "menu",
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
    upgrades: { ...save.upgrades },
    log: [
      "Dead and Breakfast is open.",
      "Serve every type well. No wallet required.",
    ],
    agentRushUntil: 0,
    alienCalibrationUntil: 0,
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
  const day = state.mode === "dayEnd" ? state.day + 1 : state.day;
  const dayDuration = Math.min(112, 76 + day * 5);
  const dayRoster = buildDayRoster(state.roster, day, Math.min(14, 6 + day));

  return {
    ...state,
    mode: "playing",
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
    streak: 0,
    agentRushUntil: 0,
    alienCalibrationUntil: 0,
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
  if (state.mode !== "playing") {
    return state;
  }

  let next = cloneState(state);
  const dt = deltaMs / 1000;
  next.dayTime += dt;

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
    next.mode = "dayEnd";
    next.bestScore = Math.max(next.bestScore, next.score);
    next.log = pushLog(next.log, `Day ${next.day} closed. Buy upgrades.`);
  }

  return next;
}

function spawnNextGuest(state: GameState): GameState {
  const maxQueue = 5 + state.upgrades.extraRooms;
  if (state.queue.length >= maxQueue) {
    return { ...state, spawnTimer: 1.5 };
  }

  const guest = state.dayRoster[state.spawnIndex];
  const patience = getPatienceSeconds(guest.type, state.upgrades);
  const instance: GuestInstance = {
    id: `g${state.nextGuestId}`,
    guest,
    type: guest.type,
    patience,
    maxPatience: patience,
    arrivedAt: state.dayTime,
    serviceNote: getGuestRule(guest.type).serviceName,
  };

  return {
    ...state,
    nextGuestId: state.nextGuestId + 1,
    spawnIndex: state.spawnIndex + 1,
    spawnTimer: Math.max(3.4, 7.2 - state.day * 0.25 - state.upgrades.agentTerminal * 0.4),
    queue: [...state.queue, instance],
    log: pushLog(state.log, `${guest.name} arrived as ${guest.type}.`),
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

  const patience = getPatienceSeconds(guest.type, withRoster.upgrades);
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
    return rectContains(OVERLAY_BUTTON_RECT, x, y) ? startNextDay(state) : state;
  }

  if (state.mode !== "playing") {
    return state;
  }

  const hit = hitTestCanvas(
    x,
    y,
    state.queue.map((guest) => guest.id),
  );

  if (hit.kind === "guest") {
    return {
      ...state,
      selectedGuestId: hit.guestId,
      log: pushLog(state.log, "Guest selected. Choose a station."),
    };
  }

  if (hit.kind === "station" && state.selectedGuestId) {
    return startService(state, state.selectedGuestId, hit.stationId);
  }

  return state;
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
  const capacity = getStationCapacity(stationId, state.upgrades);
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
    total: getServiceDurationSeconds(guest.type, stationId, state.upgrades, {
      agentRushActive: state.agentRushUntil > state.dayTime,
      alienCalibrationActive: state.alienCalibrationUntil > state.dayTime,
    }),
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
    upgrades: {
      ...state.upgrades,
      [upgradeId]: currentLevel + 1,
    },
    log: pushLog(state.log, `${def.label} upgraded.`),
  };
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
    day: state.day,
    dayTime: Number(state.dayTime.toFixed(1)),
    resources: {
      coins: state.coins,
      reputation: state.reputation,
      score: state.score,
      bestScore: state.bestScore,
      streak: state.streak,
    },
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
    log: state.log.slice(0, 3),
  });
}
