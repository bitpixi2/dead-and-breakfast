import { describe, expect, it, vi } from "vitest";
import {
  fetchNormieGuest,
  mergeRoster,
  normalizeNormieMetadata,
} from "./normiesApi";
import { FALLBACK_GUESTS } from "./data/demoGuests";

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
});
