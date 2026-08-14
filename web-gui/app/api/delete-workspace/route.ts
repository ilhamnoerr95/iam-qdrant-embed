import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config-helper";

/**
 * POST /api/delete-workspace
 * Delete all points for a workspace from Qdrant and remove from config.
 */
export async function POST(req: NextRequest) {
  const { qdrantUrl, collection, workspace } = await req.json();

  if (!collection || !workspace) {
    return NextResponse.json(
      { success: false, message: "Missing required fields: collection, workspace" },
      { status: 400 }
    );
  }

  const url = qdrantUrl || "http://localhost:6333";

  try {
    // Delete all points matching workspace filter
    const resp = await fetch(`${url}/collections/${collection}/points/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: {
          must: [
            { key: "source.workspace", match: { value: workspace } },
          ],
        },
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Qdrant delete error: ${resp.status} ${errBody.slice(0, 200)}`);
    }

    // Also remove from config workspace_paths
    try {
      const appConfig = readConfig();
      if (appConfig.workspace_paths) {
        const wsKey = workspace.toLowerCase();
        // Remove exact match and case-insensitive match
        for (const key of Object.keys(appConfig.workspace_paths)) {
          if (key.toLowerCase() === wsKey) {
            delete appConfig.workspace_paths[key];
          }
        }
        writeConfig(appConfig);
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      message: `Workspace "${workspace}" deleted (all projects removed)`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
