/// <reference types="vite/client" />
/// <reference types="vitest" />

interface Window {
  advanceTime?: (ms: number) => void;
  render_game_to_text?: () => string;
}
