import { NextResponse } from "next/server";
import { claimFaucet } from "@/lib/desk/exchange";
import { engine } from "@/lib/desk/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await claimFaucet();
  // Refresh collateral after a successful mint.
  if (result.ok && engine.wallet) {
    const { collateralBalance } = await import("@/lib/desk/exchange");
    engine.collateral = await collateralBalance(engine.wallet);
    engine.broadcast();
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
