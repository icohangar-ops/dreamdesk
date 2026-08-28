// Signal agents — the desk's research department.
//
// Two deterministic quant agents (momentum, volatility) read the price ring
// buffer; one LLM agent (sentiment) reads the news backdrop via the z-ai SDK
// with a cache window. Every reading is persisted so the council — and any
// auditor — can trace the exact inputs behind a trade.

import { ema, emaSeries, rateOfChange, tickVolatility, zScore, rsi, clamp01 } from "./indicators";
import { DESK } from "./config";

export type AgentName = "MOMENTUM" | "VOLATILITY" | "SENTIMENT";
export type Direction = "UP" | "DOWN" | "FLAT";

export type SignalPacket = {
  agent: AgentName;
  direction: Direction;
  strength: number; // 0..1 — how hard the signal leans
  confidence: number; // 0..1 — how trustworthy the reading is
  detail: string; // human-readable explanation for the UI + council
  data: Record<string, number | string>; // raw numbers for audit
};

/* ------------------------------- MOMENTUM -------------------------------- */

export function momentumAgent(asset: string, series: number[]): SignalPacket {
  if (series.length < 30) {
    return {
      agent: "MOMENTUM",
      direction: "FLAT",
      strength: 0,
      confidence: 0.2,
      detail: `Warming up — ${series.length}/30 ticks buffered for ${asset}.`,
      data: { ticks: series.length },
    };
  }
  const fast = ema(series.slice(-40), 9);
  const slow = ema(series.slice(-80), 21);
  const roc = rateOfChange(series, Math.min(30, series.length - 1));
  const spread = slow !== 0 ? (fast - slow) / slow : 0; // relative EMA spread

  let direction: Direction = "FLAT";
  if (spread > 0.00012 || roc > 0.0006) direction = "UP";
  else if (spread < -0.00012 || roc < -0.0006) direction = "DOWN";

  const magnitude = clamp01(Math.abs(spread) / 0.0012 * 0.7 + Math.abs(roc) / 0.003 * 0.3);
  const strength = direction === "FLAT" ? 0.1 : clamp01(0.25 + magnitude * 0.75);
  const confidence = clamp01(0.4 + magnitude * 0.5);

  return {
    agent: "MOMENTUM",
    direction,
    strength,
    confidence,
    detail:
      direction === "FLAT"
        ? `EMA9 ≈ EMA21 (spread ${(spread * 100).toFixed(3)}%) — no directional edge on ${asset}.`
        : `${direction} bias: EMA9 ${spread >= 0 ? "above" : "below"} EMA21 by ${(Math.abs(spread) * 100).toFixed(3)}%, ${Math.abs(roc * 100).toFixed(3)}% 30-tick rate-of-change.`,
    data: {
      ema9: Number(fast.toFixed(2)),
      ema21: Number(slow.toFixed(2)),
      spreadPct: Number((spread * 100).toFixed(4)),
      roc30Pct: Number((roc * 100).toFixed(4)),
      rsi14: Number(rsi(series).toFixed(1)),
    },
  };
}

/* ------------------------------ VOLATILITY ------------------------------- */

export function volatilityAgent(asset: string, series: number[]): SignalPacket {
  if (series.length < 20) {
    return {
      agent: "VOLATILITY",
      direction: "FLAT",
      strength: 0,
      confidence: 0.2,
      detail: `Insufficient tick history for a volatility read (${series.length}/20).`,
      data: { ticks: series.length },
    };
  }
  const vol = tickVolatility(series, 60);
  const z = zScore(series, 60);
  const volPct = vol * 100;

  // Quiet tape: mean-reversion regime, breakout trades less reliable.
  // Violent tape: chase only extreme z-scores.
  let direction: Direction = "FLAT";
  if (z > 1.3) direction = "UP";
  else if (z < -1.3) direction = "DOWN";

  const regime = volPct < 0.008 ? "quiet" : volPct < 0.03 ? "normal" : "violent";
  const strength = direction === "FLAT" ? 0.1 : clamp01(Math.abs(z) / 2.5);
  const confidence = regime === "quiet" ? clamp01(0.35 + Math.abs(z) * 0.15) : clamp01(0.45 + Math.abs(z) * 0.2);

  return {
    agent: "VOLATILITY",
    direction,
    strength,
    confidence,
    detail:
      direction === "FLAT"
        ? `${regime.charAt(0).toUpperCase() + regime.slice(1)} tape (σ_tick ${volPct.toFixed(3)}%, z ${z.toFixed(2)}) — waiting for a statistical stretch on ${asset}.`
        : `${direction} breakout: price ${z.toFixed(2)}σ off the 60-tick mean in a ${regime} tape (σ_tick ${volPct.toFixed(3)}%).`,
    data: {
      sigmaTickPct: Number(volPct.toFixed(4)),
      z60: Number(z.toFixed(2)),
      regime,
    },
  };
}

/* ------------------------------- SENTIMENT ------------------------------- */

type SentimentCache = { ts: number; packet: SignalPacket; asset: string };
const g = globalThis as unknown as { __dreamdeskSentiment?: SentimentCache };

export async function sentimentAgent(asset: string): Promise<SignalPacket> {
  const cached = g.__dreamdeskSentiment;
  if (cached && cached.asset === asset && Date.now() - cached.ts < DESK.sentimentCacheMs) {
    return { ...cached.packet, data: { ...cached.packet.data, cachedFor: Math.round((DESK.sentimentCacheMs - (Date.now() - cached.ts)) / 1000) + "s" } };
  }

  let packet: SignalPacket;
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const prompt = `You are the news-sentiment analyst on a ${asset} trading desk. Assess the short-term (next 15-60 minutes) directional bias for ${asset} based on your knowledge of current market conditions, macro backdrop, and typical intraday dynamics. Respond with ONLY a JSON object:
{"direction":"UP"|"DOWN"|"FLAT","confidence":0..1,"headline":"one-sentence market read","drivers":["driver1","driver2"]}`;
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a precise crypto market sentiment analyst. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON in LLM response");
    const parsed = JSON.parse(match[0]) as { direction: string; confidence: number; headline: string; drivers: string[] };
    const dir = ["UP", "DOWN", "FLAT"].includes(parsed.direction) ? (parsed.direction as Direction) : "FLAT";
    packet = {
      agent: "SENTIMENT",
      direction: dir,
      strength: dir === "FLAT" ? 0.1 : clamp01(parsed.confidence),
      confidence: clamp01(parsed.confidence),
      detail: `LLM read: ${parsed.headline} Drivers: ${parsed.drivers?.slice(0, 3).join("; ") || "none listed"}.`,
      data: { drivers: parsed.drivers?.slice(0, 3).join(" | ") ?? "", engine: "z-ai LLM" },
    };
  } catch (e) {
    // Honest fallback: label it as such rather than pretending the LLM spoke.
    packet = {
      agent: "SENTIMENT",
      direction: "FLAT",
      strength: 0,
      confidence: 0.15,
      detail: `Sentiment feed unavailable (${((e as Error).message || "LLM error").slice(0, 80)}) — abstaining this cycle.`,
      data: { engine: "fallback" },
    };
  }

  g.__dreamdeskSentiment = { ts: Date.now(), packet, asset };
  return packet;
}
