import type { NormieType } from "../types";
import fallbackAgentUrl from "../assets/fallback-agent.svg";
import fallbackAlienUrl from "../assets/fallback-alien.svg";
import fallbackCatUrl from "../assets/fallback-cat.svg";
import fallbackHumanUrl from "../assets/fallback-human.svg";
import fallbackZombieUrl from "../assets/fallback-zombie.svg";

export const FALLBACK_IMAGE_URL_BY_TYPE: Record<NormieType, string> = {
  Agent: fallbackAgentUrl,
  Alien: fallbackAlienUrl,
  Cat: fallbackCatUrl,
  Human: fallbackHumanUrl,
  Zombie: fallbackZombieUrl,
  Unknown: fallbackHumanUrl,
};

export const FALLBACK_IMAGE_URLS = Object.values(FALLBACK_IMAGE_URL_BY_TYPE);
