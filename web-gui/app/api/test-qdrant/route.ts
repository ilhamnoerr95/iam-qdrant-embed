import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  try {
    const resp = await fetch(`${url}/collections`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return NextResponse.json({ success: true, message: "Connected" });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Connection failed" },
      { status: 400 }
    );
  }
}
