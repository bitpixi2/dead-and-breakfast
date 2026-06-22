import type { NormieGuest } from "../types";

export const VERIFIED_SEED_IDS = [9009, 0, 3295, 9999];

function svgDataUrl(label: string, fill: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 40 40" shape-rendering="crispEdges"><rect width="40" height="40" fill="${fill}"/><rect x="7" y="8" width="26" height="22" fill="${accent}"/><rect x="10" y="11" width="5" height="5" fill="${fill}"/><rect x="25" y="11" width="5" height="5" fill="${fill}"/><rect x="13" y="23" width="14" height="3" fill="${fill}"/><rect x="11" y="31" width="18" height="3" fill="${accent}"/><text x="20" y="38" text-anchor="middle" font-family="monospace" font-size="5" fill="${accent}">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const FALLBACK_GUESTS: NormieGuest[] = [
  {
    tokenId: 9009,
    name: "Normie #9009",
    type: "Zombie",
    imageUrl: "https://api.normies.art/normie/9009/image.svg",
    traits: [{ trait_type: "Type", value: "Zombie" }],
    level: 9,
    actionPoints: 81,
    customized: true,
    source: "fallback",
  },
  {
    tokenId: 0,
    name: "Normie #0",
    type: "Human",
    imageUrl: "https://api.normies.art/normie/0/image.svg",
    traits: [{ trait_type: "Type", value: "Human" }],
    level: 119,
    actionPoints: 1188,
    customized: false,
    source: "fallback",
  },
  {
    tokenId: 3295,
    name: "Normie #3295",
    type: "Alien",
    imageUrl: "https://api.normies.art/normie/3295/image.svg",
    traits: [{ trait_type: "Type", value: "Alien" }],
    level: 1,
    actionPoints: 4,
    customized: false,
    source: "fallback",
  },
  {
    tokenId: 9999,
    name: "Normie #9999",
    type: "Agent",
    imageUrl: "https://api.normies.art/normie/9999/image.svg",
    traits: [{ trait_type: "Type", value: "Agent" }],
    level: 1,
    actionPoints: 0,
    customized: false,
    source: "fallback",
  },
  {
    tokenId: 1042,
    name: "Harbor Cat #1042",
    type: "Cat",
    imageUrl: svgDataUrl("CAT", "#eaf7f3", "#386f63"),
    traits: [
      { trait_type: "Type", value: "Cat" },
      { trait_type: "Accessory", value: "Fishbone Bell" },
    ],
    level: 1,
    actionPoints: 0,
    customized: false,
    source: "fallback",
  },
];
