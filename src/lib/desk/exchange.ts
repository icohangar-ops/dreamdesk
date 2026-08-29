// dreamDEX testnet exchange wrapper.
//
// Lazily constructs the SomniaMarkets exchange bound to Somnia Shannon
// (chain 50312) and exposes the small surface DreamDesk needs:
//   - live binary market discovery with expiry headroom
//   - best quote for an outcome tradable
//   - wallet collateral balance (LIVE mode)
//   - testnet faucet (tUSDC mints on demand, cap 10,000)
//
// Market discovery goes through the SDK's unified market registry
// (`fetchMarkets`), which synthesizes the canonical symbols and the
// `#YES`/`#NO` tradables — we never hand-roll symbol strings.

import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, resolveIntervalSec } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
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
  __dreamdeskReadonly?: SomniaMarkets;
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
      privateKey: key as `0x${string}`,
    });
    return g.__dreamdeskExchange;
  } catch (e) {
    g.__dreamdeskExchangeErr = (e as Error).message;
    return null;
  }
}

/** Signer-less client for PAPER mode: market discovery, books and settlement
 *  reads all work without a wallet — only trading needs getExchange(). */
export function getReadonlyExchange(): SomniaMarkets | null {
  if (g.__dreamdeskReadonly) return g.__dreamdeskReadonly;
  try {
    g.__dreamdeskReadonly = new SomniaMarkets({
      indexerUrl: DREAMDEX.indexerUrl,
      chain: somniaShannon,
      wsRpcUrl: DREAMDEX.wsRpcUrl,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });
    return g.__dreamdeskReadonly;
  } catch (e) {
    g.__dreamdeskExchangeErr = (e as Error).message;
    return null;
  }
}

/** Signed when a wallet is configured, read-only otherwise. */
export function getAnyExchange(): SomniaMarkets | null {
  return getExchange() ?? getReadonlyExchange();
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
  const exchange = getAnyExchange();
  if (!exchange) return null;
  const now = Date.now() / 1000;
  try {
    // Unified market rows — binary entries carry `outcomes` with the
    // registry-canonical #YES / #NO tradable symbols, plus the raw row in `info`.
    const markets = await exchange.fetchMarkets();
    const candidates: (MarketCandidate & { score: number })[] = [];
    for (const um of markets) {
      if (um.type !== "binary" || !um.active) continue;
      const info = um.info as BinaryMarket;
      if ((info.asset ?? "").toUpperCase() !== asset.toUpperCase()) continue;
      const secondsLeft = Number(info.expiry) - now;
      if (secondsLeft < minHeadroomSec) continue;
      const up = um.outcomes?.find((o) => o.index === 0)?.symbol;
      const down = um.outcomes?.find((o) => o.index === 1)?.symbol;
      if (!up || !down) continue;
      const intervalSec = resolveIntervalSec(info);
      if (!intervalSec) continue;
      let onchainStatus = -1;
      try {
        const oc = await exchange.client.getMarketOnchain(info.marketId);
        onchainStatus = oc?.status ?? -1; // 1 = Trading
      } catch {
        onchainStatus = -1;
      }
      if (onchainStatus !== 1) continue;
      // Prefer the requested cadence, then more headroom, then more activity.
      const cadenceFit = intervalSec === cadenceSec ? 0 : Math.abs(intervalSec - cadenceSec);
      const score = cadenceFit * 10_000 + secondsLeft + Number(info.tradeCount ?? 0) * 5;
      candidates.push({
        marketId: String(info.marketId),
        asset: info.asset,
        intervalSec,
        expiry: Number(info.expiry),
        secondsLeft,
        upSymbol: up,
        downSymbol: down,
        lastUpProb: info.lastPrice != null ? Number(info.lastPrice) / 10 ** Number(info.quoteDecimals) : null,
        tradeCount: Number(info.tradeCount ?? 0),
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

/** Best quote on the Up (YES) tradable book. Prices are Up probabilities in (0,1). */
export async function fetchUpQuote(symbol: string): Promise<BookQuote> {
  const exchange = getAnyExchange();
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

/** Wallet collateral balance in human units (USDC-family tokens summed). */
export async function collateralBalance(address: string): Promise<number | null> {
  const exchange = getExchange();
  if (!exchange) return null;
  try {
    const bal = await exchange.fetchBalance();
    let total = 0;
    let seen = false;
    for (const [code, entry] of Object.entries(bal)) {
      if (!/USDC|USDS|USD/i.test(code)) continue;
      const t = (entry as { total?: number }).total;
      if (typeof t === "number" && isFinite(t)) {
        total += t;
        seen = true;
      }
    }
    void address; // balance is read for the configured signer
    return seen ? total : null;
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
    return exchange.walletAddress ?? null;
  } catch {
    return null;
  }
}
