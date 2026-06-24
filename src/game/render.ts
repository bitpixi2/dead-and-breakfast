import type { CanvasStats, GameState, NormieGuest, StationId } from "../types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAB_CLICKER_RECT,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
  MOBILE_LAB_CLICKER_RECT,
  MOBILE_OVERLAY_BUTTON_RECT,
  MOBILE_PAUSE_BUTTON_RECT,
  MOBILE_STATION_RECTS,
  OVERLAY_BUTTON_RECT,
  PAUSE_BUTTON_RECT,
  mobileQueueRectForIndex,
  queueRectForIndex,
  STATION_GUTTER,
  STATION_RECTS,
  type Rect,
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
  warningPortrait?: HTMLImageElement,
  renderTime = 0,
  ledgerLineAge = 999,
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(ctx);
  drawHeader(ctx, state, headerLogo);
  drawQueue(ctx, state, images, houseSprites);
  drawStations(ctx, state, images, roomIcons);
  drawFooter(ctx, state, renderTime, ledgerLineAge);
  drawLabMeatFlash(ctx, state);

  if (state.paused) {
    drawPauseOverlay(ctx);
  }

  if (state.mode === "shortageWarning") {
    drawShortageWarningOverlay(ctx, warningPortrait);
  } else if (state.mode === "gameOver") {
    drawGameOverOverlay(ctx, state, renderTime);
  } else if (state.mode === "menu") {
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

export function drawMobileGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  _stats: CanvasStats | null,
  roomIcons?: HTMLImageElement,
  headerLogo?: HTMLImageElement,
  overlayLogo?: HTMLImageElement,
  _houseSprites?: HTMLImageElement,
  warningPortrait?: HTMLImageElement,
  renderTime = 0,
  ledgerLineAge = 999,
): void {
  ctx.clearRect(0, 0, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT);
  drawMobileBackground(ctx);
  drawMobileHeader(ctx, state, headerLogo);
  drawMobileQueue(ctx, state, images);
  drawMobileStations(ctx, state, images, roomIcons);
  drawMobileLedger(ctx, state, renderTime, ledgerLineAge);
  drawMobileLabMeatFlash(ctx, state);

  if (state.paused) {
    drawMobilePauseOverlay(ctx);
  }

  if (state.mode === "shortageWarning") {
    drawMobileShortageWarningOverlay(ctx, warningPortrait);
  } else if (state.mode === "gameOver") {
    drawMobileGameOverOverlay(ctx, state, renderTime);
  } else if (state.mode === "menu") {
    drawMobileOverlay(ctx, "Dead and Breakfast", "Start day", overlayLogo);
  } else if (state.mode === "dayEnd") {
    drawMobileOverlay(
      ctx,
      "Day Complete",
      canStartNextDayFromDayEnd(state) ? "Start next day" : null,
      overlayLogo,
      canStartNextDayFromDayEnd(state)
        ? "Upgrades chosen. Start next day."
        : "Choose upgrades in the side-menu",
    );
  }
}

function drawMobileBackground(ctx: CanvasRenderingContext2D): void {
  const grd = ctx.createLinearGradient(0, 0, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT);
  grd.addColorStop(0, "#f8f9f7");
  grd.addColorStop(0.5, "#e3e5e4");
  grd.addColorStop(1, "#d7dad9");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT);
  ctx.fillStyle = "#48494b";
  ctx.fillRect(0, 0, MOBILE_CANVAS_WIDTH, 72);
  ctx.fillStyle = "#252628";
  ctx.fillRect(0, 70, MOBILE_CANVAS_WIDTH, 3);
}

