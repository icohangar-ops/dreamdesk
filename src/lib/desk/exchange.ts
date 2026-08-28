// dreamDEX testnet exchange wrapper.
//
// Lazily constructs the SomniaMarkets exchange bound to Somnia Shannon
// (chain 50312) and exposes the small surface DreamDesk needs:
//   - live binary market discovery with expiry headroom
//   - best quote for an outcome symbol
//   - wallet collateral balance (LIVE mode)
//   - testnet faucet (tUSDC mints on demand, cap 10,000)

import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { DREAMDEX, deskPrivateKey } from "./config";

export type MarketCandidate = {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number; // unix seconds
  secondsLeft: number;
  upSymbol: string;
  downSymbol: string;
  lastUpProb: number | null;
  tradeCount: number;
  onchainStatus: number;
};

export type BookQuote = {
  bestBid: number | null;
  bestAsk: number | null;
  askDepth: number | null;
};

const g = globalThis as unknown as {
  __dreamdeskExchange?: SomniaMarkets;
  __dreamdeskExchangeErr?: string;
};

export function getExchange(): SomniaMarkets | null {
  const key = deskPrivateKey();
  if (!key) return null;
  if (g.__dreamdeskExchange) return g.__dreamdeskExchange;
  try {
    g.__dreamdeskExchange = new SomniaMarkets({
      indexerUrl: DREAMDEX.indexerUrl,
      chain: somniaShannon,
      wsRpcUrl: DREAMDEX.wsRpcUrl,
      addresses: SOMNIA_TESTNET_ADDRESSES,
      privateKey: key,
    });
    return g.__dreamdeskExchange;
  } catch (e) {
    g.__dreamdeskExchangeErr = (e as Error).message;
    return null;
  }
}

export function exchangeError(): string | null {
  return g.__dreamdeskExchangeErr ?? null;
}

/** Pick the best live binary market for an asset: on-chain Trading status,
 *  enough expiry headroom to actually trade, and some book activity. */
export async function findMarket(
  asset: string,
  cadenceSec: number,
  minHeadroomSec: number
): Promise<MarketCandidate | null> {
  const exchange = getExchange();
  if (!exchange) return null;
  const now = Date.now() / 1000;
  try {
    const rows = await exchange.client.listLiveBinaryMarkets({ limit: 50 });
    const candidates: (MarketCandidate & { score: number })[] = [];
    for (const m of rows) {
      if ((m.asset ?? "").toUpperCase() !== asset.toUpperCase()) continue;
      const secondsLeft = Number(m.expiry) - now;
      if (secondsLeft < minHeadroomSec) continue;
      const up = m.outcomes?.[0]?.symbol;
      const down = m.outcomes?.[1]?.symbol;
      if (!up || !down) continue;
      let onchainStatus = -1;
      try {
        const oc = await exchange.client.getMarketOnchain(m.marketId as `0x${string}`);
        onchainStatus = oc?.status ?? -1; // 1 = Trading
      } catch {
        onchainStatus = -1;
      }
      if (onchainStatus !== 1) continue;
      // Prefer the requested cadence, then more headroom, then more activity.
      const cadenceFit = Number(m.intervalSec) === cadenceSec ? 0 : Math.abs(Number(m.intervalSec) - cadenceSec);
      const score = cadenceFit * 10_000 + secondsLeft + Number(m.tradeCount ?? 0) * 5;
      candidates.push({
        marketId: String(m.marketId),
        asset: m.asset,
        intervalSec: Number(m.intervalSec),
        expiry: Number(m.expiry),
        secondsLeft,
        upSymbol: up,
        downSymbol: down,
        lastUpProb: m.lastPrice != null ? Number(m.lastPrice) / 10 ** DREAMDEX.collateralDecimals : null,
        tradeCount: Number(m.tradeCount ?? 0),
        onchainStatus,
        score,
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

/** Best quote on the Up (YES) book. Prices are Up probabilities in (0,1). */
export async function fetchUpQuote(symbol: string): Promise<BookQuote> {
  const exchange = getExchange();
  if (!exchange) return { bestBid: null, bestAsk: null, askDepth: null };
  try {
    const book = await exchange.fetchOrderBook(symbol, 5);
    const bestBid = book.bids?.[0]?.[0] ?? null;
    const bestAsk = book.asks?.[0]?.[0] ?? null;
    const askDepth = book.asks?.[0]?.[1] ?? null;
    return { bestBid, bestAsk, askDepth };
  } catch {
    return { bestBid: null, bestAsk: null, askDepth: null };
  }
}

/** Wallet collateral balance in tUSDC (human units). */
export async function collateralBalance(address: string): Promise<number | null> {
  const exchange = getExchange();
  if (!exchange) return null;
  try {
    const pf = await exchange.client.getPortfolio(address);
    // Portfolio aggregates collateral across venues; tolerate shape drift.
    const anyPf = pf as unknown as Record<string, unknown>;
    const candidates = [anyPf.collateral, anyPf.usdsoBalance, anyPf.totalCollateral];
    for (const c of candidates) {
      if (typeof c === "number" && isFinite(c)) return c;
    }
    return null;
  } catch {
    return null;
  }
}

export async function claimFaucet(): Promise<{ ok: boolean; detail: string }> {
  const exchange = getExchange();
  if (!exchange) return { ok: false, detail: "LIVE mode requires DREAMDESK_PRIVATE_KEY" };
  try {
    await exchange.trader.faucet(); // 10,000 tUSDC (the cap)
    return { ok: true, detail: "Minted 10,000 tUSDC from the testnet faucet" };
  } catch (e) {
    return { ok: false, detail: `Faucet failed: ${(e as Error).message}` };
  }
}

export function walletAddress(): string | null {
  const exchange = getExchange();
  if (!exchange) return null;
  try {
    return (exchange as unknown as { account?: { address?: string } }).account?.address ?? null;
  } catch {
    return null;
  }
}
