// Direct unit exercise of the PaperAdapter fill path and settlement PnL math.
// Run: bun scripts/test-adapters.ts

import { PaperAdapter, priceForSide } from "../src/lib/desk/adapters";
import { computeAuditHash, GENESIS_HASH, verifyChain } from "../src/lib/desk/ledger";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures += 1;
}

async function main() {
  /* ---------------- PaperAdapter fills ---------------- */
  const adapter = new PaperAdapter();

  // Buy YES at 62¢ ask with 50 tUSDC → price 0.63 (+1¢ slippage), size ≈ 79.37
  const yes = await adapter.execute({
    symbol: "BTC-TEST/tUSDC#YES",
    side: "YES",
    notional: 50,
    quote: { bestBid: 0.6, bestAsk: 0.62, askDepth: 100 },
    modelProb: 0.75,
  });
  check("paper YES fill", yes.ok && yes.filled, `price ${yes.price}`);
  check("paper YES price = ask + 1¢", Math.abs(yes.price - 0.63) < 1e-9, String(yes.price));
  check("paper YES size = notional/price", Math.abs(yes.size - 50 / 0.63) < 1e-6, String(yes.size));

  // Buy NO at the same book → NO price = 1 − 0.63 = 0.37
  const no = await adapter.execute({
    symbol: "BTC-TEST/tUSDC#NO",
    side: "NO",
    notional: 50,
    quote: { bestBid: 0.6, bestAsk: 0.62, askDepth: 100 },
    modelProb: 0.3,
  });
  check("paper NO price = 1 − (ask+1¢)", Math.abs(no.price - 0.37) < 1e-9, String(no.price));

  // Empty book → honest skip
  const none = await adapter.execute({
    symbol: "BTC-TEST/tUSDC#YES",
    side: "YES",
    notional: 50,
    quote: { bestBid: null, bestAsk: null, askDepth: null },
    modelProb: 0.6,
  });
  check("paper empty book → no fill", none.ok && !none.filled, none.detail);

  /* ---------------- settlement PnL (fixed payout) ---------------- */
  const entry = 0.63;
  const size = 50 / entry;
  const winPnl = size * (1 - entry);
  const lossPnl = -size * entry;
  check("win pays size×(1−price)", Math.abs(winPnl - (50 / 0.63) * 0.37) < 1e-9, winPnl.toFixed(3));
  check("loss costs size×price", Math.abs(lossPnl + 50) < 1e-9, lossPnl.toFixed(3));
  check("asymmetry sanity: 63¢ ticket wins 29.37, loses 50", winPnl > 0 && lossPnl === -50);

  check("priceForSide(NO)", Math.abs(priceForSide("NO", 0.62) - 0.38) < 1e-9);
  check("priceForSide(YES)", priceForSide("YES", 0.62) === 0.62);

  /* ---------------- ledger hash chain ---------------- */
  const t0 = new Date("2026-01-01T00:00:00Z");
  const t1 = new Date("2026-01-01T00:00:01Z");
  const h0 = computeAuditHash({ prevHash: GENESIS_HASH, seq: 0, kind: "GENESIS", actor: "TEST", payload: "{}", ts: t0 });
  const h1 = computeAuditHash({ prevHash: h0, seq: 1, kind: "SIGNAL", actor: "MOMENTUM", payload: '{"direction":"UP"}', ts: t1 });
  const chain = [
    { seq: 0, kind: "GENESIS", actor: "TEST", payload: "{}", createdAt: t0, prevHash: GENESIS_HASH, hash: h0 },
    { seq: 1, kind: "SIGNAL", actor: "MOMENTUM", payload: '{"direction":"UP"}', createdAt: t1, prevHash: h0, hash: h1 },
  ];
  const ok = verifyChain(chain);
  check("verifyChain accepts intact chain", ok.ok, ok.detail);

  // Tamper with the payload → chain must break
  const tampered = chain.map((e) => (e.seq === 1 ? { ...e, payload: '{"direction":"DOWN"}' } : e));
  const bad = verifyChain(tampered);
  check("verifyChain rejects tampered payload", !bad.ok, bad.detail);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
