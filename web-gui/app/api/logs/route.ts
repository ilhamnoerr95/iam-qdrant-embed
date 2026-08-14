import { NextRequest, NextResponse } from "next/server";
import { getLogs } from "@/lib/embedding-engine";

/**
 * GET /api/logs?since=<cursor>
 * Returns new logs since the given cursor (for incremental polling).
 */
export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? parseInt(sinceParam, 10) : undefined;

  const result = getLogs(since);
  return NextResponse.json(result);
}
