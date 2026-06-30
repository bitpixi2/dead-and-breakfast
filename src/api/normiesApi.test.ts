import { describe, expect, it, vi } from "vitest";
import {
  fetchNormieGuest,
  logGameCompletion,
  logNormieEntry,
  mergeRoster,
  normalizeNormieMetadata,
} from "./normiesApi";
import { FALLBACK_GUESTS } from "../data/demoGuests";

describe("Normies API normalization", () => {
  it("uses metadata Type so Zombie Canvas state is visible", () => {
    const guest = normalizeNormieMetadata(9009, {
      name: "Normie #9009",
      attributes: [
        { trait_type: "Type", value: "Zombie" },
        { trait_type: "Action Points", value: 81 },
        { trait_type: "Level", value: 9 },
        { trait_type: "Customized", value: "Yes" },
      ],
    });

    expect(guest.type).toBe("Zombie");
    expect(guest.customized).toBe(true);
    expect(guest.actionPoints).toBe(81);
    expect(guest.imageUrl).toBe("https://api.normies.art/normie/9009/image.svg");
  });

  it("maps unknown future types to Unknown without crashing", () => {
    const guest = normalizeNormieMetadata(123, {
      attributes: [{ trait_type: "Type", value: "Vampire" }],
    });

    expect(guest.type).toBe("Unknown");
  });

  it("fetches metadata with injected fetch and caches the result", async () => {
    const storage = window.localStorage;
    storage.clear();
    const fetcher = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          name: "Normie #12",
          attributes: [{ trait_type: "Type", value: "Agent" }],
        }),
      } as Response;
    });

    const first = await fetchNormieGuest(12, {
      fetcher,
      storage,
      now: () => 1000,
    });
    const second = await fetchNormieGuest(12, {
      fetcher,
      storage,
      now: () => 1500,
    });

    expect(first.type).toBe("Agent");
    expect(second.type).toBe("Agent");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps fallback cat in a merged roster", () => {
    const merged = mergeRoster([FALLBACK_GUESTS[0]], FALLBACK_GUESTS);

    expect(merged.some((guest) => guest.type === "Cat")).toBe(true);
    expect(merged.some((guest) => guest.type === "Zombie")).toBe(true);
  });

  it("uses saved monochrome Normie assets for fallback guests", () => {
    const types = new Set(FALLBACK_GUESTS.map((guest) => guest.type));
    const cat = FALLBACK_GUESTS.find((guest) => guest.type === "Cat");

    expect(types).toEqual(new Set(["Zombie", "Human", "Alien", "Agent", "Cat"]));
    expect(cat?.tokenId).toBe(133);
    expect(cat?.imageUrl).toContain("fallback-cat");
    expect(cat?.imageUrl.startsWith("data:image/svg+xml")).toBe(false);
  });

  it("logs entered token IDs through the backend endpoint", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          tokenId: 2613,
          owner: "0xb7d3a787a39f25457ca511dc3f0591b546f5e02f",
          type: "Human",
          enteredAt: "2026-06-30T00:00:00.000Z",
        }),
      } as Response;
    });

    const result = await logNormieEntry(2613, { fetcher });

    expect(result.owner).toBe("0xb7d3a787a39f25457ca511dc3f0591b546f5e02f");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/normie-entry",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tokenId: 2613 }),
      }),
    );
  });

  it("logs 7-day completion wallet claims through the backend endpoint", async () => {
    const fetcher = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          walletAddress: "0xb7d3a787a39f25457ca511dc3f0591b546f5e02f",
          completedAt: "2026-07-01T00:00:00.000Z",
        }),
      } as Response;
    });
    const payload = {
      walletAddress: "0xB7D3A787A39F25457CA511DC3F0591B546F5E02F",
      score: 1200,
      coins: 44,
      served: 15,
      missed: 2,
    };

    const result = await logGameCompletion(payload, { fetcher });

    expect(result.walletAddress).toBe(
      "0xb7d3a787a39f25457ca511dc3f0591b546f5e02f",
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/game-completion",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });
});
