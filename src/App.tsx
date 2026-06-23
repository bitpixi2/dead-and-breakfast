import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import upgradeIconsUrl from "./assets/upgrade-icons-monochrome.png";
import { CanvasStage } from "./CanvasStage";
import {
  addGuestToRoster,
  advanceGame,
  buyUpgrade,
  createGameState,
  handleCanvasClick,
  inviteGuestNow,
  renderGameToText,
  setRoster,
  updateGame,
} from "./game/engine";
import { getUpgradeCost, UPGRADE_DEFS } from "./game/rules";
import { fetchNormieGuest, loadStarterRoster } from "./normiesApi";
import { loadGameSave, saveFromGameState, writeGameSave } from "./save";
import type { CanvasStats, GameState, UpgradeLevels } from "./types";
import "./styles.css";

const spriteIndexByUpgrade: Record<keyof UpgradeLevels, number> = {
  bioreactorSpeed: 0,
  extraRooms: 1,
  scrapChowStation: 2,
  alienCleanRoom: 3,
  agentTerminal: 4,
  oceanLine: 2,
  patienceBoost: 5,
  vipBell: 6,
};

const UPGRADE_ICON_TILE_SIZE = 50;

export default function App() {
  const initialSave = useRef(loadGameSave());
  const [game, setGame] = useState<GameState>(() =>
    createGameState(undefined, initialSave.current),
  );
  const [stats, setStats] = useState<CanvasStats | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const gameRef = useRef(game);
  const saveRef = useRef(initialSave.current);

  useEffect(() => {
    let cancelled = false;
    void loadStarterRoster({ storage: localStorage }).then((result) => {
      if (cancelled) return;
      setStats(result.stats);
      setGame((current) => setRoster(current, result.guests));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(gameRef.current);
    window.advanceTime = (ms: number) => {
      setGame((current) => {
        const next = advanceGame(current, ms);
        gameRef.current = next;
        return next;
      });
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const loop = (time: number) => {
      const delta = Math.min(180, time - previous);
      previous = time;
      setGame((current) => updateGame(current, delta));
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const nextSave = saveFromGameState(game, saveRef.current);
    saveRef.current = nextSave;
    writeGameSave(nextSave);
  }, [
    game.bestScore,
    game.coins,
    game.day,
    game.reputation,
    game.roster,
    game.score,
    game.upgrades,
  ]);

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 0 || id > 9999) {
      setLookupMessage("Enter a token ID from 0 to 9999.");
      return;
    }

    setLookupMessage(`Inviting Normie #${id}...`);
    try {
      const guest = await fetchNormieGuest(id, { storage: localStorage });
      setGame((current) =>
        current.mode === "playing"
          ? inviteGuestNow(current, guest)
          : addGuestToRoster(current, { ...guest, source: "manual" }),
      );
      setLookupMessage(`${guest.name} joined as ${guest.type}.`);
      setTokenId("");
    } catch (error) {
      setLookupMessage(
        error instanceof Error ? error.message : "Could not load that Normie.",
      );
    }
  };

  return (
    <main className="app-shell">
      <section className="game-column">
        <CanvasStage
          state={game}
          stats={stats}
          onCanvasClick={(x, y) =>
            setGame((current) => handleCanvasClick(current, x, y))
          }
        />
      </section>

      <aside className="side-panel">
        <section className="panel-section">
          <h2>Invite Normie</h2>
          <form
            className="lookup-form"
            onSubmit={handleLookup}
            aria-label="Invite Normie"
          >
            <input
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value)}
              inputMode="numeric"
              placeholder="Token ID"
              aria-label="Normie token ID"
            />
            <button type="submit" className="icon-button" title="Invite token">
              <Search size={18} aria-hidden="true" />
            </button>
          </form>
          {lookupMessage && (
            <p className="form-note" role="status">
              {lookupMessage}
            </p>
          )}
        </section>

        <section className="panel-section">
          <h2>Upgrades</h2>
          <div className="upgrade-list">
            {UPGRADE_DEFS.map((upgrade) => {
              const level = game.upgrades[upgrade.id];
              const cost = getUpgradeCost(upgrade, level);
              const spriteIndex = spriteIndexByUpgrade[upgrade.id];
              const maxed = level >= upgrade.maxLevel;
              return (
                <button
                  key={upgrade.id}
                  className="upgrade-card"
                  disabled={maxed || game.coins < cost}
                  onClick={() =>
                    setGame((current) => buyUpgrade(current, upgrade.id))
                  }
                >
                  <span className="upgrade-sprite" aria-hidden="true">
                    <img
                      src={upgradeIconsUrl}
                      alt=""
                      style={{
                        transform: `translateX(${
                          -spriteIndex * UPGRADE_ICON_TILE_SIZE
                        }px)`,
                      }}
                    />
                  </span>
                  <span>
                    <strong>{upgrade.label}</strong>
                    <small>
                      {maxed ? "Maxed" : `${cost} coins`} · Lv {level}/
                      {upgrade.maxLevel}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </main>
  );
}
