import { NextResponse } from "next/server";
import { engine } from "@/lib/desk/engine";
import { resolveMode } from "@/lib/desk/config";
import { prices } from "@/lib/desk/prices";
import { exchangeError } from "@/lib/desk/exchange";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = resolveMode();
  // Warm the price feed even while idle so the ticker strip is alive on load.
  prices.ensurePolling(["BTC", "ETH"]);
  return NextResponse.json({
    ...engine.snapshot(),
    canGoLive: resolved.mode === "LIVE",
    resolvedMode: resolved.mode,
    exchangeError: exchangeError(),
  });
}
