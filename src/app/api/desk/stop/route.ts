import { NextResponse } from "next/server";
import { engine } from "@/lib/desk/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await engine.stop();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