function drawMobileHeader(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  headerLogo?: HTMLImageElement,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (headerLogo?.complete && headerLogo.naturalWidth > 0) {
    ctx.drawImage(headerLogo, 10, 5, 292, 40);
  } else {
    ctx.fillStyle = "#f8f9f7";
    ctx.font = "900 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("DEAD & BREAKFAST", 14, 35);
  }
  ctx.restore();

  const timeLeft = Math.max(0, Math.ceil(state.dayDuration - state.dayTime));
  const metrics = [
    `DAY ${state.day}`,
    state.mode === "playing" ? `${timeLeft}s` : "READY",
    `MEAT ${Math.ceil(state.labMeat)}/${state.labMeatMax}`,
    `COINS ${state.coins}`,
  ];
  ctx.font = "900 10px system-ui, sans-serif";
  metrics.forEach((item, index) => {
    const x = 14 + (index % 2) * 116;
    const y = 55 + Math.floor(index / 2) * 14;
    ctx.fillStyle =
      item.startsWith("MEAT") && state.labMeat <= state.labMeatMax * 0.28
        ? "#d58a8a"
        : "#f8f9f7";
    ctx.fillText(item, x, y);
  });

  if (state.mode === "playing") {
    const rect = MOBILE_PAUSE_BUTTON_RECT;
    ctx.fillStyle = state.paused ? "#f8f9f7" : "#252628";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#f8f9f7";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
    ctx.fillStyle = state.paused ? "#252628" : "#f8f9f7";
    ctx.font = "900 9px system-ui, sans-serif";
    drawCenteredText(ctx, state.paused ? "GO" : "PAUSE", rect.x + rect.w / 2, rect.y + 20);
  }
}

function drawMobileQueue(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
): void {
  ctx.fillStyle = "#252628";
  ctx.font = "900 15px system-ui, sans-serif";
  ctx.fillText("Guest Check-In", 14, 94);

  if (state.queue.length === 0) {
    ctx.fillStyle = "#696b6c";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText("Lobby quiet.", 204, 94);
  }

  state.queue.slice(0, 4).forEach((guest, index) => {
    const rect = mobileQueueRectForIndex(index);
    const selected = state.selectedGuestId === guest.id;
    const rule = getGuestRule(guest.type);
    ctx.fillStyle = selected ? "#252628" : "#f8f9f7";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = selected ? "#111214" : rule.color;
    ctx.lineWidth = selected ? 5 : 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (selected) {
      ctx.strokeStyle = "#f8f9f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
    }

    drawGuestImage(ctx, guest.guest, images, rect.x + 8, rect.y + 10, 44);
    ctx.fillStyle = selected ? "#f8f9f7" : "#252628";
    ctx.font = "900 12px system-ui, sans-serif";
    drawClippedText(ctx, `${guest.type} #${guest.guest.tokenId}`, rect.x + 60, rect.y + 25, 102);
    ctx.fillStyle = selected ? "#d7dad9" : "#696b6c";
    ctx.font = "800 10px system-ui, sans-serif";
    drawClippedText(ctx, rule.serviceName, rect.x + 60, rect.y + 42, 102);
    drawBar(
      ctx,
      rect.x + 60,
      rect.y + 54,
      96,
      8,
      guest.patience / guest.maxPatience,
      guest.patience / guest.maxPatience <= 0.28
        ? "#8f1d1d"
        : selected
          ? "#f8f9f7"
          : rule.color,
    );
  });
}

