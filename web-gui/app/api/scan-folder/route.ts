import { NextRequest, NextResponse } from "next/server";
import { statSync } from "fs";
import { scanFiles, getExtensionsForSourceType } from "@/lib/embedding-engine";
import type { SourceType } from "@/lib/embedding-engine";

export async function POST(req: NextRequest) {
  const { path, sourceType, includeSubfolders, chunkSize, autoDetect } = await req.json();

  if (!path) {
    return NextResponse.json({
      success: false,
      totalFiles: 0,
      totalSize: 0,
      estimatedChunks: 0,
      detectedSourceType: "workspace",
      message: "No path provided",
    });
  }

  try {
    // Auto-detect source_type by scanning both and comparing counts
    let detectedSourceType: SourceType = sourceType || "workspace";

    if (autoDetect || !sourceType) {
      const codeFiles = scanFiles(path, getExtensionsForSourceType("workspace"), includeSubfolders ?? true);
      const docFiles = scanFiles(path, getExtensionsForSourceType("documentation"), includeSubfolders ?? true);
      // If docs outnumber code files, it's documentation; otherwise workspace
      detectedSourceType = docFiles.length > codeFiles.length ? "documentation" : "workspace";
    }

    const st: SourceType = detectedSourceType;
    const extensions = getExtensionsForSourceType(st);
    const files = scanFiles(path, extensions, includeSubfolders ?? true);
    let totalSize = 0;
    let estimatedChunks = 0;
    const cs = chunkSize || 500;

    for (const f of files) {
      try {
        const size = statSync(f).size;
        totalSize += size;
        estimatedChunks += Math.max(1, Math.floor(size / cs));
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      totalSize,
      estimatedChunks,
      detectedSourceType,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      totalFiles: 0,
      totalSize: 0,
      estimatedChunks: 0,
      detectedSourceType: "workspace",
      message: err instanceof Error ? err.message : "Scan failed",
    });
  }
}
