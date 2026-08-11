import { NextRequest, NextResponse } from "next/server";

/**
 * Get indexed workspaces from Qdrant by scrolling points and aggregating
 * unique workspace/project combinations with their counts.
 *
 * Uses Qdrant's scroll API with payload filtering to get distinct workspaces.
 */
export async function GET(req: NextRequest) {
  const qdrantUrl = req.nextUrl.searchParams.get("url") || "http://localhost:6333";
  const collection = req.nextUrl.searchParams.get("collection") || "developer_ai";

  try {
    // Use Qdrant's scroll with grouping - get a sample of points to extract workspaces
    // We'll scroll through points and aggregate workspace/project combos
    const workspaces = new Map<string, { workspace: string; projects: Map<string, number>; totalChunks: number }>();

    let offset: string | number | null = null;
    let iterations = 0;
    const maxIterations = 50; // Safety cap — each scroll gets 100 points

    while (iterations < maxIterations) {
      const body: Record<string, unknown> = {
        limit: 100,
        with_payload: {
          include: ["source.workspace", "source.project"],
        },
        with_vector: false,
      };
      if (offset !== null) {
        body.offset = offset;
      }

      const resp = await fetch(`${qdrantUrl}/collections/${collection}/points/scroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`Qdrant error: ${resp.status}`);
      const data = await resp.json();
      const points = data.result?.points || [];

      if (points.length === 0) break;

      for (const point of points) {
        const ws = point.payload?.source?.workspace || "unknown";
        const proj = point.payload?.source?.project || "unknown";

        if (!workspaces.has(ws)) {
          workspaces.set(ws, { workspace: ws, projects: new Map(), totalChunks: 0 });
        }
        const entry = workspaces.get(ws)!;
        entry.totalChunks++;
        entry.projects.set(proj, (entry.projects.get(proj) || 0) + 1);
      }

      offset = data.result?.next_page_offset;
      if (offset === null || offset === undefined) break;
      iterations++;
    }

    // Convert to response format
    const result = Array.from(workspaces.values())
      .map((ws) => ({
        workspace: ws.workspace,
        totalChunks: ws.totalChunks,
        projects: Array.from(ws.projects.entries())
          .map(([name, chunks]) => ({ name, chunks }))
          .sort((a, b) => b.chunks - a.chunks),
      }))
      .sort((a, b) => b.totalChunks - a.totalChunks);

    return NextResponse.json({ success: true, workspaces: result, collection });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed", workspaces: [] },
      { status: 400 }
    );
  }
}
