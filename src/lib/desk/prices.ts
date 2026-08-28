// PriceManager — dual-feed price service.
//
// Primary: dreamDEX's on-chain EMA price feed (the same oracle index that
// settles event contracts) read one-shot from the price-feed indexer.
// Fallback: Binance spot REST — used automatically if the oracle feed is
// unreachable, so the desk keeps making decisions during indexing hiccups.
//
// Every tick is labeled with its source and stored in a per-asset ring buffer
// that quant agents consume.

import { getLivePrices } from "@somnia-chain/markets-sdk";
import { SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { DESK } from "./config";
import type { Tick } from "./indicators";

export type PriceSource = "ORACLE" | "MARKET" | "SYNTH";

export type PriceState = {
  asset: string;
  price: number;
  ema: number | null;
  source: PriceSource;
  ts: number;
  history: Tick[];
};

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
    for (const asset of this.states.keys()) {
      try {
        const [oracle] = await getLivePrices(SOMNIA_TESTNET_PRICE_FEED.url, [asset]);
        if (oracle && oracle.price > 0) {
          this.oracleHealthy = true;
          this.lastError = null;
          this.push(asset, oracle.price, oracle.ema ?? null, "ORACLE");
          continue;
        }
      } catch {
        // oracle read failed — fall through to Binance
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
          this.lastError = null;
          this.push(asset, p, null, "MARKET");
        }
      } catch (e) {
        this.lastError = (e as Error).message;
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
