import { NextResponse } from "next/server";
import { engine } from "@/lib/desk/engine";
import { resolveMode } from "@/lib/desk/config";
import { exchangeError } from "@/lib/desk/exchange";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = resolveMode();
  return NextResponse.json({
    ...engine.snapshot(),
    canGoLive: resolved.mode === "LIVE",
    resolvedMode: resolved.mode,
    exchangeError: exchangeError(),
  });
}
