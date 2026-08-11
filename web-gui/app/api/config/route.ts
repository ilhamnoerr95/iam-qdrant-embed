import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Config lives in the parent qdrant directory
const CONFIG_PATH = resolve(process.cwd(), "../qdrant_config.json");

export async function GET() {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(content);
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Config not found" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    return NextResponse.json({ success: true, message: "Config saved" });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Save failed" },
      { status: 400 }
    );
  }
}
