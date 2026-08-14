import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/delete-project
 * Delete all points for a specific project within a workspace from Qdrant.
 * Uses Qdrant's points/delete with filter.
 */
export async function POST(req: NextRequest) {
  const { qdrantUrl, collection, workspace, project } = await req.json();

  if (!collection || !workspace || !project) {
    return NextResponse.json(
      { success: false, message: "Missing required fields: collection, workspace, project" },
      { status: 400 }
    );
  }

  const url = qdrantUrl || "http://localhost:6333";

  try {
    // Delete points matching workspace + project filter
    const resp = await fetch(`${url}/collections/${collection}/points/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: {
          must: [
            { key: "source.workspace", match: { value: workspace } },
            { key: "source.project", match: { value: project } },
          ],
        },
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Qdrant delete error: ${resp.status} ${errBody.slice(0, 200)}`);
    }

    const data = await resp.json();

    return NextResponse.json({
      success: true,
      message: `Deleted project "${project}" from workspace "${workspace}"`,
      result: data.result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
