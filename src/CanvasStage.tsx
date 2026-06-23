import { useEffect, useMemo, useRef } from "react";
import type { CanvasStats, GameState } from "./types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./game/layout";
import { drawGame } from "./game/render";
import headerLogoDarkUrl from "./assets/dead-breakfast-header-logo-dark.png";
import headerLogoUrl from "./assets/dead-breakfast-header-logo.png";
import houseSpritesUrl from "./assets/house-upgrades-monochrome.png";
import roomIconsUrl from "./assets/room-icons-monochrome.png";

interface CanvasStageProps {
  state: GameState;
  stats: CanvasStats | null;
  onCanvasClick: (x: number, y: number) => void;
}

export function CanvasStage({
  state,
  stats,
  onCanvasClick,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
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
      image.onload = () => draw();
      image.onerror = () => draw();
      image.src = url;
      imagesRef.current.set(url, image);
    }

    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleImageUrls, state, stats]);

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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGame(
      ctx,
      state,
      imagesRef.current,
      stats,
      imagesRef.current.get(roomIconsUrl),
      imagesRef.current.get(headerLogoUrl),
      imagesRef.current.get(headerLogoDarkUrl),
      imagesRef.current.get(houseSpritesUrl),
    );
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    onCanvasClick(x, y);
  };

  return (
    <div className="stage-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleClick}
        aria-label="Dead and Breakfast game canvas"
      />
    </div>
  );
}
