// ExecutionAdapter — the seam between "the desk decided" and "money moved".
//
// Both adapters return the same shape so the engine, ledger, and UI never
// branch on mode. LIVE routes to dreamDEX testnet via the markets SDK (IOC
// limit orders crossing the touch); PAPER simulates fills against the real
// book (or a synthetic probability when no book is reachable).

import type { BookQuote } from "../exchange";
import { DESK } from "../config";

export type ExecIntent = {
  symbol: string;
  side: "YES" | "NO"; // YES = buy Up contract, NO = buy Down contract
  notional: number; // collateral to spend
  quote: BookQuote; // best bid/ask on the UP book
  modelProb: number; // council's model probability for UP
};

export type ExecResult = {
  ok: boolean;
  filled: boolean;
  price: number; // probability paid (Up terms)
  size: number; // contracts
  notional: number;
  txHash: string | null;
  detail: string;
};

export interface ExecutionAdapter {
  readonly name: "dreamdex-testnet" | "paper";
  execute(intent: ExecIntent): Promise<ExecResult>;
}

/** Down price = 1 − Up price (single book, two sides). */
export function priceForSide(side: "YES" | "NO", upPrice: number): number {
  return side === "YES" ? upPrice : 1 - upPrice;
}

export class PaperAdapter implements ExecutionAdapter {
  readonly name = "paper" as const;

  async execute(intent: ExecIntent): Promise<ExecResult> {
    const upAsk = intent.quote.bestAsk;
    // No live book: settle on the model's own probability (synthetic venue).
    const base = upAsk ?? Math.min(0.97, Math.max(0.03, intent.modelProb));
    const upFill = Math.min(0.98, Math.max(0.02, base + DESK.paperSlippage));
    const fill = priceForSide(intent.side, upFill);
    const size = fill > 0 ? intent.notional / fill : 0;
    if (size <= 0) {
      return { ok: true, filled: false, price: fill, size: 0, notional: 0, txHash: null, detail: "Size rounded to zero — skipped" };
    }
    return {
      ok: true,
      filled: true,
      price: fill,
      size,
      notional: intent.notional,
      txHash: null,
      detail: `Simulated fill at ${(fill * 100).toFixed(1)}¢ (real ask ${(base * 100).toFixed(1)}¢ + ${DESK.paperSlippage * 100}¢ slippage)`,
    };
  }
}

export class LiveAdapter implements ExecutionAdapter {
  readonly name = "dreamdex-testnet" as const;

  async execute(intent: ExecIntent): Promise<ExecResult> {
    const { getExchange } = await import("../exchange");
    const exchange = getExchange();
    if (!exchange) {
      return { ok: false, filled: false, price: 0, size: 0, notional: 0, txHash: null, detail: "Exchange not initialized (missing key)" };
    }
    try {
      // Work in Up terms, then map the side to its outcome symbol.
      const upAsk = intent.quote.bestAsk;
      if (upAsk == null) {
        return { ok: true, filled: false, price: 0, size: 0, notional: 0, txHash: null, detail: "No resting liquidity on the Up book — skipped" };
      }
      const upPrice = Math.min(0.99, upAsk + 0.02); // cross the touch, IOC
      const upSymbol = intent.symbol.split("#")[0] + "#YES";
      const buySymbol = intent.side === "YES" ? upSymbol : intent.symbol.split("#")[0] + "#NO";
      const size = intent.notional / upPrice;
      // From 0.24.0 the unified tier snaps size to the venue's lot grid.
      const order = await exchange.createOrder(buySymbol, "limit", "buy", size, upPrice, {
        timeInForce: "IOC",
      });
      const receipt = (order.info as { receipt?: { transactionHash?: string } })?.receipt;
      const txHash = receipt?.transactionHash ?? null;
      return {
        ok: true,
        filled: true,
        price: intent.side === "YES" ? upPrice : 1 - upPrice,
        size,
        notional: intent.notional,
        txHash,
        detail: `IOC limit ${intent.side} ${size.toFixed(2)} @ ${(upPrice * 100).toFixed(1)}¢ Up — tx ${txHash?.slice(0, 18) ?? "pending"}…`,
      };
    } catch (e) {
      // Reverts throw decoded errors from 0.23.0 onward.
      return { ok: false, filled: false, price: 0, size: 0, notional: 0, txHash: null, detail: `Order rejected: ${(e as Error).message}` };
    }
  }
}
