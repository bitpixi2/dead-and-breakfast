import type { CanvasStats, GameState, NormieGuest, StationId } from "../types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAB_CLICKER_RECT,
  OVERLAY_BUTTON_RECT,
  PAUSE_BUTTON_RECT,
  queueRectForIndex,
  STATION_RECTS,
} from "./layout";
import { canStartNextDayFromDayEnd, getEffectiveStationCapacity } from "./engine";
import { getGuestRule, STATIONS } from "./rules";

type ImageMap = Map<string, HTMLImageElement>;

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  _stats: CanvasStats | null,
  roomIcons?: HTMLImageElement,
  headerLogo?: HTMLImageElement,
  overlayLogo?: HTMLImageElement,
  houseSprites?: HTMLImageElement,
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(ctx);
  drawHeader(ctx, state, headerLogo);
  drawQueue(ctx, state, images, houseSprites);
  drawStations(ctx, state, images, roomIcons);
  drawFooter(ctx, state);
  drawLabMeatFlash(ctx, state);

  if (state.paused) {
    drawPauseOverlay(ctx);
  }

  if (state.mode === "menu") {
    drawOverlay(ctx, "Dead and Breakfast", "Start day", overlayLogo);
  } else if (state.mode === "dayEnd") {
    drawOverlay(
      ctx,
      "Day Complete",
      canStartNextDayFromDayEnd(state) ? "Start next day" : null,
      overlayLogo,
      canStartNextDayFromDayEnd(state)
        ? "Upgrades chosen. Start next day."
        : "Choose your upgrades in the side-menu",
    );
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
  ctx.fillStyle = "#252628";
  ctx.fillRect(0, 68, CANVAS_WIDTH, 4);

  ctx.fillStyle = "rgba(72, 73, 75, 0.08)";
  ctx.fillRect(282, 96, 800, 354);
  ctx.fillStyle = "rgba(72, 73, 75, 0.12)";
  ctx.fillRect(28, 96, 246, 484);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  headerLogo?: HTMLImageElement,
): void {
  drawHeaderLogo(ctx, headerLogo);

  const timeLeft = Math.max(0, Math.ceil(state.dayDuration - state.dayTime));
  const status = state.paused
    ? "Paused"
    : state.mode === "playing"
      ? `${timeLeft}s`
      : "Ready";
  drawHeaderMetrics(ctx, [
    { label: "Day", value: String(state.day) },
    { label: "Time", value: status },
    {
      label: "Meat",
      value: `${Math.ceil(state.labMeat)}/${state.labMeatMax}`,
      alert: state.labMeat <= state.labMeatMax * 0.28,
    },
    { label: "Coins", value: String(state.coins) },
    { label: "Served", value: String(state.served) },
    { label: "Missed", value: String(state.missed) },
  ]);

  if (state.mode === "playing") {
    drawPauseButton(ctx, state.paused);
  }
}

function drawHeaderLogo(
  ctx: CanvasRenderingContext2D,
  headerLogo?: HTMLImageElement,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (headerLogo?.complete && headerLogo.naturalWidth > 0) {
    ctx.drawImage(headerLogo, 16, 8, 390, 54);
  } else {
    ctx.fillStyle = "#f8f9f7";
    ctx.font = "900 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("DEAD & BREAKFAST", 28, 42);
  }
  ctx.restore();
}

function drawHeaderMetrics(
  ctx: CanvasRenderingContext2D,
  metrics: Array<{ label: string; value: string; alert?: boolean }>,
): void {
  let x = 435;
  const y = 40;

  metrics.forEach((metric) => {
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.fillStyle = "#d7dad9";
    const label = metric.label.toUpperCase();
    ctx.fillText(label, x, y);
    x += ctx.measureText(label).width + 5;

    ctx.font = "900 14px system-ui, sans-serif";
    ctx.fillStyle = metric.alert ? "#d58a8a" : "#f8f9f7";
    ctx.fillText(metric.value, x, y);
    x += ctx.measureText(metric.value).width + 18;
  });
}

