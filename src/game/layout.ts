import type { StationId } from "../types";
import { STATIONS } from "./rules";

export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 680;
export const MOBILE_CANVAS_WIDTH = 390;
export const MOBILE_CANVAS_HEIGHT = 680;
export const STATION_GUTTER = 10;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const QUEUE_RECT: Rect = { x: 34, y: 200, w: 222, h: 68 };
export const QUEUE_GAP = 74;

export const STATION_RECTS: Record<StationId, Rect> = {
  suite: { x: 300, y: 112, w: 250, h: 150 },
  bioreactor: { x: 560, y: 112, w: 250, h: 150 },
  cleanRoom: { x: 820, y: 112, w: 250, h: 150 },
  frontDesk: { x: 300, y: 272, w: 250, h: 150 },
  fishery: { x: 560, y: 272, w: 250, h: 150 },
};

export const OVERLAY_BUTTON_RECT: Rect = { x: 432, y: 334, w: 236, h: 44 };
export const SHORTAGE_OVERLAY_BUTTON_RECT: Rect = {
  x: 500,
  y: 382,
  w: 292,
  h: 44,
};
export const LAB_CLICKER_RECT: Rect = { x: 820, y: 272, w: 250, h: 150 };
export const PAUSE_BUTTON_RECT: Rect = { x: 986, y: 18, w: 84, h: 34 };

export const MOBILE_OVERLAY_BUTTON_RECT: Rect = { x: 84, y: 374, w: 222, h: 50 };
export const MOBILE_SHORTAGE_OVERLAY_BUTTON_RECT: Rect = {
  x: 164,
  y: 414,
  w: 180,
  h: 44,
};
export const MOBILE_PAUSE_BUTTON_RECT: Rect = { x: 314, y: 16, w: 58, h: 32 };
export const MOBILE_LAB_CLICKER_RECT: Rect = { x: 202, y: 532, w: 174, h: 116 };

export const MOBILE_STATION_RECTS: Record<StationId, Rect> = {
  suite: { x: 14, y: 284, w: 174, h: 116 },
  bioreactor: { x: 202, y: 284, w: 174, h: 116 },
  cleanRoom: { x: 14, y: 408, w: 174, h: 116 },
  frontDesk: { x: 202, y: 408, w: 174, h: 116 },
  fishery: { x: 14, y: 532, w: 174, h: 116 },
};

export type HitTarget =
  | { kind: "guest"; guestId: string }
  | { kind: "station"; stationId: StationId }
  | { kind: "labClicker" }
  | { kind: "pause" }
  | { kind: "none" };

function contains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return contains(rect, x, y);
}

export function queueRectForIndex(index: number): Rect {
  return {
    ...QUEUE_RECT,
    y: QUEUE_RECT.y + index * QUEUE_GAP,
  };
}

export function mobileQueueRectForIndex(index: number): Rect {
  return {
    x: 14 + (index % 2) * 188,
    y: 104 + Math.floor(index / 2) * 82,
    w: 174,
    h: 74,
  };
}

export function hitTestCanvas(
  x: number,
  y: number,
  queueIds: string[],
): HitTarget {
  if (contains(PAUSE_BUTTON_RECT, x, y)) {
    return { kind: "pause" };
  }

  for (let index = 0; index < queueIds.length; index += 1) {
    if (contains(queueRectForIndex(index), x, y)) {
      return { kind: "guest", guestId: queueIds[index] };
    }
  }

  for (const station of STATIONS) {
    if (contains(STATION_RECTS[station.id], x, y)) {
      return { kind: "station", stationId: station.id };
    }
  }

  if (contains(LAB_CLICKER_RECT, x, y)) {
    return { kind: "labClicker" };
  }

  return { kind: "none" };
}

export function translateMobilePointToCanvas(
  x: number,
  y: number,
  queueIds: string[],
): { x: number; y: number } {
  if (contains(MOBILE_PAUSE_BUTTON_RECT, x, y)) {
    return centerOf(PAUSE_BUTTON_RECT);
  }

  if (contains(MOBILE_OVERLAY_BUTTON_RECT, x, y)) {
    return centerOf(OVERLAY_BUTTON_RECT);
  }

  if (contains(MOBILE_SHORTAGE_OVERLAY_BUTTON_RECT, x, y)) {
    return centerOf(SHORTAGE_OVERLAY_BUTTON_RECT);
  }

  for (let index = 0; index < queueIds.length; index += 1) {
    if (contains(mobileQueueRectForIndex(index), x, y)) {
      return centerOf(queueRectForIndex(index));
    }
  }

  for (const station of STATIONS) {
    if (contains(MOBILE_STATION_RECTS[station.id], x, y)) {
      return centerOf(STATION_RECTS[station.id]);
    }
  }

  if (contains(MOBILE_LAB_CLICKER_RECT, x, y)) {
    return centerOf(LAB_CLICKER_RECT);
  }

  return { x: -1, y: -1 };
}

function centerOf(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}
