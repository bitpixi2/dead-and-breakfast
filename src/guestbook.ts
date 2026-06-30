import type { CanvasStats, GameState } from "./types";

const FINAL_GUESTBOOK_DAY = 7;

export interface GuestbookEntry {
  id: number;
  quote: string;
  signature: string;
}

export const FALLBACK_GUESTBOOK_STATS: CanvasStats = {
  totalBurnCommitments: 900,
  totalBurnedTokens: 2603,
  totalTransforms: 1103,
  totalTokenData: 10000,
  totalZombies: 21,
  totalLegendaryCanvases: 7,
  totalActionPointsDistributed: "40776",
};

function formatCount(value: number | string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : String(value);
}

function resolveStats(stats: CanvasStats | null): CanvasStats {
  return stats ?? FALLBACK_GUESTBOOK_STATS;
}

function clampCompletedDays(days: number): number {
  return Math.max(0, Math.min(FINAL_GUESTBOOK_DAY, days));
}

export function getCompletedGuestbookDays(state: GameState): number {
  if (state.mode === "gameOver" && state.gameOverKind === "won") {
    return FINAL_GUESTBOOK_DAY;
  }

  if (state.mode === "dayEnd") {
    return clampCompletedDays(state.day);
  }

  return clampCompletedDays(state.day - 1);
}

export function buildGuestbookEntries(
  stats: CanvasStats | null,
): GuestbookEntry[] {
  const resolved = resolveStats(stats);

  return [
    {
      id: 1,
      quote: `I heard as of June 30, 2026, ${formatCount(
        resolved.totalBurnedTokens,
      )} Normies had been burned. That stressed me out, so I checked into D&B for a quiet breakfast.`,
      signature: "Normie #5652",
    },
    {
      id: 2,
      quote: `Someone told me there are only ${formatCount(
        resolved.totalZombies,
      )} Zombies in the live Canvas data. I asked for the room farthest from the kitchen anyway.`,
      signature: "Normie #2613",
    },
    {
      id: 3,
      quote: `The Agents said ${formatCount(
        resolved.totalTransforms,
      )} Canvas transforms had already happened. I nodded like I understood and ordered punctual room service.`,
      signature: "Normie #9999",
    },
    {
      id: 4,
      quote:
        "An Alien calibrated the meat machine during breakfast. The eggs were cold, but the bioreactor was extremely respectful.",
      signature: "Normie #3295",
    },
    {
      id: 5,
      quote:
        "The Cat chow tasted suspiciously like ocean scraps. Honestly? Five stars. No Humans were sniffed.",
      signature: "Normie #133",
    },
    {
      id: 6,
      quote: `I saw ${formatCount(
        resolved.totalBurnCommitments,
      )} burn commitments in the ledger and immediately extended my stay by one night.`,
      signature: "Normie #4663",
    },
    {
      id: 7,
      quote: `After ${formatCount(
        resolved.totalActionPointsDistributed,
      )} action points moved through the Canvas, D&B still had clean sheets, safe Humans, fed Zombies, and no wallet pop-up.`,
      signature: "Normie #3636",
    },
  ];
}

export function getVisibleGuestbookEntries(
  state: GameState,
  stats: CanvasStats | null,
): GuestbookEntry[] {
  return buildGuestbookEntries(stats).slice(0, getCompletedGuestbookDays(state));
}
