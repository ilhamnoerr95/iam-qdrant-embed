import { NextRequest, NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { readConfig } from "@/lib/config-helper";

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path") || homedir();
  const currentPath = resolve(rawPath);

  try {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    // Get indexed paths from config
    const config = readConfig();
    const indexedPaths = new Set<string>();
    if (config.workspace_paths) {
      for (const info of Object.values(config.workspace_paths)) {
        if (info.path) indexedPaths.add(info.path);
      }
    }

    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        const fullPath = join(currentPath, e.name);
        let hasChildren = false;
        try {
          const sub = readdirSync(fullPath, { withFileTypes: true });
          hasChildren = sub.some((s) => s.isDirectory() && !s.name.startsWith("."));
        } catch {
          // no access
        }

        // Check if this folder (or any parent) is indexed
        const isIndexed = indexedPaths.has(fullPath);

        // Check if any indexed path starts with this folder (contains indexed subfolder)
        const containsIndexed = [...indexedPaths].some((p) => p.startsWith(fullPath + "/"));

        return { name: e.name, path: fullPath, hasChildren, isIndexed, containsIndexed };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Check if current folder itself is indexed
    const currentIsIndexed = indexedPaths.has(currentPath);

    // Get parent path
    const parentPath = resolve(currentPath, "..");

    return NextResponse.json({
      success: true,
      currentPath,
      parentPath: parentPath !== currentPath ? parentPath : null,
      directories: dirs,
      currentIsIndexed,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Cannot read directory" },
      { status: 400 }
    );
  }
}
