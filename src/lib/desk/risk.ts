// RiskGovernor — deterministic gates between the council's opinion and the
// executor. No LLM here on purpose: risk limits must be boring, explainable,
// and impossible to argue with. Every check is persisted and audited.

import { DESK } from "./config";

export type RiskContext = {
  now: number;
  lastExecAt: number | null;
  openPositions: number;
  realizedPnl: number;
  sessionAgeMs: number;
  councilConfidence: number; // 0..1 mean juror conviction on the winning side
  edge: number; // SIGNED value edge: model prob of the chosen side minus the price the venue charges
  secondsLeft: number | null;
  onchainStatusOk: boolean;
  hasMarket: boolean;
};

export type RiskGate = { gate: string; passed: boolean; detail: string };

export function runRiskGates(ctx: RiskContext): { gates: RiskGate[]; pass: boolean } {
  const gates: RiskGate[] = [];

  gates.push({
    gate: "Market selected",
    passed: ctx.hasMarket,
    detail: ctx.hasMarket ? "Live dreamDEX event contract matched" : "No eligible contract for this asset/cadence right now",
  });

  gates.push({
    gate: "On-chain trading status",
    passed: ctx.onchainStatusOk,
    detail: ctx.onchainStatusOk ? "Market status = Trading (verified on-chain)" : "Market not in Trading state on-chain (indexer may lag)",
  });

  const headroomOk = ctx.secondsLeft != null && ctx.secondsLeft >= DESK.minExpiryHeadroomSec;
  gates.push({
    gate: "Expiry headroom",
    passed: headroomOk,
    detail: ctx.secondsLeft != null ? `${Math.round(ctx.secondsLeft)}s left (min ${DESK.minExpiryHeadroomSec}s)` : "Expiry unknown",
  });

  const confOk = ctx.councilConfidence >= DESK.minConfidence;
  gates.push({
    gate: `Council confidence ≥ ${DESK.minConfidence}`,
    passed: confOk,
    detail: `Winning-side conviction ${ctx.councilConfidence.toFixed(2)}`,
  });

  // Signed edge: the desk only buys when the council's probability for the
  // chosen side clears the venue's price by the minimum margin. Negative edge
  // means the venue already charges more than we believe the side is worth.
  const edgeOk = ctx.edge >= DESK.minEdgeProb;
  gates.push({
    gate: `Edge ≥ ${(DESK.minEdgeProb * 100).toFixed(0)}¢`,
    passed: edgeOk,
    detail: `${ctx.edge >= 0 ? "+" : "−"}${Math.abs(ctx.edge * 100).toFixed(1)}¢ value vs venue ask`,
  });

  const posOk = ctx.openPositions < DESK.maxOpenPositions;
  gates.push({
    gate: `Open positions < ${DESK.maxOpenPositions}`,
    passed: posOk,
    detail: `${ctx.openPositions} open`,
  });

  const cooldownOk = ctx.lastExecAt == null || ctx.now - ctx.lastExecAt >= DESK.cooldownMs;
  gates.push({
    gate: `Cooldown ${DESK.cooldownMs / 1000}s`,
    passed: cooldownOk,
    detail: ctx.lastExecAt ? `${Math.round((ctx.now - ctx.lastExecAt) / 1000)}s since last execution` : "No prior execution",
  });

  const lossOk = ctx.realizedPnl > DESK.sessionLossLimit;
  gates.push({
    gate: "Session loss limit",
    passed: lossOk,
    detail: `Realized ${ctx.realizedPnl.toFixed(2)} tUSDC (limit ${DESK.sessionLossLimit})`,
  });

  return { gates, pass: gates.every((g) => g.passed) };
}
