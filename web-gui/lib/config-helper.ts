/**
 * Shared helper for reading/writing qdrant_config.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const CONFIG_PATH = resolve(process.cwd(), "../qdrant_config.json");

export type CollectionInfo = {
  name: string;
  description: string;
  vectors: number;
};

export type QdrantConfig = {
  qdrant_url: string;
  ollama_url: string;
  embed_model: string;
  default_collection: string;
  vector_size: number;
  collections: CollectionInfo[];
  workspace_paths: Record<string, { path: string; collection: string; last_indexed: string }>;
};

export function readConfig(): QdrantConfig {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      qdrant_url: "http://localhost:6333",
      ollama_url: "http://localhost:11434",
      embed_model: "nomic-embed-text:latest",
      default_collection: "developer_ai",
      vector_size: 768,
      collections: [],
      workspace_paths: {},
    };
  }
}

export function writeConfig(config: QdrantConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Sync collections list in config with actual Qdrant collections.
 * Only updates the collections array — does NOT touch workspace_paths.
 */
export async function syncCollectionsToConfig(qdrantUrl: string): Promise<CollectionInfo[]> {
  // Fetch actual collections from Qdrant with their point counts
  const resp = await fetch(`${qdrantUrl}/collections`, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) throw new Error(`Qdrant HTTP ${resp.status}`);
  const data = await resp.json();
  const qdrantCollections: string[] = (data.result?.collections || []).map((c: { name: string }) => c.name);

  // Get point counts for each collection
  const updatedCollections: CollectionInfo[] = [];
  for (const name of qdrantCollections) {
    try {
      const infoResp = await fetch(`${qdrantUrl}/collections/${name}`, { signal: AbortSignal.timeout(5000) });
      const infoData = await infoResp.json();
      const vectors = infoData.result?.points_count || 0;

      updatedCollections.push({ name, description: "", vectors });
    } catch {
      updatedCollections.push({ name, description: "", vectors: 0 });
    }
  }

  // Re-read config right before writing to avoid race conditions
  const config = readConfig();
  config.collections = updatedCollections;
  writeConfig(config);

  return updatedCollections;
}

/**
 * Add a new collection to config after creation.
 */
export function addCollectionToConfig(name: string, description?: string): void {
  const config = readConfig();
  const exists = config.collections.find((c) => c.name === name);
  if (!exists) {
    config.collections.push({ name, description: description || "", vectors: 0 });
    writeConfig(config);
  }
}

/**
 * Remove a collection from config after deletion.
 * Does NOT remove workspace_paths — user may re-create the collection later.
 */
export function removeCollectionFromConfig(name: string): void {
  const config = readConfig();
  config.collections = config.collections.filter((c) => c.name !== name);
  writeConfig(config);
}
