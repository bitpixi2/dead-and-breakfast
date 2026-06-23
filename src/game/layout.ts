import type { StationId } from "../types";
import { STATIONS } from "./rules";

export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 680;
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
export const LAB_CLICKER_RECT: Rect = { x: 820, y: 272, w: 250, h: 150 };
export const PAUSE_BUTTON_RECT: Rect = { x: 986, y: 18, w: 84, h: 34 };

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
