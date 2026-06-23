import type { StationId } from "../types";
import { STATIONS } from "./rules";

export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 680;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const QUEUE_RECT: Rect = { x: 34, y: 130, w: 222, h: 74 };
export const QUEUE_GAP = 84;

export const STATION_RECTS: Record<StationId, Rect> = {
  suite: { x: 300, y: 126, w: 220, h: 106 },
  bioreactor: { x: 556, y: 126, w: 238, h: 106 },
  cleanRoom: { x: 830, y: 126, w: 230, h: 106 },
  frontDesk: { x: 300, y: 304, w: 220, h: 106 },
  fishery: { x: 556, y: 304, w: 238, h: 106 },
};

export const OVERLAY_BUTTON_RECT: Rect = { x: 432, y: 334, w: 236, h: 44 };
export const LAB_CLICKER_RECT: Rect = { x: 806, y: 292, w: 236, h: 128 };

export type HitTarget =
  | { kind: "guest"; guestId: string }
  | { kind: "station"; stationId: StationId }
  | { kind: "labClicker" }
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

export function hitTestCanvas(
  x: number,
  y: number,
  queueIds: string[],
): HitTarget {
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
