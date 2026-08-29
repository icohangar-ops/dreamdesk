// Probe live binary markets on Somnia Shannon testnet via markets-sdk
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

async function main() {
  const exchange = new SomniaMarkets({
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    chain: somniaShannon,
    wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });

  const now = Date.now() / 1000;
  const live = await exchange.client.listLiveBinaryMarkets({ limit: 20 });
  console.log(`LIVE BINARY MARKETS: ${live.length}`);
  for (const m of live.slice(0, 12)) {
    const secsLeft = Number(m.expiry) - now;
    const up = m.outcomes?.[0]?.symbol;
    const down = m.outcomes?.[1]?.symbol;
    console.log(JSON.stringify({
      marketId: String(m.marketId).slice(0, 12) + "…",
      asset: m.asset,
      intervalSec: Number(m.intervalSec),
      minsLeft: Math.round(secsLeft / 60),
      expiry: Number(m.expiry),
      upSymbol: up,
      downSymbol: down,
      lastPrice: m.lastPrice ? Number(m.lastPrice) / 1e6 : null,
      tradeCount: Number(m.tradeCount ?? 0),
    }));
  }

  // Probe price feed
  try {
    const h = await exchange.client.watchPrice("BTC");
    await new Promise(r => setTimeout(r, 3000));
    const p = h.get();
    console.log("BTC ORACLE PRICE:", p ? JSON.stringify(p).slice(0, 300) : "none yet");
    await h.close?.();
  } catch (e: unknown) {
    console.log("watchPrice error:", (e as Error).message);
  }
  process.exit(0);
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