function drawMobileStations(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: ImageMap,
  roomIcons?: HTMLImageElement,
): void {
  const selectedGuest = state.queue.find((guest) => guest.id === state.selectedGuestId);
  const preferredStationId = selectedGuest
    ? getGuestRule(selectedGuest.type).preferredStation
    : null;

  ctx.fillStyle = "#252628";
  ctx.font = "900 15px system-ui, sans-serif";
  ctx.fillText("Rooms", 14, 272);

  STATIONS.forEach((station, index) => {
    const rect = MOBILE_STATION_RECTS[station.id];
    const active = state.services.filter((service) => service.stationId === station.id);
    const capacity = getEffectiveStationCapacity(station.id, state);
    const isPreferred = preferredStationId === station.id;

    ctx.fillStyle = isPreferred ? "#eef0ef" : "#f8f9f7";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = station.color;
    ctx.lineWidth = isPreferred ? 5 : 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (isPreferred) {
      ctx.strokeStyle = "#f8f9f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
    }

    ctx.fillStyle = station.color;
    ctx.font = "900 11px system-ui, sans-serif";
    drawClippedText(ctx, station.label, rect.x + 8, rect.y + 17, 118);
    ctx.fillStyle = "#696b6c";
    ctx.font = "800 9px system-ui, sans-serif";
    ctx.fillText(`${active.length}/${capacity}`, rect.x + rect.w - 31, rect.y + 17);
    drawRoomIcon(ctx, roomIcons, index, rect.x + rect.w - 50, rect.y + 37, 38);

    if (active.length > 0) {
      active.slice(0, 2).forEach((service, serviceIndex) => {
        const y = rect.y + 39 + serviceIndex * 28;
        drawGuestImage(ctx, service.guest, images, rect.x + 8, y - 11, 24);
        ctx.fillStyle = "#252628";
        ctx.font = "900 9px system-ui, sans-serif";
        drawClippedText(ctx, `${service.type} #${service.guest.tokenId}`, rect.x + 38, y, 74);
        drawBar(
          ctx,
          rect.x + 38,
          y + 7,
          72,
          7,
          1 - service.remaining / service.total,
          service.correct ? station.color : "#111214",
        );
      });
    } else {
      ctx.fillStyle = "#696b6c";
      ctx.font = "700 9px system-ui, sans-serif";
      wrapText(ctx, station.description, rect.x + 8, rect.y + 40, 108, 11);
    }
  });

  drawMobileLabMeatClicker(ctx, state, MOBILE_LAB_CLICKER_RECT);
}

function drawMobileLabMeatClicker(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  rect: Rect,
): void {
  const isOut = state.labMeat <= 0;
  const pulse = state.labMeatClickPulseUntil > state.dayTime;
  const ratio = Math.max(0, Math.min(1, state.labMeat / state.labMeatMax));
  const accent = "#8f1d1d";
  ctx.fillStyle = pulse ? "#eef0ef" : "#f8f9f7";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = isOut ? accent : "#48494b";
  ctx.lineWidth = isOut ? 4 : 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = isOut ? accent : "#252628";
  ctx.font = "900 11px system-ui, sans-serif";
  ctx.fillText("Lab Meat", rect.x + 8, rect.y + 17);
  ctx.fillStyle = "#696b6c";
  ctx.font = "800 9px system-ui, sans-serif";
  ctx.fillText(`${Math.ceil(state.labMeat)}/${state.labMeatMax} cuts`, rect.x + 94, rect.y + 17);
  ctx.fillStyle = "#d7dad9";
  ctx.fillRect(rect.x + 8, rect.y + 29, rect.w - 16, 11);
  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#48494b";
  ctx.fillRect(rect.x + 8, rect.y + 29, (rect.w - 16) * ratio, 11);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 8, rect.y + 29, rect.w - 16, 11);
  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#252628";
  ctx.fillRect(rect.x + 8, rect.y + 78, rect.w - 16, 26);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 12px system-ui, sans-serif";
  drawCenteredText(ctx, "CLICK +2", rect.x + rect.w / 2, rect.y + 96);
  ctx.fillStyle = isOut ? accent : "#696b6c";
  ctx.font = "800 9px system-ui, sans-serif";
  drawClippedText(
    ctx,
    isOut ? "OUT: humans unsafe" : ratio <= 0.28 ? "Low supply" : "Keep stocked",
    rect.x + 8,
    rect.y + 61,
    rect.w - 16,
  );
}

function drawMobileLedger(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  renderTime: number,
  ledgerLineAge: number,
): void {
  const rect = { x: 14, y: 654, w: 362, h: 18 };
  const line = state.log[0] ?? "";
  const severity = getLedgerSeverity(line);
  const typedLine = getTypedLedgerLine(line, ledgerLineAge);
  ctx.fillStyle = "#252628";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = severity.color;
  ctx.font = "900 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawClippedText(ctx, typedLine.toUpperCase(), rect.x + 8, rect.y + 12, rect.w - 16);
  if (Math.floor(renderTime * 2) % 2 === 0) {
    ctx.fillRect(rect.x + rect.w - 10, rect.y + 5, 4, 8);
  }
}

