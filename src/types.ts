export type NormieType =
  | "Human"
  | "Zombie"
  | "Alien"
  | "Agent"
  | "Cat"
  | "Unknown";

export type StationId =
  | "suite"
  | "bioreactor"
  | "cleanRoom"
  | "frontDesk"
  | "fishery";

export type GameMode = "menu" | "playing" | "dayEnd";

export interface NormieTrait {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

export interface NormieGuest {
  tokenId: number;
  name: string;
  type: NormieType;
  imageUrl: string;
  traits: NormieTrait[];
  level: number;
  actionPoints: number;
  customized: boolean;
  source: "api" | "fallback" | "manual";
}

export interface CanvasStats {
  totalBurnCommitments: number;
  totalBurnedTokens: number;
  totalTransforms: number;
  totalTokenData: number;
  totalZombies: number;
  totalLegendaryCanvases: number;
  totalActionPointsDistributed: string;
}

export interface UpgradeLevels {
  bioreactorSpeed: number;
  extraRooms: number;
  oceanLine: number;
  scrapChowStation: number;
  alienCleanRoom: number;
  agentTerminal: number;
  patienceBoost: number;
  vipBell: number;
}

export interface GuestInstance {
  id: string;
  guest: NormieGuest;
  type: NormieType;
  patience: number;
  maxPatience: number;
  arrivedAt: number;
  serviceNote: string;
}

export interface ServiceJob {
  id: string;
  guest: NormieGuest;
  type: NormieType;
  stationId: StationId;
  remaining: number;
  total: number;
  correct: boolean;
  startedAt: number;
}

export interface GameState {
  mode: GameMode;
  paused: boolean;
  day: number;
  dayTime: number;
  dayDuration: number;
  spawnTimer: number;
  spawnIndex: number;
  nextGuestId: number;
  nextServiceId: number;
  dayRoster: NormieGuest[];
  roster: NormieGuest[];
  queue: GuestInstance[];
  services: ServiceJob[];
  selectedGuestId: string | null;
  coins: number;
  reputation: number;
  score: number;
  bestScore: number;
  streak: number;
  served: number;
  missed: number;
  dayEndUpgradeChoiceMade: boolean;
  upgrades: UpgradeLevels;
  log: string[];
  agentRushUntil: number;
  alienCalibrationUntil: number;
  labMeat: number;
  labMeatMax: number;
  labMeatClickPulseUntil: number;
  labMeatShortageUntil: number;
}

export interface GameSaveV1 {
  version: 1;
  day: number;
  coins: number;
  reputation: number;
  bestScore: number;
  upgrades: UpgradeLevels;
  discoveredTokenIds: number[];
  settings: {
    reducedMotion: boolean;
  };
  savedAt: string;
}
