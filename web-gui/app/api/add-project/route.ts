import { NextRequest, NextResponse } from "next/server";
import { startEmbedding, getIsRunning } from "@/lib/embedding-engine";

/**
 * POST /api/add-project
 * Index a specific subfolder (project) within a workspace.
 */
export async function POST(req: NextRequest) {
  if (getIsRunning()) {
    return NextResponse.json({ success: false, message: "Embedding already running" }, { status: 400 });
  }

  const { qdrantUrl, ollamaUrl, model, chunkSize, chunkOverlap, collectionName, vectorSize, workspace, projectPath, projectName } = await req.json();

  if (!workspace || !projectPath || !projectName || !collectionName || !model) {
    return NextResponse.json(
      { success: false, message: "Missing required fields: workspace, projectPath, projectName, collectionName, model" },
      { status: 400 }
    );
  }

  // Fire and forget
  startEmbedding({
    qdrantUrl: qdrantUrl || "http://localhost:6333",
    ollamaUrl: ollamaUrl || "http://localhost:11434",
    model,
    chunkSize: chunkSize || 500,
    chunkOverlap: chunkOverlap || 50,
    collectionName,
    createNew: false,
    vectorSize: vectorSize || 768,
    folderPath: projectPath,
    includeSubfolders: true,
    workspace,
    project: projectName,
  });

  return NextResponse.json({ success: true, message: `Indexing project "${projectName}" started` });
}
