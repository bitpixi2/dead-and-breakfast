import { describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../../../functions/api/game-completion";

function createContext(payload: unknown) {
  const run = vi.fn(async () => undefined);
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    context: {
      request: new Request("https://deadandbreakfast.test/api/game-completion", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      env: {
        DB: { prepare },
      },
    },
    prepare,
    bind,
    run,
  };
}

describe("game completion function", () => {
  it("stores valid completion wallet claims", async () => {
    const { context, bind, run } = createContext({
      walletAddress: "0xB7D3A787A39F25457CA511DC3F0591B546F5E02F",
      score: 1200,
      coins: 44,
      served: 15,
      missed: 2,
    });

    const response = await onRequestPost(context);
    const body = (await response.json()) as {
      ok: boolean;
      walletAddress: string;
      completedAt: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.walletAddress).toBe(
      "0xb7d3a787a39f25457ca511dc3f0591b546f5e02f",
    );
    expect(bind).toHaveBeenCalledWith(
      "0xb7d3a787a39f25457ca511dc3f0591b546f5e02f",
      1200,
      44,
      15,
      2,
      7,
      expect.any(String),
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid wallet addresses", async () => {
    const { context, run } = createContext({
      walletAddress: "not-a-wallet",
      score: 1200,
      coins: 44,
      served: 15,
      missed: 2,
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects missing wallet addresses", async () => {
    const { context, run } = createContext({
      score: 1200,
      coins: 44,
      served: 15,
      missed: 2,
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
