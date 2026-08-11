import { NextResponse } from "next/server";
import { resetState, requestStop } from "@/lib/embedding-engine";

export async function POST() {
  requestStop();
  resetState();
  return NextResponse.json({ success: true, message: "Reset complete" });
}
