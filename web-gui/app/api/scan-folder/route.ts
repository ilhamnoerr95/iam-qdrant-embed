import { NextRequest, NextResponse } from "next/server";
import { statSync } from "fs";
import { scanFiles, getAllExtensions } from "@/lib/embedding-engine";

export async function POST(req: NextRequest) {
  const { path, includeSubfolders, chunkSize } = await req.json();

  if (!path) {
    return NextResponse.json({
      success: false,
      totalFiles: 0,
      totalSize: 0,
      estimatedChunks: 0,
      message: "No path provided",
    });
  }

  try {
    // Scan all supported files (code + docs combined)
    const extensions = getAllExtensions();
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
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      totalFiles: 0,
      totalSize: 0,
      estimatedChunks: 0,
      message: err instanceof Error ? err.message : "Scan failed",
    });
  }
}
