interface Env {
  DB: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        run: () => Promise<unknown>;
      };
    };
  };
}

interface NormieTrait {
  trait_type: string;
  value: string | number;
}

interface NormieMetadata {
  name?: string;
  attributes?: NormieTrait[];
}

interface NormieOwnerResponse {
  owner?: string;
}

const API_BASE = "https://api.normies.art";

export async function onRequestOptions(): Promise<Response> {
  return jsonResponse(null, 204);
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const payload = (await context.request.json().catch(() => null)) as {
      tokenId?: unknown;
    } | null;
    const tokenId = Number(payload?.tokenId);

    if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
      return jsonResponse({ error: "Token ID must be 0-9999." }, 400);
    }

    const [metadata, ownerData] = await Promise.all([
      fetchNormiesJson<NormieMetadata>(`${API_BASE}/normie/${tokenId}/metadata`),
      fetchNormiesJson<NormieOwnerResponse>(`${API_BASE}/normie/${tokenId}/owner`),
    ]);

    const attributes = Array.isArray(metadata.attributes)
      ? metadata.attributes
      : [];
    const owner =
      typeof ownerData.owner === "string" && ownerData.owner.length > 0
        ? ownerData.owner.toLowerCase()
        : null;
    const normieType = readStringTrait(attributes, "Type") || "Unknown";
    const level = readNumberTrait(attributes, "Level");
    const actionPoints = readNumberTrait(attributes, "Action Points");
    const customized = readStringTrait(attributes, "Customized").toLowerCase() === "yes";
    const enteredAt = new Date().toISOString();

    await context.env.DB.prepare(
      `INSERT INTO normie_entries (
        token_id,
        owner,
        normie_type,
        normie_name,
        level,
        action_points,
        customized,
        entered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        tokenId,
        owner,
        normieType,
        metadata.name || `Normie #${tokenId}`,
        level,
        actionPoints,
        customized ? 1 : 0,
        enteredAt,
      )
      .run();

    return jsonResponse({
      ok: true,
      tokenId,
      owner,
      type: normieType,
      enteredAt,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not log Normie entry.",
      },
      500,
    );
  }
}

async function fetchNormiesJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Normies API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function readStringTrait(attributes: NormieTrait[], traitType: string): string {
  const attribute = attributes.find((item) => item.trait_type === traitType);
  return attribute ? String(attribute.value) : "";
}

function readNumberTrait(attributes: NormieTrait[], traitType: string): number {
  const value = Number(readStringTrait(attributes, traitType));
  return Number.isFinite(value) ? value : 0;
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
