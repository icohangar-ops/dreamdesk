import { NextResponse } from "next/server";
import { engine } from "@/lib/desk/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  if (engine.status !== "RUNNING") {
    return NextResponse.json({ ok: false, detail: "Start a session first" }, { status: 409 });
  }
  engine.forceCycle();
  return NextResponse.json({ ok: true, detail: "Full decision cycle forced — watch the council convene" });
}
