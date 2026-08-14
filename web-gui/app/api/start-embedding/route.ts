import { NextRequest, NextResponse } from "next/server";
import { startEmbedding, getIsRunning } from "@/lib/embedding-engine";
import { readConfig, writeConfig, addCollectionToConfig } from "@/lib/config-helper";

export async function POST(req: NextRequest) {
  if (getIsRunning()) {
    return NextResponse.json({ success: false, message: "Already running" }, { status: 400 });
  }

  const config = await req.json();

  // Save workspace path to config for future re-indexing
  if (config.workspace && config.folderPath) {
    try {
      const appConfig = readConfig();
      if (!appConfig.workspace_paths) appConfig.workspace_paths = {};
      // Normalize workspace key to lowercase for consistent lookup
      const wsKey = config.workspace.toLowerCase();
      appConfig.workspace_paths[wsKey] = {
        path: config.folderPath,
        collection: config.collectionName,
        last_indexed: new Date().toISOString(),
      };
      writeConfig(appConfig);
    } catch {
      // Non-critical
    }
  }

  // If creating new collection, save to config immediately
  if (config.collectionName) {
    addCollectionToConfig(config.collectionName);
  }

  // Fire and forget — don't await
  startEmbedding(config);

  return NextResponse.json({ success: true, message: "Embedding started" });
}
