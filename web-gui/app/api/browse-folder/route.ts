import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path") || homedir();
  const currentPath = resolve(rawPath);

  try {
    const entries = readdirSync(currentPath, { withFileTypes: true });
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
        return { name: e.name, path: fullPath, hasChildren };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Get parent path
    const parentPath = resolve(currentPath, "..");

    return NextResponse.json({
      success: true,
      currentPath,
      parentPath: parentPath !== currentPath ? parentPath : null,
      directories: dirs,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Cannot read directory" },
      { status: 400 }
    );
  }
}