function drawPauseButton(ctx: CanvasRenderingContext2D, paused: boolean): void {
  const rect = PAUSE_BUTTON_RECT;

  ctx.fillStyle = paused ? "#f8f9f7" : "#252628";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);

  ctx.fillStyle = paused ? "#252628" : "#f8f9f7";
  ctx.font = "900 12px system-ui, sans-serif";
  drawCenteredText(ctx, paused ? "RESUME" : "PAUSE", rect.x + rect.w / 2, rect.y + 22);
}

function drawQueue(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  houseSprites?: HTMLImageElement,
): void {
  ctx.fillStyle = "#252628";
  ctx.font = "800 17px system-ui, sans-serif";
  ctx.fillText("Guest Check-In", 36, 112);
  drawHotelEntranceSprite(ctx, houseSprites, state.upgrades.vipBell, 109, 122, 72);

  if (state.queue.length === 0) {
    ctx.fillStyle = "#696b6c";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText("The lobby is quiet.", 48, 220);
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

    drawGuestImage(ctx, guest.guest, images, rect.x + 12, rect.y + 10, 46);

    ctx.fillStyle = selected ? "#f8f9f7" : "#252628";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText(`${guest.type} #${guest.guest.tokenId}`, rect.x + 68, rect.y + 22);

    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = selected ? "#d7dad9" : "#696b6c";
    ctx.fillText(rule.serviceName, rect.x + 68, rect.y + 40);

    drawBar(
      ctx,
      rect.x + 68,
      rect.y + 50,
      130,
      9,
      guest.patience / guest.maxPatience,
      guest.patience / guest.maxPatience <= 0.28
        ? "#8f1d1d"
        : selected
          ? "#f8f9f7"
          : rule.color,
    );
  });
}

function drawHotelEntranceSprite(
  ctx: CanvasRenderingContext2D,
  houseSprites: HTMLImageElement | undefined,
  level: number,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (houseSprites?.complete && houseSprites.naturalWidth > 0) {
    const tileWidth = houseSprites.naturalWidth / 5;
    const index = Math.max(0, Math.min(4, Math.floor(level)));
    ctx.drawImage(
      houseSprites,
      index * tileWidth,
      0,
      tileWidth,
      houseSprites.naturalHeight,
      x,
      y,
      size,
      size,
    );
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(x, y + 12, size, size - 12);
  ctx.fillStyle = "#48494b";
  ctx.fillRect(x, y + 12, size, 4);
  ctx.fillRect(x, y + size - 4, size, 4);
  ctx.fillRect(x + 8, y + 20, 6, size - 24);
  ctx.fillRect(x + size - 14, y + 20, 6, size - 24);
  ctx.fillRect(x + 20, y + 4, size - 40, 8);
  ctx.fillRect(x + 28, y, size - 56, 4);
  ctx.fillRect(x + 22, y + 25, 28, size - 29);
  ctx.fillStyle = "#e3e5e4";
  ctx.fillRect(x + 29, y + 31, 14, size - 35);
  ctx.fillStyle = "#252628";
  ctx.fillRect(x + 41, y + 44, 4, 4);
  ctx.restore();
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
    const capacity = getEffectiveStationCapacity(station.id, state);

    const isPreferred = preferredStationId === station.id;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10, isPreferred ? "#eef0ef" : "#f8f9f7");
    ctx.strokeStyle = station.color;
    ctx.lineWidth = isPreferred ? 7 : 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (isPreferred) {
      ctx.strokeStyle = "#f8f9f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14);
    }

    ctx.fillStyle = station.color;
    ctx.font = "800 16px system-ui, sans-serif";
    if (ctx.measureText(station.label).width > rect.w - 110) {
      ctx.font = "800 13px system-ui, sans-serif";
    }
    ctx.fillText(station.label, rect.x + 14, rect.y + 24);
    drawRoomIcon(ctx, roomIcons, stationIndex, rect.x + rect.w - 92, rect.y + 38, 76);
    ctx.fillStyle = "#696b6c";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText(`${active.length}/${capacity} busy`, rect.x + rect.w - 74, rect.y + 24);

    if (active.length === 0) {
      ctx.fillStyle = "#696b6c";
      ctx.font = "600 11px system-ui, sans-serif";
      wrapText(ctx, station.description, rect.x + 14, rect.y + 48, rect.w - 122, 13);
    }

    active.slice(0, 2).forEach((service, index) => {
      const y = rect.y + 42 + index * 31;
      drawGuestImage(ctx, service.guest, images, rect.x + 14, y - 9, 28);
      ctx.fillStyle = "#252628";
      ctx.font = "800 12px system-ui, sans-serif";
      drawClippedText(ctx, `${service.type} #${service.guest.tokenId}`, rect.x + 50, y + 2, 90);
      drawBar(
        ctx,
        rect.x + 50,
        y + 10,
        88,
        9,
        1 - service.remaining / service.total,
        service.correct ? station.color : "#111214",
      );
    });
  }

  drawLabMeatClicker(ctx, state);
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