function drawMobileLabMeatFlash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  if (state.labMeatShortageUntil <= state.dayTime) return;
  const alpha = 0.09 + Math.sin(state.dayTime * 22) * 0.04;
  ctx.fillStyle = `rgba(143, 29, 29, ${Math.max(0.04, alpha)})`;
  ctx.fillRect(0, 72, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT - 72);
}

function drawMobileOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  buttonLabel: string | null,
  headerLogo?: HTMLImageElement,
  subtitle = "Serve each type in its matching room.",
): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.7)";
  ctx.fillRect(0, 72, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT - 72);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(28, 244, 334, 202);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 244, 334, 202);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (
    title === "Dead and Breakfast" &&
    headerLogo?.complete &&
    headerLogo.naturalWidth > 0
  ) {
    ctx.drawImage(headerLogo, 52, 267, 286, 39);
  } else {
    ctx.fillStyle = "#252628";
    ctx.font = "900 25px ui-monospace, SFMono-Regular, Menlo, monospace";
    drawCenteredText(ctx, title, 195, 302);
  }
  ctx.restore();

  ctx.fillStyle = "#252628";
  ctx.font = "800 14px system-ui, sans-serif";
  drawCenteredText(ctx, subtitle, 195, 340);

  if (!buttonLabel) return;
  const rect = MOBILE_OVERLAY_BUTTON_RECT;
  ctx.fillStyle = "#111214";
  ctx.fillRect(rect.x - 4, rect.y + 4, rect.w + 8, rect.h);
  ctx.fillStyle = "#252628";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 16px system-ui, sans-serif";
  drawCenteredText(ctx, buttonLabel, rect.x + rect.w / 2, rect.y + 31);
}

function drawMobileShortageWarningOverlay(
  ctx: CanvasRenderingContext2D,
  warningPortrait?: HTMLImageElement,
): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.76)";
  ctx.fillRect(0, 72, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT - 72);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(18, 186, 354, 312);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 186, 354, 312);
  drawWarningPortrait(ctx, warningPortrait, 34, 210, 118);

  ctx.fillStyle = "#252628";
  ctx.font = "900 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("MEAT SHORTAGE", 166, 224);
  ctx.font = "800 13px system-ui, sans-serif";
  wrapText(
    ctx,
    "There's no more lab-grown Human meat. We're going to eat a Human if they're out of their room.",
    166,
    254,
    178,
    18,
  );

  const rect = MOBILE_OVERLAY_BUTTON_RECT;
  ctx.fillStyle = "#111214";
  ctx.fillRect(rect.x - 4, rect.y + 4, rect.w + 8, rect.h);
  ctx.fillStyle = "#252628";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 16px system-ui, sans-serif";
  drawCenteredText(ctx, "OK", rect.x + rect.w / 2, rect.y + 31);
}

function drawMobileGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  renderTime: number,
): void {
  const won = state.gameOverKind === "won";
  if (won) {
    drawConfetti(ctx, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT, renderTime);
  }

  ctx.fillStyle = "rgba(37, 38, 40, 0.74)";
  ctx.fillRect(0, 72, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT - 72);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(26, 218, 338, won ? 258 : 222);
  ctx.strokeStyle = won ? "#f8f9f7" : "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(26, 218, 338, won ? 258 : 222);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 228, 318, won ? 238 : 202);

  ctx.fillStyle = "#252628";
  ctx.font = "900 25px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawCenteredText(ctx, won ? "7 DAYS SURVIVED" : "GAME OVER", 195, 268);
  ctx.font = "800 14px system-ui, sans-serif";
  wrapText(
    ctx,
    won
      ? "You are a great D&B keeper. Rewards will go to the owner wallet of whichever Normie # you entered."
      : (state.gameOverReason ?? "Dead and Breakfast could not keep the Humans safe."),
    58,
    304,
    274,
    19,
  );

  const rect = MOBILE_OVERLAY_BUTTON_RECT;
  const buttonY = rect.y;
  ctx.fillStyle = "#111214";
  ctx.fillRect(rect.x - 4, buttonY + 4, rect.w + 8, rect.h);
  ctx.fillStyle = "#252628";
  ctx.fillRect(rect.x, buttonY, rect.w, rect.h);
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 7, buttonY + 7, rect.w - 14, rect.h - 14);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 16px system-ui, sans-serif";
  drawCenteredText(ctx, won ? "Play again" : "Restart game", rect.x + rect.w / 2, buttonY + 31);
}

function drawMobilePauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.54)";
  ctx.fillRect(0, 72, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT - 72);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(76, 284, 238, 100);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(76, 284, 238, 100);
  ctx.fillStyle = "#252628";
  ctx.font = "900 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawCenteredText(ctx, "PAUSED", 195, 329);
  ctx.font = "800 12px system-ui, sans-serif";
  drawCenteredText(ctx, "Tap GO to continue.", 195, 354);
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

  const stationPanelX = 300 - STATION_GUTTER;
  const stationPanelY = 112 - STATION_GUTTER;
  const stationPanelW = 250 * 3 + STATION_GUTTER * 4;
  const stationPanelH = 150 * 2 + STATION_GUTTER * 3;
  ctx.fillStyle = "rgba(72, 73, 75, 0.08)";
  ctx.fillRect(stationPanelX, stationPanelY, stationPanelW, stationPanelH);
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
    drawRoomIcon(ctx, roomIcons, stationIndex, rect.x + rect.w - 102, rect.y + 46, 88);
    ctx.fillStyle = "#696b6c";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText(`${active.length}/${capacity} busy`, rect.x + rect.w - 74, rect.y + 24);

    if (active.length === 0) {
      ctx.fillStyle = "#696b6c";
      ctx.font = "600 11px system-ui, sans-serif";
      wrapText(ctx, station.description, rect.x + 14, rect.y + 50, rect.w - 132, 14);
    }

    active.slice(0, 2).forEach((service, index) => {
      const y = rect.y + 50 + index * 36;
      drawGuestImage(ctx, service.guest, images, rect.x + 14, y - 11, 32);
      ctx.fillStyle = "#252628";
      ctx.font = "800 12px system-ui, sans-serif";
      drawClippedText(ctx, `${service.type} #${service.guest.tokenId}`, rect.x + 56, y + 2, 100);
      drawBar(
        ctx,
        rect.x + 56,
        y + 10,
        98,
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
  ctx.fillText("Lab-Grown Human Meat", rect.x + 14, rect.y + 27);

  ctx.fillStyle = "#696b6c";
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.fillText(`${amount}/${state.labMeatMax} cuts`, rect.x + 14, rect.y + 44);

  ctx.fillStyle = "#d7dad9";
  ctx.fillRect(rect.x + 82, rect.y + 35, rect.w - 96, 14);
  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#48494b";
  ctx.fillRect(rect.x + 82, rect.y + 35, (rect.w - 96) * ratio, 14);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 82, rect.y + 35, rect.w - 96, 14);

  if (isOut) {
    ctx.fillStyle = accent;
    ctx.font = "900 11px system-ui, sans-serif";
    ctx.fillText("OUT OF HUMAN LAB-GROWN MEAT", rect.x + 14, rect.y + 78);
    ctx.fillStyle = "#252628";
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillText("Human Suite 0 · Cat Feed -1", rect.x + 14, rect.y + 96);
  } else {
    ctx.fillStyle = "#696b6c";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(
      ratio <= 0.28 ? "Low supply. Click fast." : "Keep supply above zero.",
      rect.x + 14,
      rect.y + 84,
    );
  }

  ctx.fillStyle = isOut || ratio <= 0.28 ? accent : "#252628";
  ctx.fillRect(rect.x + 14, rect.y + 116, rect.w - 28, 22);
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 12px system-ui, sans-serif";
  drawCenteredText(ctx, "CLICK +2", rect.x + rect.w / 2, rect.y + 132);
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

function drawFooter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  renderTime: number,
  ledgerLineAge: number,
): void {
  const rect = { x: 300, y: 464, w: 760, h: 118 };
  ctx.fillStyle = "#252628";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "rgba(248, 249, 247, 0.08)";
  ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16);
  ctx.strokeStyle = "rgba(248, 249, 247, 0.68)";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(248, 249, 247, 0.18)";
  ctx.strokeRect(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16);

  drawLedgerScanlines(ctx, rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20, renderTime);
  drawOpenBookSprite(ctx, 322, 493, 48);

  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("NIGHT AUDIT TERMINAL", 392, 488);
  ctx.fillStyle = "rgba(248, 249, 247, 0.62)";
  ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("LIVE LEDGER FEED", 566, 488);

  const visibleLog = state.log.slice(0, 4).reverse();
  visibleLog.forEach((line, index) => {
    const isNewest = index === visibleLog.length - 1;
    const severity = getLedgerSeverity(line);
    const typedLine = isNewest ? getTypedLedgerLine(line, ledgerLineAge) : line;
    const y = 512 + index * 17;

    drawLedgerBadge(ctx, severity, 392, y - 11);
    ctx.fillStyle = isNewest ? severity.color : "rgba(248, 249, 247, 0.66)";
    ctx.font = `${isNewest ? "800" : "700"} 12px ui-monospace, SFMono-Regular, Menlo, monospace`;
    drawClippedText(ctx, typedLine.toUpperCase(), 452, y, 560);

    if (isNewest && Math.floor(renderTime * 2) % 2 === 0) {
      const cursorX = Math.min(
        1018,
        452 + ctx.measureText(typedLine.toUpperCase()).width + 5,
      );
      ctx.fillStyle = severity.color;
      ctx.fillRect(cursorX, y - 11, 7, 13);
    }
  });

  ctx.fillStyle = "#252628";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText("Click guests, then stations. Press F for fullscreen.", 36, 626);
}

