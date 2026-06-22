import { FALLBACK_GUESTS, VERIFIED_SEED_IDS } from "./data/demoGuests";
import { normalizeNormieType } from "./game/rules";
import type { CanvasStats, NormieGuest, NormieTrait } from "./types";

const API_BASE = "https://api.normies.art";
const GUEST_CACHE_PREFIX = "dead-and-breakfast:normie:";
const STATS_CACHE_KEY = "dead-and-breakfast:stats";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type FetchLike = typeof fetch;

interface NormieMetadata {
  name?: string;
  attributes?: NormieTrait[];
}

interface BurnCommitment {
  receiverTokenId?: string;
}

export interface ApiLoadResult {
  guests: NormieGuest[];
  stats: CanvasStats | null;
  status: "live" | "partial" | "fallback";
  message: string;
}

export interface NormiesClientOptions {
  fetcher?: FetchLike;
  storage?: Storage | null;
  now?: () => number;
}

export function normalizeNormieMetadata(
  tokenId: number,
  metadata: NormieMetadata,
  source: NormieGuest["source"] = "api",
): NormieGuest {
  const attributes = Array.isArray(metadata.attributes)
    ? metadata.attributes
    : [];
  const typeAttribute = attributes.find(
    (attribute) => attribute.trait_type === "Type",
  );
  const level = readNumberTrait(attributes, "Level");
  const actionPoints = readNumberTrait(attributes, "Action Points");
  const customized = attributes.some(
    (attribute) =>
      attribute.trait_type === "Customized" &&
      String(attribute.value).toLowerCase() === "yes",
  );

  return {
    tokenId,
    name: metadata.name || `Normie #${tokenId}`,
    type: normalizeNormieType(typeAttribute?.value),
    imageUrl: `${API_BASE}/normie/${tokenId}/image.svg`,
    traits: attributes,
    level,
    actionPoints,
    customized,
    source,
  };
}

function readNumberTrait(attributes: NormieTrait[], traitType: string): number {
  const attribute = attributes.find((item) => item.trait_type === traitType);
  const numericValue = Number(attribute?.value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function fetchJson<T>(
  url: string,
  options: NormiesClientOptions,
  timeoutMs = 6500,
): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Normies API returned ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function readCached<T>(
  key: string,
  storage: Storage | null | undefined,
  now: number,
): T | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { savedAt: number; value: T };
    if (now - cached.savedAt > CACHE_TTL_MS) return null;
    return cached.value;
  } catch {
    return null;
  }
}

function writeCached<T>(
  key: string,
  value: T,
  storage: Storage | null | undefined,
  now: number,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, value }));
  } catch {
    // Cache failures are non-fatal.
  }
}

export async function fetchNormieGuest(
  tokenId: number,
  options: NormiesClientOptions = {},
): Promise<NormieGuest> {
  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
    throw new Error("Token ID must be an integer from 0 to 9999.");
  }

  const storage =
    options.storage === undefined && typeof localStorage !== "undefined"
      ? localStorage
      : options.storage;
  const clientOptions = { ...options, storage };
  const now = clientOptions.now?.() ?? Date.now();
  const cacheKey = `${GUEST_CACHE_PREFIX}${tokenId}`;
  const cached = readCached<NormieGuest>(cacheKey, storage, now);
  if (cached) {
    return cached;
  }

  const metadata = await fetchJson<NormieMetadata>(
    `${API_BASE}/normie/${tokenId}/metadata`,
    clientOptions,
  );
  const guest = normalizeNormieMetadata(tokenId, metadata, "api");
  writeCached(cacheKey, guest, storage, now);
  return guest;
}

export async function fetchCanvasStats(
  options: NormiesClientOptions = {},
): Promise<CanvasStats> {
  const storage =
    options.storage === undefined && typeof localStorage !== "undefined"
      ? localStorage
      : options.storage;
  const now = options.now?.() ?? Date.now();
  const cached = readCached<CanvasStats>(STATS_CACHE_KEY, storage, now);
  if (cached) {
    return cached;
  }

  const stats = await fetchJson<CanvasStats>(
    `${API_BASE}/history/stats`,
    { ...options, storage },
  );
  writeCached(STATS_CACHE_KEY, stats, storage, now);
  return stats;
}

async function fetchBurnCandidateIds(
  options: NormiesClientOptions,
): Promise<number[]> {
  const burns = await fetchJson<BurnCommitment[]>(
    `${API_BASE}/history/burns?limit=8&offset=0`,
    options,
  );

  return burns
    .map((burn) => Number(burn.receiverTokenId))
    .filter((id) => Number.isInteger(id) && id >= 0 && id <= 9999);
}

export async function loadStarterRoster(
  options: NormiesClientOptions = {},
): Promise<ApiLoadResult> {
  const storage =
    options.storage === undefined && typeof localStorage !== "undefined"
      ? localStorage
      : options.storage;
  const clientOptions = { ...options, storage };
  const errors: string[] = [];
  let stats: CanvasStats | null = null;
  let burnIds: number[] = [];

  try {
    stats = await fetchCanvasStats(clientOptions);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Stats unavailable");
  }

  try {
    burnIds = await fetchBurnCandidateIds(clientOptions);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Burns unavailable");
  }

  const ids = Array.from(new Set([...VERIFIED_SEED_IDS, ...burnIds])).slice(
    0,
    8,
  );
  const guests: NormieGuest[] = [];

  for (const tokenId of ids) {
    try {
      guests.push(await fetchNormieGuest(tokenId, clientOptions));
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `#${tokenId}: ${error.message}`
          : `#${tokenId}: unavailable`,
      );
    }
  }

  const merged = mergeRoster(guests, FALLBACK_GUESTS);
  const status =
    guests.length >= 4 && stats
      ? "live"
      : guests.length > 0 || stats
        ? "partial"
        : "fallback";

  return {
    guests: merged,
    stats,
    status,
    message:
      status === "live"
        ? "Live Normies API roster loaded."
        : `Using ${status} roster. ${errors.slice(0, 2).join(" ")}`,
  };
}

export function mergeRoster(
  primary: NormieGuest[],
  fallback: NormieGuest[] = FALLBACK_GUESTS,
): NormieGuest[] {
  const byType = new Map<string, NormieGuest>();
  const byToken = new Map<number, NormieGuest>();

  for (const guest of [...primary, ...fallback]) {
    if (!byToken.has(guest.tokenId)) {
      byToken.set(guest.tokenId, guest);
    }

    if (!byType.has(guest.type)) {
      byType.set(guest.type, guest);
    }
  }

  const orderedTypes = ["Zombie", "Human", "Alien", "Agent", "Cat", "Unknown"];
  const ordered = orderedTypes
    .map((type) => byType.get(type))
    .filter((guest): guest is NormieGuest => Boolean(guest));

  for (const guest of byToken.values()) {
    if (!ordered.some((item) => item.tokenId === guest.tokenId)) {
      ordered.push(guest);
    }
  }

  return ordered;
}