function drawLabMeatClicker(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const rect = LAB_CLICKER_RECT;
  const isOut = state.labMeat <= 0;
  const pulse = state.labMeatClickPulseUntil > state.dayTime;
  const accent = "#8f1d1d";
  const amount = Math.ceil(state.labMeat);
  const ratio = Math.max(0, Math.min(1, state.labMeat / state.labMeatMax));

  ctx.fillStyle = pulse ? "#eef0ef" : "#f8f9f7";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = isOut ? accent : "#48494b";
  ctx.lineWidth = isOut ? 4 : 3;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.fillStyle = isOut ? accent : "#252628";
  ctx.font = "900 13px system-ui, sans-serif";
  ctx.fillText("Lab-Grown Human Meat", rect.x + 14, rect.y + 25);

  ctx.fillStyle = "#696b6c";
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.fillText(`${amount}/${state.labMeatMax} cuts`, rect.x + 14, rect.y + 40);

  ctx.fillStyle = "#d7dad9";
  ctx.fillRect(rect.x + 82, rect.y + 31, rect.w - 96, 14);
  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#48494b";
  ctx.fillRect(rect.x + 82, rect.y + 31, (rect.w - 96) * ratio, 14);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 82, rect.y + 31, rect.w - 96, 14);

  if (isOut) {
    ctx.fillStyle = accent;
    ctx.font = "900 11px system-ui, sans-serif";
    ctx.fillText("OUT OF HUMAN LAB-GROWN MEAT", rect.x + 14, rect.y + 71);
    ctx.fillStyle = "#252628";
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillText("Human Suite 0 · Cat Feed -1", rect.x + 14, rect.y + 88);
  } else {
    ctx.fillStyle = "#696b6c";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(
      ratio <= 0.28 ? "Low supply. Click fast." : "Keep supply above zero.",
      rect.x + 14,
      rect.y + 76,
    );
  }

  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#252628";
  ctx.fillRect(rect.x + 14, rect.y + 96, rect.w - 28, 20);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.fillText("CLICK +2", rect.x + 92, rect.y + 111);
}

function drawLabMeatFlash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  if (state.labMeatShortageUntil <= state.dayTime) {
    return;
  }

  const remaining = state.labMeatShortageUntil - state.dayTime;
  const alpha = 0.09 + Math.sin(state.dayTime * 22) * 0.04;
  ctx.fillStyle = `rgba(143, 29, 29, ${Math.max(0.04, alpha * Math.min(1, remaining))})`;
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);
  ctx.fillStyle = "rgba(143, 29, 29, 0.84)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, 5);
  ctx.fillRect(0, CANVAS_HEIGHT - 8, CANVAS_WIDTH, 5);
}

