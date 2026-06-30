import { useState } from "react";
import type { FormEvent } from "react";

type WinnerClaimState = "idle" | "submitting" | "submitted" | "skipped";

interface WinnerClaimProps {
  onSubmit: (walletAddress: string) => Promise<void>;
}

const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function WinnerClaim({ onSubmit }: WinnerClaimProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [claimState, setClaimState] = useState<WinnerClaimState>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedWallet = walletAddress.trim();
    if (!WALLET_ADDRESS_PATTERN.test(trimmedWallet)) {
      setMessage("Enter a valid 0x wallet address.");
      return;
    }

    setClaimState("submitting");
    setMessage("Logging completion wallet...");
    try {
      await onSubmit(trimmedWallet);
      setClaimState("submitted");
      setMessage("Completion wallet logged. Use Play again when ready.");
    } catch (error) {
      setClaimState("idle");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not log completion wallet.",
      );
    }
  };

  const skipClaim = () => {
    setClaimState("skipped");
    setMessage("Wallet claim skipped. Use Play again when ready.");
  };

  return (
    <section className="winner-claim" aria-labelledby="winner-claim-title">
      <h2 id="winner-claim-title">Completion Claim</h2>
      {claimState === "submitted" || claimState === "skipped" ? (
        <p className="winner-claim-note">{message}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p>Optional: enter a wallet for completion rewards.</p>
          <input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="0x..."
            aria-label="Completion wallet address"
            disabled={claimState === "submitting"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {message && (
            <p className="winner-claim-note" role="status">
              {message}
            </p>
          )}
          <div className="winner-claim-actions">
            <button type="submit" disabled={claimState === "submitting"}>
              {claimState === "submitting" ? "Submitting..." : "Submit wallet"}
            </button>
            <button
              type="button"
              className="winner-claim-skip"
              onClick={skipClaim}
              disabled={claimState === "submitting"}
            >
              Skip
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
