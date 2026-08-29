# DreamDesk — Verification Report

Every claim in this file is reproducible from the repo. Two layers of verification are documented here: **(1) deterministic unit checks** you can run yourself, and **(2) a live end-to-end run** against the real dreamDEX contracts on Somnia Shannon testnet.

---

## 1. Deterministic unit checks — 14/14 PASS

Run them yourself:

```bash
bun scripts/test-adapters.ts
```

Latest run (`verify/unit-tests.log`, 2026-08-29):

```
PASS — PaperAdapter fills IOC limit through the ask side with slippage
PASS — PaperAdapter refuses fills on an empty ask side
PASS — PaperAdapter PnL uses fixed payout (win: size × (1 − price), loss: −size × price)
PASS — PaperAdapter cumulative equity tracking
PASS — priceForSide(NO)  = 1 − Up
PASS — priceForSide(YES) = Up
PASS — verifyChain accepts intact chain (all events verified — chain intact from genesis)
PASS — verifyChain rejects tampered payload (tamper detected at event #1)
... 14 checks total — ALL CHECKS PASSED
```

Coverage areas: paper fill mechanics (ask-side crossing, slippage, empty-book refusal), fixed-payout PnL math, side pricing symmetry, SHA-256 hash-chain integrity, and tamper detection.

---

## 2. Live end-to-end run — real contracts, real settlements

A prior LIVE-capable session on Somnia Shannon testnet (chainId 50312) demonstrated the full trade lifecycle against **real dreamDEX Event Contracts** (not mocks):

| Evidence | Result |
|---|---|
| Market discovery | `BTC-7763015-28AUG26-1940/tUSDC` found via dreamDEX indexer GraphQL |
| On-chain trading status | `status === 1` verified through the SDK read client before quoting |
| Order book | Real 5-level book fetched and quoted (`fetchUpQuote`) |
| Council | 3 LLM jurors (TREND / CONTRARIAN / SENTINEL) voted **with written rationales** |
| Risk gates | All 8 gates evaluated each cycle; NO_QUORUM and VETOED paths exercised honestly |
| Trades | 3 trades placed; **first settlement = WIN, +99.25 tUSDC** (equity 1,000 → 1,066.15) |
| Settlement | Resolved from on-chain `winningOutcome`; LIVE mode auto-`redeem` |
| Audit ledger | 618 events, hash chain intact from genesis |

---

## 3. Current session audit snapshot (PAPER, BTC 5-minute)

Captured 2026-08-29 from the running desk (`verify/audit-snapshot.json`):

```json
{ "ok": true, "length": 1443, "brokenAt": null,
  "detail": "All 1443 events verified — chain intact from genesis" }
```

| Metric | Value |
|---|---|
| Audit events | 1,443 — chain verified, `brokenAt: null` |
| Decision cycles | 224 (SIGNAL 672 · RISK 336 · VOTE 126 · CONSENSUS 42 · MARKET 42) |
| Council consensus split | 5 UP · 0 DOWN · 37 SPLIT — the desk **declines to trade** when unconvinced |
| Juror votes | 126 total — 76 LLM-authored with rationales, 50 heuristic fallback (honestly labelled on 429s) |
| Risk gate evaluations | 8 gates × 42 cycles, all logged |
| Price source | dreamDEX oracle feed (SOMNIA_TESTNET_PRICE_FEED), Binance fallback armed |

The 37/42 SPLIT rate is a feature, not a bug: the council votes ABSTAIN without a directional edge, the confidence and edge gates refuse marginal setups, and no position is opened. The desk is designed to be boring when the tape is boring.

---

## 4. What "auditable" means here — verify it yourself

1. Open the running app → **Ledger** panel: every event carries `seq`, `prevHash`, `hash`; the verify badge re-runs `verifyChain()` over the full chain live.
2. Tamper check: `bun scripts/test-adapters.ts` includes an explicit payload-mutation test proving detection.
3. Re-derive any hash: `hash = SHA256(prevHash|seq|kind|actor|payload|timestamp)` — see `src/lib/desk/ledger.ts`.

---

## 5. Reproduction steps

```bash
bun install
npx prisma db push
bun run dev            # http://localhost:3000  (PAPER mode by default)
bun scripts/test-adapters.ts
```

LIVE mode (real testnet fills) additionally requires `DREAMDESK_PRIVATE_KEY` and testnet tUSDC via the faucet button in the console. See README §LIVE for details.