function drawFooter(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(248, 249, 247, 0.9)";
  ctx.fillRect(300, 464, 760, 118);
  ctx.strokeStyle = "rgba(72, 73, 75, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(300, 464, 760, 118);

  drawOpenBookSprite(ctx, 324, 493, 52);

  ctx.fillStyle = "#252628";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.fillText("D&B Ledger", 392, 492);
  ctx.font = "600 12px system-ui, sans-serif";
  state.log.slice(0, 6).forEach((line, index) => {
    const column = index < 3 ? 0 : 1;
    const row = index % 3;
    const x = column === 0 ? 392 : 700;
    const y = 518 + row * 18;
    ctx.fillStyle = index === 0 ? "#252628" : "#696b6c";
    drawClippedText(ctx, line, x, y, column === 0 ? 282 : 330);
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
  buttonLabel: string | null,
  headerLogo?: HTMLImageElement,
  subtitle = "Serve each type in its matching room.",
): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.72)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);
  roundedRect(ctx, 322, 220, 456, 194, 12, "#f8f9f7");
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(322, 220, 456, 194);
  drawOverlayTitle(ctx, title, headerLogo);
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillStyle = "#252628";
  drawCenteredText(ctx, subtitle, 550, 314);

  if (!buttonLabel) {
    return;
  }

  ctx.fillStyle = "#111214";
  ctx.fillRect(
    OVERLAY_BUTTON_RECT.x - 4,
    OVERLAY_BUTTON_RECT.y + 4,
    OVERLAY_BUTTON_RECT.w + 8,
    OVERLAY_BUTTON_RECT.h,
  );
  ctx.fillStyle = "#252628";
  ctx.fillRect(
    OVERLAY_BUTTON_RECT.x,
    OVERLAY_BUTTON_RECT.y,
    OVERLAY_BUTTON_RECT.w,
    OVERLAY_BUTTON_RECT.h,
  );
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    OVERLAY_BUTTON_RECT.x + 6,
    OVERLAY_BUTTON_RECT.y + 6,
    OVERLAY_BUTTON_RECT.w - 12,
    OVERLAY_BUTTON_RECT.h - 12,
  );
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 17px system-ui, sans-serif";
  drawCenteredText(
    ctx,
    buttonLabel,
    OVERLAY_BUTTON_RECT.x + OVERLAY_BUTTON_RECT.w / 2,
    OVERLAY_BUTTON_RECT.y + 28,
  );
}

function drawOverlayTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  headerLogo?: HTMLImageElement,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (
    title === "Dead and Breakfast" &&
    headerLogo?.complete &&
    headerLogo.naturalWidth > 0
  ) {
    ctx.drawImage(headerLogo, 398, 234, 304, 42);
  } else {
    ctx.fillStyle = "#252628";
    ctx.font = "900 30px ui-monospace, SFMono-Regular, Menlo, monospace";
    drawCenteredText(ctx, title, 550, 281);
  }
  ctx.restore();
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.54)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);

  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(376, 250, 348, 124);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(376, 250, 348, 124);
  ctx.strokeStyle = "#696b6c";
  ctx.lineWidth = 2;
  ctx.strokeRect(386, 260, 328, 104);

  ctx.fillStyle = "#252628";
  ctx.font = "900 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawCenteredText(ctx, "PAUSED", 550, 306);
  ctx.font = "800 14px system-ui, sans-serif";
  drawCenteredText(ctx, "Click RESUME to continue service.", 550, 334);
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

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  let clipped = text;
  while (ctx.measureText(clipped).width > maxWidth && clipped.length > 4) {
    clipped = `${clipped.slice(0, -4)}...`;
  }
  ctx.fillText(clipped, x, y);
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
): void {
  ctx.fillText(text, centerX - ctx.measureText(text).width / 2, y);
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
