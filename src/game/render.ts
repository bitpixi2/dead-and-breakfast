import type { CanvasStats, GameState, NormieGuest, StationId } from "../types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  OVERLAY_BUTTON_RECT,
  queueRectForIndex,
  STATION_RECTS,
} from "./layout";
import {
  getGuestRule,
  getStationCapacity,
  STATIONS,
} from "./rules";

type ImageMap = Map<string, HTMLImageElement>;

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  stats: CanvasStats | null,
  roomIcons?: HTMLImageElement,
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(ctx);
  drawHeader(ctx, state, stats);
  drawQueue(ctx, state, images);
  drawStations(ctx, state, images, roomIcons);
  drawFooter(ctx, state);

  if (state.mode === "menu") {
    drawOverlay(ctx, "Dead and Breakfast", "Start day");
  } else if (state.mode === "dayEnd") {
    drawOverlay(ctx, "Day Complete", "Start next day");
  }
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const grd = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  grd.addColorStop(0, "#f8f9f7");
  grd.addColorStop(0.42, "#e3e5e4");
  grd.addColorStop(1, "#d7dad9");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#48494b";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 70);
  ctx.fillStyle = "#e3e5e4";
  ctx.fillRect(28, 26, 72, 18);
  ctx.fillStyle = "#252628";
  ctx.fillRect(0, 68, CANVAS_WIDTH, 4);

  ctx.fillStyle = "rgba(72, 73, 75, 0.08)";
  ctx.fillRect(282, 96, 800, 350);
  ctx.fillStyle = "rgba(72, 73, 75, 0.12)";
  ctx.fillRect(28, 96, 246, 484);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  stats: CanvasStats | null,
): void {
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "700 25px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("DEAD AND BREAKFAST", 120, 42);

  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillStyle = "#f8f9f7";
  ctx.fillText(`Day ${state.day}`, 494, 31);
  ctx.fillText(`${state.coins} coins`, 574, 31);
  ctx.fillText(`Rep ${state.reputation}`, 680, 31);
  ctx.fillText(`Score ${state.score}`, 774, 31);

  ctx.fillStyle = "#e3e5e4";
  const timeLeft = Math.max(0, Math.ceil(state.dayDuration - state.dayTime));
  ctx.fillText(state.mode === "playing" ? `${timeLeft}s` : "Ready", 900, 31);

  if (stats) {
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = "#d7dad9";
    ctx.fillText(
      `Live Canvas: ${stats.totalZombies} Zombies / ${stats.totalTransforms} transforms`,
      494,
      52,
    );
  }
}

function drawQueue(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
): void {
  ctx.fillStyle = "#252628";
  ctx.font = "800 17px system-ui, sans-serif";
  ctx.fillText("Guest Queue", 36, 112);

  if (state.queue.length === 0) {
    ctx.fillStyle = "#696b6c";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText("The lobby is quiet.", 48, 162);
  }

  state.queue.slice(0, 5).forEach((guest, index) => {
    const rect = queueRectForIndex(index);
    const rule = getGuestRule(guest.type);
    const selected = state.selectedGuestId === guest.id;

    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 8, selected ? "#252628" : "#f8f9f7");
    ctx.strokeStyle = selected ? "#111214" : rule.color;
    ctx.lineWidth = selected ? 6 : 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (selected) {
      ctx.strokeStyle = "#f8f9f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14);
      ctx.fillStyle = "#f8f9f7";
      ctx.font = "900 10px system-ui, sans-serif";
      ctx.fillText("SELECTED", rect.x + rect.w - 70, rect.y + 18);
    }

    drawGuestImage(ctx, guest.guest, images, rect.x + 12, rect.y + 12, 50);

    ctx.fillStyle = selected ? "#f8f9f7" : "#252628";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText(`${guest.type} #${guest.guest.tokenId}`, rect.x + 72, rect.y + 24);

    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = selected ? "#d7dad9" : "#696b6c";
    ctx.fillText(rule.serviceName, rect.x + 72, rect.y + 42);

    drawBar(
      ctx,
      rect.x + 72,
      rect.y + 52,
      130,
      9,
      guest.patience / guest.maxPatience,
      selected ? "#f8f9f7" : rule.color,
    );
  });
}

function drawStations(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  roomIcons?: HTMLImageElement,
): void {
  const selectedGuest = state.queue.find((guest) => guest.id === state.selectedGuestId);
  const preferredStationId = selectedGuest
    ? getGuestRule(selectedGuest.type).preferredStation
    : null;

  for (const [stationIndex, station] of STATIONS.entries()) {
    const rect = STATION_RECTS[station.id];
    const active = state.services.filter(
      (service) => service.stationId === station.id,
    );
    const capacity = getStationCapacity(station.id, state.upgrades);

    const isPreferred = preferredStationId === station.id;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10, isPreferred ? "#eef0ef" : "#f8f9f7");
    ctx.strokeStyle = station.color;
    ctx.lineWidth = isPreferred ? 7 : 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (isPreferred) {
      ctx.strokeStyle = "#f8f9f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14);
      ctx.fillStyle = "#252628";
      ctx.font = "900 10px system-ui, sans-serif";
      ctx.fillText("SEND HERE", rect.x + rect.w - 80, rect.y + 42);
    }

    ctx.fillStyle = station.color;
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.fillText(station.label, rect.x + 14, rect.y + 24);
    drawRoomIcon(ctx, roomIcons, stationIndex, rect.x + rect.w - 88, rect.y + 30, 70);
    ctx.fillStyle = "#696b6c";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText(`${active.length}/${capacity} busy`, rect.x + rect.w - 74, rect.y + 24);

    if (active.length === 0) {
      ctx.fillStyle = "#696b6c";
      ctx.font = "600 11px system-ui, sans-serif";
      wrapText(ctx, station.description, rect.x + 14, rect.y + 48, rect.w - 116, 13);
    }

    active.slice(0, 2).forEach((service, index) => {
      const y = rect.y + 42 + index * 31;
      drawGuestImage(ctx, service.guest, images, rect.x + 14, y - 9, 28);
      ctx.fillStyle = "#252628";
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.fillText(`${service.type} #${service.guest.tokenId}`, rect.x + 50, y + 2);
      drawBar(
        ctx,
        rect.x + 50,
        y + 10,
        rect.w - 68,
        9,
        1 - service.remaining / service.total,
        service.correct ? station.color : "#111214",
      );
    });
  }

  drawEffects(ctx, state);
}

