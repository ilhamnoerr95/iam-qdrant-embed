import { NextResponse } from "next/server";
import { requestStop } from "@/lib/embedding-engine";

export async function POST() {
  requestStop();
  return NextResponse.json({ success: true, message: "Stop signal sent" });
}
