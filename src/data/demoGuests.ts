import type { NormieGuest } from "../types";
import { FALLBACK_IMAGE_URL_BY_TYPE } from "./fallbackImages";

export const VERIFIED_SEED_IDS = [9009, 0, 3295, 9999, 133];

export const FALLBACK_GUESTS: NormieGuest[] = [
  {
    tokenId: 9009,
    name: "Normie #9009",
    type: "Zombie",
    imageUrl: FALLBACK_IMAGE_URL_BY_TYPE.Zombie,
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
    imageUrl: FALLBACK_IMAGE_URL_BY_TYPE.Human,
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
    imageUrl: FALLBACK_IMAGE_URL_BY_TYPE.Alien,
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
    imageUrl: FALLBACK_IMAGE_URL_BY_TYPE.Agent,
    traits: [{ trait_type: "Type", value: "Agent" }],
    level: 1,
    actionPoints: 0,
    customized: false,
    source: "fallback",
  },
  {
    tokenId: 133,
    name: "Normie #133",
    type: "Cat",
    imageUrl: FALLBACK_IMAGE_URL_BY_TYPE.Cat,
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
