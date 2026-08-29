import { NextResponse } from "next/server";
import { engine } from "@/lib/desk/engine";
import type { DeskMode } from "@/lib/desk/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      asset?: string;
      cadenceSec?: number;
      mode?: DeskMode;
    };
    const asset = ["BTC", "ETH"].includes((body.asset ?? "").toUpperCase()) ? body.asset!.toUpperCase() : "BTC";
    const cadenceSec = [300, 3600].includes(Number(body.cadenceSec)) ? Number(body.cadenceSec) : 300;
    const mode = body.mode === "LIVE" || body.mode === "PAPER" ? body.mode : undefined;
    const result = await engine.start(asset, cadenceSec, mode);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}