function drawRoomIcon(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  index: number,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.imageSmoothingEnabled = false;

  if (image?.complete && image.naturalWidth > 0) {
    const tileWidth = image.naturalWidth / 5;
    const sourceSize = Math.min(tileWidth, image.naturalHeight);
    const sourceX = tileWidth * index + (tileWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      x,
      y,
      size,
      size,
    );
  } else {
    ctx.strokeStyle = "#48494b";
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = "#48494b";
    ctx.fillRect(x + size * 0.35, y + size * 0.35, size * 0.3, size * 0.3);
  }

  ctx.restore();
}

function drawEffects(ctx: CanvasRenderingContext2D, state: GameState): void {
  const active: string[] = [];
  if (state.alienCalibrationUntil > state.dayTime) {
    active.push("Alien calibration");
  }
  if (state.agentRushUntil > state.dayTime) {
    active.push("Agent rush");
  }

  ctx.fillStyle = "#252628";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.fillText("Active Bonuses", 830, 304);
  ctx.font = "700 13px system-ui, sans-serif";
  if (active.length === 0) {
    ctx.fillStyle = "#696b6c";
    ctx.fillText("Serve Aliens and Agents well.", 830, 330);
  } else {
    active.forEach((label, index) => {
      ctx.fillStyle = index === 0 ? "#252628" : "#48494b";
      ctx.fillText(label, 830, 330 + index * 22);
    });
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(248, 249, 247, 0.9)";
  ctx.fillRect(300, 470, 760, 146);
  ctx.strokeStyle = "rgba(72, 73, 75, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(300, 470, 760, 146);

  drawOpenBookSprite(ctx, 324, 494, 52);

  ctx.fillStyle = "#252628";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.fillText("Inn Ledger", 392, 498);
  ctx.font = "600 13px system-ui, sans-serif";
  state.log.slice(0, 5).forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#252628" : "#696b6c";
    ctx.fillText(line, 392, 524 + index * 20);
  });

  ctx.fillStyle = "#252628";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText("Click guests, then stations. Press F for fullscreen.", 36, 626);
}

function drawOpenBookSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const unit = size / 13;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#e3e5e4";
  ctx.fillRect(x, y + unit, size, size - unit * 2);

  ctx.fillStyle = "#252628";
  ctx.fillRect(x, y + unit * 2, unit, unit * 9);
  ctx.fillRect(x + unit * 12, y + unit * 2, unit, unit * 9);
  ctx.fillRect(x + unit, y + unit, unit * 4, unit);
  ctx.fillRect(x + unit * 8, y + unit, unit * 4, unit);
  ctx.fillRect(x + unit, y + unit * 11, unit * 4, unit);
  ctx.fillRect(x + unit * 8, y + unit * 11, unit * 4, unit);
  ctx.fillRect(x + unit * 6, y + unit * 2, unit, unit * 9);

  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(x + unit * 2, y + unit * 2, unit * 3, unit * 9);
  ctx.fillRect(x + unit * 8, y + unit * 2, unit * 3, unit * 9);
  ctx.fillRect(x + unit * 5, y + unit * 3, unit, unit * 7);
  ctx.fillRect(x + unit * 7, y + unit * 3, unit, unit * 7);

  ctx.fillStyle = "#696b6c";
  ctx.fillRect(x + unit * 3, y + unit * 4, unit * 2, unit);
  ctx.fillRect(x + unit * 3, y + unit * 7, unit * 2, unit);
  ctx.fillRect(x + unit * 8, y + unit * 5, unit * 2, unit);
  ctx.fillRect(x + unit * 8, y + unit * 8, unit * 2, unit);

  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  buttonLabel: string,
): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.72)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);
  roundedRect(ctx, 322, 220, 456, 194, 12, "#f8f9f7");
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(322, 220, 456, 194);
  ctx.fillStyle = "#252628";
  ctx.font = "900 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(title, 366, 282);
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText("Serve each type in its matching room.", 386, 314);

  roundedRect(
    ctx,
    OVERLAY_BUTTON_RECT.x,
    OVERLAY_BUTTON_RECT.y,
    OVERLAY_BUTTON_RECT.w,
    OVERLAY_BUTTON_RECT.h,
    8,
    "#252628",
  );
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 17px system-ui, sans-serif";
  ctx.fillText(buttonLabel, OVERLAY_BUTTON_RECT.x + 52, OVERLAY_BUTTON_RECT.y + 28);
}

function drawGuestImage(
  ctx: CanvasRenderingContext2D,
  guest: NormieGuest,
  images: ImageMap,
  x: number,
  y: number,
  size: number,
): void {
  const image = images.get(guest.imageUrl);
  ctx.fillStyle = "#e3e5e4";
  ctx.fillRect(x, y, size, size);

  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = getGuestRule(guest.type).color;
    ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
  }

  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  color: string,
): void {
  ctx.fillStyle = "#d7dad9";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, value)) * w, h);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(" ");
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
  }
}
