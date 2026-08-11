import { NextRequest, NextResponse } from "next/server";

type ModelInfo = {
  name: string;
  isEmbedding: boolean;
  family: string;
  parameterSize: string;
  embeddingLength?: number;
};

// Known embedding model families/architectures
const EMBEDDING_FAMILIES = ["nomic-bert", "bert", "all-minilm", "bge", "e5", "gte", "mxbai"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "http://localhost:11434";
  try {
    const resp = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const models: ModelInfo[] = [];

    for (const m of data.models || []) {
      const name: string = m.name;
      const family: string = m.details?.family || "";
      const parameterSize: string = m.details?.parameter_size || "";

      // Detect embedding model by:
      // 1. Known embedding family name
      // 2. Name contains "embed"
      // 3. Check via /api/show for embedding_length (slower, do on-demand)
      const nameHasEmbed = name.toLowerCase().includes("embed");
      const familyIsEmbed = EMBEDDING_FAMILIES.some((f) => family.toLowerCase().includes(f));

      let isEmbedding = nameHasEmbed || familyIsEmbed;
      let embeddingLength: number | undefined;

      // For ambiguous models, do a deeper check via /api/show
      if (!isEmbedding && !family) {
        try {
          const showResp = await fetch(`${url}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
            signal: AbortSignal.timeout(3000),
          });
          if (showResp.ok) {
            const showData = await showResp.json();
            const modelInfo = showData.model_info || {};
            // Check for any key ending with "embedding_length"
            for (const key of Object.keys(modelInfo)) {
              if (key.endsWith("embedding_length")) {
                isEmbedding = true;
                embeddingLength = modelInfo[key];
                break;
              }
            }
          }
        } catch { /* timeout/fail is OK, skip */ }
      } else if (isEmbedding) {
        // Get embedding_length for known embed models
        try {
          const showResp = await fetch(`${url}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
            signal: AbortSignal.timeout(3000),
          });
          if (showResp.ok) {
            const showData = await showResp.json();
            const modelInfo = showData.model_info || {};
            for (const key of Object.keys(modelInfo)) {
              if (key.endsWith("embedding_length")) {
                embeddingLength = modelInfo[key];
                break;
              }
            }
          }
        } catch { /* skip */ }
      }

      models.push({ name, isEmbedding, family, parameterSize, embeddingLength });
    }

    // Sort: embedding models first
    models.sort((a, b) => {
      if (a.isEmbedding && !b.isEmbedding) return -1;
      if (!a.isEmbedding && b.isEmbedding) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      models: models.map((m) => m.name),
      details: models,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, models: [], details: [], message: err instanceof Error ? err.message : "Failed" },
      { status: 400 }
    );
  }
}