function drawLedgerScanlines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  renderTime: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#f8f9f7";
  const offset = Math.floor(renderTime * 10) % 8;
  for (let lineY = y + offset; lineY < y + h; lineY += 8) {
    ctx.fillRect(x, lineY, w, 1);
  }
  ctx.restore();
}

function getTypedLedgerLine(line: string, lineAge: number): string {
  const typedCharacters = Math.min(line.length, Math.floor(lineAge * 28));
  return line.slice(0, typedCharacters);
}

function getLedgerSeverity(line: string): { label: string; color: string } {
  const normalized = line.toLowerCase();
  if (
    normalized.includes("out of") ||
    normalized.includes("missed") ||
    normalized.includes("risky") ||
    normalized.includes("full")
  ) {
    return { label: "WARN", color: "#d58a8a" };
  }
  if (
    normalized.includes("closed") ||
    normalized.includes("served") ||
    normalized.includes("payment") ||
    normalized.includes("upgraded")
  ) {
    return { label: "CASH", color: "#f8f9f7" };
  }
  if (
    normalized.includes("arrived") ||
    normalized.includes("joined") ||
    normalized.includes("selected") ||
    normalized.includes("sent")
  ) {
    return { label: "OPS", color: "#d7dad9" };
  }
  return { label: "INFO", color: "#e3e5e4" };
}

function drawLedgerBadge(
  ctx: CanvasRenderingContext2D,
  severity: { label: string; color: string },
  x: number,
  y: number,
): void {
  ctx.fillStyle = "rgba(248, 249, 247, 0.08)";
  ctx.fillRect(x, y, 48, 14);
  ctx.strokeStyle = severity.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 48, 14);
  ctx.fillStyle = severity.color;
  ctx.font = "900 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawCenteredText(ctx, severity.label, x + 24, y + 10);
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

