import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import upgradeIconsUrl from "./assets/upgrade-icons-monochrome.png";
import { CanvasStage } from "./CanvasStage";
import {
  addGuestToRoster,
  advanceGame,
  buyUpgrade,
  canStartNextDayFromDayEnd,
  createGameState,
  handleCanvasClick,
  hasAffordableUpgrade,
  inviteGuestNow,
  renderGameToText,
  setRoster,
  updateGame,
} from "./game/engine";
import { getUpgradeCost, UPGRADE_DEFS } from "./game/rules";
import {
  fetchNormieGuest,
  loadStarterRoster,
  logNormieEntry,
} from "./normiesApi";
import { loadGameSave, saveFromGameState, writeGameSave } from "./save";
import type { CanvasStats, GameState, UpgradeLevels } from "./types";
import "./styles.css";

const spriteIndexByUpgrade: Record<keyof UpgradeLevels, number> = {
  bioreactorSpeed: 0,
  patienceBoost: 1,
  extraRooms: 2,
  scrapChowStation: 3,
  alienCleanRoom: 4,
  agentTerminal: 5,
  oceanLine: 3,
};

const UPGRADE_ICON_TILE_SIZE = 50;
type LegalModal = "terms" | "privacy" | null;

export default function App() {
  const initialSave = useRef(loadGameSave());
  const [game, setGame] = useState<GameState>(() =>
    createGameState(undefined, initialSave.current),
  );
  const [stats, setStats] = useState<CanvasStats | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [legalModal, setLegalModal] = useState<LegalModal>(null);
  const gameRef = useRef(game);
  const saveRef = useRef(initialSave.current);
  const resumeAfterLegalRef = useRef(false);
  const awaitingDayEndUpgrade =
    game.mode === "dayEnd" && !canStartNextDayFromDayEnd(game);
  const dayEndHasAffordableUpgrade =
    game.mode === "dayEnd" && hasAffordableUpgrade(game);

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
      const [guest, entryLog] = await Promise.all([
        fetchNormieGuest(id, { storage: localStorage }),
        logNormieEntry(id).catch(() => null),
      ]);
      setGame((current) =>
        current.mode === "playing"
          ? inviteGuestNow(current, guest)
          : addGuestToRoster(current, { ...guest, source: "manual" }),
      );
      setLookupMessage(
        entryLog?.owner
          ? `${guest.name} joined as ${guest.type}. Owner logged.`
          : `${guest.name} joined as ${guest.type}.`,
      );
      setTokenId("");
    } catch (error) {
      setLookupMessage(
        error instanceof Error ? error.message : "Could not load that Normie.",
      );
    }
  };

  const openLegalModal = (kind: Exclude<LegalModal, null>) => {
    setLegalModal(kind);
    const shouldResumeAfterClose =
      gameRef.current.mode === "playing" && !gameRef.current.paused;
    resumeAfterLegalRef.current = shouldResumeAfterClose;
    if (shouldResumeAfterClose) {
      setGame((current) =>
        current.mode === "playing" ? { ...current, paused: true } : current,
      );
    }
  };

  const closeLegalModal = () => {
    setLegalModal(null);
    const shouldResume = resumeAfterLegalRef.current;
    resumeAfterLegalRef.current = false;
    if (shouldResume) {
      setGame((current) =>
        current.mode === "playing" ? { ...current, paused: false } : current,
      );
    }
  };

  return (
    <div className="app-page">
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

        <aside
          className={`side-panel${awaitingDayEndUpgrade ? " side-panel--flash" : ""}`}
        >
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

          <section className="panel-section panel-section--upgrades">
            <h2>Upgrades</h2>
            {dayEndHasAffordableUpgrade && (
              <p className="form-note" role="status">
                Choose one affordable upgrade to unlock the next day.
              </p>
            )}
            <div className="upgrade-list">
              {UPGRADE_DEFS.map((upgrade) => {
                const level = game.upgrades[upgrade.id];
                const cost = getUpgradeCost(upgrade, level);
                const spriteIndex = spriteIndexByUpgrade[upgrade.id];
                const maxed = level >= upgrade.maxLevel;
                const shortfall = Math.max(0, cost - game.coins);
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
                        {maxed
                          ? "Maxed"
                          : shortfall > 0
                            ? `Cost: ${cost} Coins · Need ${shortfall} more`
                            : `Cost: ${cost} Coins · Ready to buy`}{" "}
                        · Lv {level}/{upgrade.maxLevel}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </main>

      <footer className="site-footer">
        Made by{" "}
        <a href="https://bitpixi.com/" target="_blank" rel="noreferrer">
          bitpixi
        </a>{" "}
        - Normie{" "}
        <a
          href="https://opensea.io/item/ethereum/0x9eb6e2025b64f340691e424b7fe7022ffde12438/2613"
          target="_blank"
          rel="noreferrer"
        >
          #2613
        </a>{" "}
        |{" "}
        <button type="button" onClick={() => openLegalModal("terms")}>
          Terms
        </button>{" "}
        |{" "}
        <button type="button" onClick={() => openLegalModal("privacy")}>
          Privacy
        </button>{" "}
        |{" "}
        <a
          href="https://github.com/bitpixi2/normies-button"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>{" "}
        |{" "}
        <a href="https://x.com/bitpixi" target="_blank" rel="noreferrer">
          Follow me on X
        </a>
      </footer>

      {legalModal && (
        <div className="legal-backdrop" role="presentation">
          <section
            className="legal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
          >
            <h2 id="legal-modal-title">
              {legalModal === "terms" ? "Terms" : "Privacy"}
            </h2>
            {legalModal === "terms" ? (
              <>
                <p>
                  Dead and Breakfast is an experimental hackathon game made for
                  entertainment. Gameplay, scoring, rewards, API availability,
                  and saved progress are provided as-is and may change.
                </p>
                <p>
                  The game does not require a wallet connection. Any reward
                  references are promotional and are not a promise of financial
                  value, marketplace value, or uninterrupted availability.
                </p>
                <p>
                  Normies names, token IDs, images, traits, and owner data come
                  from public NFT and Normies API sources. Use the game at your
                  own discretion.
                </p>
              </>
            ) : (
              <>
                <p>
                  When a Normie token ID is entered, Dead and Breakfast logs the
                  token ID, current owner wallet, public Normie metadata, and
                  timestamp for reward and admin reference.
                </p>
                <p>
                  Game progress and cached Normie guest data may be stored in
                  your browser localStorage. No wallet connection, email, or
                  name is required to play.
                </p>
                <p>
                  External links open third-party sites with their own privacy
                  policies.
                </p>
              </>
            )}
            <div className="legal-actions">
              <button type="button" onClick={closeLegalModal}>
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
