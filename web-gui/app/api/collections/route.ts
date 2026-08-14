import { NextRequest, NextResponse } from "next/server";
import { addCollectionToConfig, removeCollectionFromConfig, syncCollectionsToConfig } from "@/lib/config-helper";

// GET — list collections (also syncs to config)
// Excludes web-scrape collections (source_type: web-scrape) from UI display
const HIDDEN_COLLECTIONS = ["web"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "http://localhost:6333";
  try {
    const collections = await syncCollectionsToConfig(url);
    // Filter out hidden collections (web-scrape type)
    const visible = collections.filter((c) => !HIDDEN_COLLECTIONS.includes(c.name));
    return NextResponse.json({
      success: true,
      collections: visible.map((c) => c.name),
      details: visible,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, collections: [], message: err instanceof Error ? err.message : "Failed" },
      { status: 400 }
    );
  }
}

// POST — create new collection (and save to config)
export async function POST(req: NextRequest) {
  const { url, name, vectorSize, description } = await req.json();
  const qdrantUrl = url || "http://localhost:6333";

  if (!name) {
    return NextResponse.json({ success: false, message: "Collection name is required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${qdrantUrl}/collections/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: { size: vectorSize || 768, distance: "Cosine" },
      }),
    });

    if (!resp.ok && resp.status !== 409) {
      throw new Error(`Qdrant error: ${resp.status}`);
    }

    // Save to config
    addCollectionToConfig(name, description || "");

    return NextResponse.json({ success: true, message: `Collection "${name}" created` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Create failed" },
      { status: 400 }
    );
  }
}

// DELETE — delete collection (and remove from config)
export async function DELETE(req: NextRequest) {
  const { url, name } = await req.json();
  const qdrantUrl = url || "http://localhost:6333";

  if (!name) {
    return NextResponse.json({ success: false, message: "Collection name is required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${qdrantUrl}/collections/${name}`, {
      method: "DELETE",
    });

    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Qdrant error: ${resp.status}`);
    }

    // Remove from config
    removeCollectionFromConfig(name);

    return NextResponse.json({ success: true, message: `Collection "${name}" deleted` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 }
    );
  }
}
