// PriceManager — dual-feed price service.
//
// Primary: dreamDEX's on-chain price oracle (the same index that settles
// event contracts), read one-shot from the price-feed GraphQL indexer.
// Values come back as 18-decimal fixed point and are scaled to floats here.
// Fallback: Binance spot REST — used automatically if the oracle feed is
// unreachable, so the desk keeps making decisions during indexing hiccups.
//
// Every tick is labeled with its source and stored in a per-asset ring buffer
// that quant agents consume.

import { DESK } from "./config";
import type { Tick } from "./indicators";

const PRICE_FEED_URL = "https://price-feed.dev.oracle.somnia.host/v1/graphql";
const FEED_DECIMALS = 10 ** 18; // oracle posts fixed-point 1e18 values
const SYMBOL_MAP: Record<string, string> = { BTC: "BTC/USDC", ETH: "ETH/USDC" };

export type PriceSource = "ORACLE" | "MARKET" | "SYNTH";

export type PriceState = {
  asset: string;
  price: number;
  ema: number | null;
  source: PriceSource;
  ts: number;
  history: Tick[];
};

/** One alias per asset → single round-trip for the whole watchlist. */
function oracleQuery(assets: string[]): string {
  const parts = assets
    .filter((a) => SYMBOL_MAP[a])
    .map(
      (a, i) =>
        `a${i}: PricePoint(limit: 1, order_by: {blockTimestamp: desc}, where: {symbol: {_eq: "${SYMBOL_MAP[a]}"}}) { base spot mark blockTimestamp }`,
    );
  return `{ ${parts.join(" ")} }`;
}

type OraclePoint = { base: string; spot: string; mark: string; blockTimestamp: string };

async function fetchOracle(assets: string[]): Promise<Map<string, { spot: number; mark: number }>> {
  const out = new Map<string, { spot: number; mark: number }>();
  const res = await fetch(PRICE_FEED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: oracleQuery(assets) }),
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`price feed HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, OraclePoint[] | null>; errors?: unknown };
  if (!json.data || json.errors) throw new Error("price feed returned no data");
  for (const [i, asset] of assets.filter((a) => SYMBOL_MAP[a]).entries()) {
    const row = json.data[`a${i}`]?.[0];
    const spot = row ? Number(row.spot) / FEED_DECIMALS : 0;
    const mark = row ? Number(row.mark) / FEED_DECIMALS : 0;
    if (spot > 0) out.set(asset, { spot, mark });
  }
  return out;
}

const BINANCE_MAP: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT" };

class PriceManager {
  private states = new Map<string, PriceState>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private pollMs = 4_000;
  lastError: string | null = null;
  oracleHealthy = false;

  ensurePolling(assets: string[]) {
    for (const a of assets) {
      if (!this.states.has(a)) {
        this.states.set(a, { asset: a, price: 0, ema: null, source: "MARKET", ts: 0, history: [] });
      }
    }
    if (!this.timer) {
      this.timer = setInterval(() => void this.refresh(), this.pollMs);
      void this.refresh(); // first pull immediately
    }
  }

  stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get(asset: string): PriceState | null {
    return this.states.get(asset.toUpperCase()) ?? null;
  }

  all(): PriceState[] {
    return [...this.states.values()];
  }

  /** History snapshot for indicator math (oldest → newest). */
  series(asset: string): number[] {
    const s = this.states.get(asset.toUpperCase());
    return s ? s.history.map((t) => t.price) : [];
  }

  private async refresh() {
    const assets = [...this.states.keys()];
    if (assets.length === 0) return;

    let oracleReads: Map<string, { spot: number; mark: number }> | null = null;
    try {
      oracleReads = await fetchOracle(assets);
    } catch (e) {
      this.lastError = `oracle: ${(e as Error).message}`;
    }

    for (const asset of assets) {
      const oracle = oracleReads?.get(asset);
      if (oracle) {
        this.oracleHealthy = true;
        this.lastError = null;
        this.push(asset, oracle.spot, oracle.mark, "ORACLE");
        continue;
      }
      try {
        const sym = BINANCE_MAP[asset];
        if (!sym) continue;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { price?: string };
        const p = Number(json.price);
        if (p > 0) {
          this.oracleHealthy = false;
          this.push(asset, p, null, "MARKET");
        }
      } catch (e) {
        this.lastError = `${asset} fallback: ${(e as Error).message}`;
      }
    }
  }

  private push(asset: string, price: number, ema: number | null, source: PriceSource) {
    const s = this.states.get(asset)!;
    const ts = Date.now();
    s.price = price;
    s.ema = ema;
    s.source = source;
    s.ts = ts;
    s.history.push({ ts, price });
    if (s.history.length > DESK.priceHistoryLimit) s.history.shift();
  }
}

// Singleton across HMR reloads
const g = globalThis as unknown as { __dreamdeskPrices?: PriceManager };
export const prices: PriceManager = g.__dreamdeskPrices ?? new PriceManager();
g.__dreamdeskPrices = prices;