function drawShortageWarningOverlay(
  ctx: CanvasRenderingContext2D,
  warningPortrait?: HTMLImageElement,
): void {
  ctx.fillStyle = "rgba(37, 38, 40, 0.76)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(248, 168, 604, 306);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(248, 168, 604, 306);
  ctx.strokeStyle = "#696b6c";
  ctx.lineWidth = 2;
  ctx.strokeRect(260, 180, 580, 282);
  drawWarningPortrait(ctx, warningPortrait, 284, 202, 184);

  ctx.fillStyle = "#252628";
  ctx.font = "900 30px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("MEAT SHORTAGE", 500, 224);
  ctx.font = "800 18px system-ui, sans-serif";
  wrapText(
    ctx,
    "There's no more lab-grown Human meat. We're going to eat a Human if they're out of their room.",
    500,
    270,
    292,
    25,
  );

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
    OVERLAY_BUTTON_RECT.x + 7,
    OVERLAY_BUTTON_RECT.y + 7,
    OVERLAY_BUTTON_RECT.w - 14,
    OVERLAY_BUTTON_RECT.h - 14,
  );
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 17px system-ui, sans-serif";
  drawCenteredText(
    ctx,
    "OK",
    OVERLAY_BUTTON_RECT.x + OVERLAY_BUTTON_RECT.w / 2,
    OVERLAY_BUTTON_RECT.y + 28,
  );
}

function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  renderTime: number,
): void {
  const won = state.gameOverKind === "won";
  if (won) {
    drawConfetti(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, renderTime);
  }

  ctx.fillStyle = "rgba(37, 38, 40, 0.72)";
  ctx.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);
  ctx.fillStyle = "#f8f9f7";
  ctx.fillRect(310, 186, 480, won ? 278 : 230);
  ctx.strokeStyle = won ? "#f8f9f7" : "#252628";
  ctx.lineWidth = 4;
  ctx.strokeRect(310, 186, 480, won ? 278 : 230);
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 2;
  ctx.strokeRect(322, 198, 456, won ? 254 : 206);

  ctx.fillStyle = "#252628";
  ctx.font = "900 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  drawCenteredText(ctx, won ? "7 DAYS SURVIVED" : "GAME OVER", 550, 252);
  ctx.font = "800 18px system-ui, sans-serif";
  wrapText(
    ctx,
    won
      ? "You are a great D&B keeper. Rewards will go to the owner wallet of whichever Normie # you entered."
      : (state.gameOverReason ?? "Dead and Breakfast could not keep the Humans safe."),
    382,
    304,
    336,
    25,
  );

  const buttonY = OVERLAY_BUTTON_RECT.y;
  ctx.fillStyle = "#111214";
  ctx.fillRect(
    OVERLAY_BUTTON_RECT.x - 4,
    buttonY + 4,
    OVERLAY_BUTTON_RECT.w + 8,
    OVERLAY_BUTTON_RECT.h,
  );
  ctx.fillStyle = "#252628";
  ctx.fillRect(OVERLAY_BUTTON_RECT.x, buttonY, OVERLAY_BUTTON_RECT.w, OVERLAY_BUTTON_RECT.h);
  ctx.strokeStyle = "#f8f9f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    OVERLAY_BUTTON_RECT.x + 7,
    buttonY + 7,
    OVERLAY_BUTTON_RECT.w - 14,
    OVERLAY_BUTTON_RECT.h - 14,
  );
  ctx.fillStyle = "#f8f9f7";
  ctx.font = "900 17px system-ui, sans-serif";
  drawCenteredText(
    ctx,
    won ? "Play again" : "Restart game",
    OVERLAY_BUTTON_RECT.x + OVERLAY_BUTTON_RECT.w / 2,
    buttonY + 28,
  );
}

function drawWarningPortrait(
  ctx: CanvasRenderingContext2D,
  warningPortrait: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#e3e5e4";
  ctx.fillRect(x, y, size, size);
  if (warningPortrait?.complete && warningPortrait.naturalWidth > 0) {
    ctx.drawImage(warningPortrait, x, y, size, size);
  } else {
    ctx.fillStyle = "#48494b";
    ctx.fillRect(x + size * 0.25, y + size * 0.18, size * 0.5, size * 0.64);
  }
  ctx.strokeStyle = "#252628";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

function drawConfetti(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  renderTime: number,
): void {
  ctx.save();
  const colors = ["#f8f9f7", "#d7dad9", "#696b6c", "#252628"];
  for (let index = 0; index < 72; index += 1) {
    const x = (index * 47) % width;
    const fall = (renderTime * (42 + (index % 5) * 8) + index * 29) % height;
    const y = Math.floor(fall);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y, 5 + (index % 3), 9);
  }
  ctx.restore();
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
