// DreamDesk configuration — all knobs in one place.
// LIVE testnet trading activates only when DREAMDESK_PRIVATE_KEY is provided;
// otherwise the desk runs in PAPER mode against real market data.

export type DeskMode = "LIVE" | "PAPER";

export const DREAMDEX = {
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  chainName: "Somnia Shannon Testnet",
  chainId: 50312,
  explorerUrl: "https://shannon-explorer.somnia.network",
  collateralToken: "tUSDC",
  collateralDecimals: 6,
} as const;

export const DESK = {
  name: "DreamDesk",
  tagline: "The auditable agent trading desk for dreamDEX Event Contracts",
  version: "1.0.0",
  // Decision loop cadence while a session is RUNNING (ms)
  cycleIntervalMs: 12_000,
  // LLM council convenes only when signal activity exceeds this (or forced)
  quorumActivityThreshold: 0.55,
  // Risk governor gates
  minConfidence: 0.6,
  maxOpenPositions: 3,
  perTradeEquityShare: 0.05, // 5% of equity per trade
  sessionLossLimit: -15, // stop trading after -15 tUSDC realized
  cooldownMs: 20_000, // min gap between executions
  minExpiryHeadroomSec: 120, // skip markets expiring sooner than this
  minEdgeProb: 0.08, // require |modelProb - marketProb| edge
  paperSlippage: 0.01, // paper fills cross the touch by this
  sentimentCacheMs: 10 * 60_000, // sentiment agent refresh window
  priceHistoryLimit: 600, // ticks kept per asset for indicators
} as const;

export function deskPrivateKey(): string | null {
  const key = process.env.DREAMDESK_PRIVATE_KEY;
  if (!key || key.length < 64) return null;
  return key.startsWith("0x") ? key : `0x${key}`;
}

export function resolveMode(): { mode: DeskMode; reason: string } {
  if (deskPrivateKey()) {
    return { mode: "LIVE", reason: "Desk wallet configured — orders route to dreamDEX testnet" };
  }
  return {
    mode: "PAPER",
    reason: "No DREAMDESK_PRIVATE_KEY set — simulating fills on real testnet market data",
  };
}
