import { NextResponse } from "next/server";
import { getProgress } from "@/lib/embedding-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getProgress());
}
