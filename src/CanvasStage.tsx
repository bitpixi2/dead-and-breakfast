import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasStats, GameState } from "./types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
  translateMobilePointToCanvas,
} from "./game/layout";
import { drawGame, drawMobileGame } from "./game/render";
import headerLogoDarkUrl from "./assets/dead-breakfast-header-logo-dark.png";
import headerLogoUrl from "./assets/dead-breakfast-header-logo.png";
import houseSpritesUrl from "./assets/house-upgrades-monochrome.png";
import roomIconsUrl from "./assets/room-icons-monochrome.png";

interface CanvasStageProps {
  state: GameState;
  stats: CanvasStats | null;
  onCanvasClick: (x: number, y: number) => void;
}

interface ViewportSize {
  width: number;
  height: number;
}

export function CanvasStage({
  state,
  stats,
  onCanvasClick,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const statsRef = useRef(stats);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const ledgerLineRef = useRef<string | null>(null);
  const ledgerLineStartedAtRef = useRef(0);
  const touchHandledAtRef = useRef(0);
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: typeof window === "undefined" ? CANVAS_WIDTH : window.innerWidth,
    height: typeof window === "undefined" ? CANVAS_HEIGHT : window.innerHeight,
  }));
  const visibleImageUrls = useMemo(() => {
    return Array.from(
      new Set([
        ...state.roster.map((guest) => guest.imageUrl),
        ...state.queue.map((guest) => guest.guest.imageUrl),
        ...state.services.map((service) => service.guest.imageUrl),
        headerLogoDarkUrl,
        headerLogoUrl,
        houseSpritesUrl,
        roomIconsUrl,
      ]),
    );
  }, [state.queue, state.roster, state.services]);

  useEffect(() => {
    for (const url of visibleImageUrls) {
      if (imagesRef.current.has(url)) continue;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => draw(performance.now());
      image.onerror = () => draw(performance.now());
      image.src = url;
      imagesRef.current.set(url, image);
    }

    draw(performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleImageUrls, state, stats]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
    statsRef.current = stats;
  }, [state, stats]);

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f") return;
      const wrap = wrapRef.current;
      if (!wrap) return;

      if (!document.fullscreenElement) {
        void wrap.requestFullscreen?.();
      } else {
        void document.exitFullscreen?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const draw = (timeMs: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const currentState = stateRef.current;
    const latestLedgerLine = currentState.log[0] ?? "";
    if (ledgerLineRef.current !== latestLedgerLine) {
      ledgerLineRef.current = latestLedgerLine;
      ledgerLineStartedAtRef.current = timeMs;
    }
    const draw = isPortraitPhone(viewport) ? drawMobileGame : drawGame;
    draw(
      ctx,
      currentState,
      imagesRef.current,
      statsRef.current,
      imagesRef.current.get(roomIconsUrl),
      imagesRef.current.get(headerLogoUrl),
      imagesRef.current.get(headerLogoDarkUrl),
      imagesRef.current.get(houseSpritesUrl),
      timeMs / 1000,
      Math.max(0, (timeMs - ledgerLineStartedAtRef.current) / 1000),
    );
  };

  const mapPointerToCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const isMobile = isPortraitPhone(viewport);
    const canvasWidth = isMobile ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;
    const canvasHeight = isMobile ? MOBILE_CANVAS_HEIGHT : CANVAS_HEIGHT;
    const x = ((clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((clientY - rect.top) / rect.height) * canvasHeight;
    return isMobile
      ? translateMobilePointToCanvas(
          x,
          y,
          stateRef.current.queue.map((guest) => guest.id),
        )
      : { x, y };
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (performance.now() - touchHandledAtRef.current < 500) return;
    const point = mapPointerToCanvas(event.clientX, event.clientY);
    if (!point) return;
    onCanvasClick(point.x, point.y);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    touchHandledAtRef.current = performance.now();
    const point = mapPointerToCanvas(event.clientX, event.clientY);
    if (!point) return;
    onCanvasClick(point.x, point.y);
  };

  const isMobile = isPortraitPhone(viewport);
  const stageClassName = [
    "stage-wrap",
    isMobile ? "stage-wrap--mobile-board" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={stageClassName} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={isMobile ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH}
        height={isMobile ? MOBILE_CANVAS_HEIGHT : CANVAS_HEIGHT}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        aria-label="Dead and Breakfast game canvas"
      />
    </div>
  );
}

function isPortraitPhone(viewport: ViewportSize): boolean {
  return viewport.width <= 680 && viewport.height > viewport.width;
}
