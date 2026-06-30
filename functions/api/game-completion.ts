interface Env {
  DB: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        run: () => Promise<unknown>;
      };
    };
  };
}

const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function onRequestOptions(): Promise<Response> {
  return jsonResponse(null, 204);
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const payload = (await context.request.json().catch(() => null)) as {
      walletAddress?: unknown;
      score?: unknown;
      coins?: unknown;
      served?: unknown;
      missed?: unknown;
    } | null;
    const walletAddress =
      typeof payload?.walletAddress === "string"
        ? payload.walletAddress.trim()
        : "";

    if (!WALLET_ADDRESS_PATTERN.test(walletAddress)) {
      return jsonResponse({ error: "Enter a valid Ethereum wallet address." }, 400);
    }

    const completedAt = new Date().toISOString();
    const normalizedWallet = walletAddress.toLowerCase();
    const score = readInteger(payload?.score);
    const coins = readInteger(payload?.coins);
    const served = readInteger(payload?.served);
    const missed = readInteger(payload?.missed);

    await context.env.DB.prepare(
      `INSERT INTO game_completions (
        wallet_address,
        score,
        coins,
        served,
        missed,
        completed_days,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(normalizedWallet, score, coins, served, missed, 7, completedAt)
      .run();

    return jsonResponse({
      ok: true,
      walletAddress: normalizedWallet,
      completedAt,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not log game completion.",
      },
      500,
    );
  }
}

function readInteger(value: unknown): number {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
