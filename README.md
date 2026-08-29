# DreamDesk

**An auditable multi-agent trading desk for [dreamDEX Event Contracts](https://docs.dreamdex.exchange/developers/event-contracts/quick-start) on the Somnia Shannon testnet.**

DreamDesk runs a small autonomous trading operation: three quant/AI signal agents read the market, a council of three LLM jurors debates and votes, eight deterministic risk gates vet every proposal, and the desk executes binary Up/Down event contracts through dreamDEX's on-chain order book — writing every single step to a tamper-evident, hash-chained audit ledger as it goes.

> Built for the [dreamDEX × Somnia Event Contracts Hackathon](https://dorahacks.io/hackathon/event-contracts/detail).

![DreamDesk trading floor — signal agents, live oracle price, and the decision pipeline](docs/screenshots/trading-floor-top.png)

*Top: console, live oracle tape, decision pipeline, and the three signal agents. Below: juror cards with written rationales, the eight risk gates, positions marked to market, and the live hash-chained ledger.*

![DreamDesk council chamber, risk gates and audit ledger](docs/screenshots/trading-floor-panels.png)

---

## Why this exists

Event contracts are the simplest instrument in crypto: *will BTC close above its opening price in the next 5 minutes — yes or no?* Fixed payout, zero fees, fully on-chain. That simplicity makes them the perfect stage for an **auditable autonomous agent**: there is nowhere to hide. Every decision — signal, vote, veto, fill, settlement — can be written down, hashed, and replayed.

DreamDesk is built around one rule: **an autonomous desk must show its work.** Not a black-box bot with a P&L chart — a trading room with the glass wall removed. Judges (and regulators, and risk officers) can watch three AI jurors disagree, watch a risk gate veto the whole council, and verify that not a single line of the story was edited after the fact.

## Architecture

```
                     ┌──────────────────────────────────────────────────┐
                     │                 Somnia Shannon                   │
                     │  dreamDEX BinaryMarketsModule · OracleHub · DEX  │
                     └────────▲───────────────┬─────────────────────────┘
                              │ IOC limit     │ settlement +
                              │ orders        │ redemption receipts
┌─────────────────────────────┴───────────────────────────────────────────┐
│                              DeskEngine                                 │
│                                                                         │
│  01 SIGNAL AGENTS          02 COUNCIL CHAMBER      03 RISK GATES        │
│  ├─ MOMENTUM   (EMA9/21,   ├─ Juror TREND          ├─ market selected   │
│  │   ROC-30)               │   rides momentum      ├─ on-chain status  │
│  ├─ VOLATILITY (σ, z-60,   ├─ Juror CONTRARIAN     ├─ expiry headroom  │
│  │   regime classifier)    │   fades the crowd     ├─ confidence ≥ 0.6 │
│  ├─ SENTIMENT  (LLM read,  ├─ Juror SENTINEL      ├─ edge ≥ 8¢        │
│  │   10-min cache,         │   protects the desk   ├─ max open: 3      │
│  │   abstains honestly)    │                       ├─ cooldown 20s     │
│  └─ every packet carries   └─ 2/3 weighted YES     ├─ session stop −15%│
│     raw numbers for audit     required to clear    └─ deterministic —  │
│                                                    no LLM may overrule│
│  04 EXECUTION              05 AUDIT LEDGER                             │
│  ├─ LIVE: real orders      ├─ every step → SHA-256 event               │
│  │   (IOC limit, +2¢)      ├─ prevHash-chained, tamper-evident         │
│  └─ PAPER: simulated fills ├─ /api/desk/audit verifies the full chain  │
│      at venue prices (+1¢) └─ UI replays the entire session             │
└─────────────────────────────────────────────────────────────────────────┘
```

**The pipeline is deliberate:** deterministic quant signals anchor the debate (they can be regression-tested), the LLM council adds context and second-order reasoning (it can be wrong, so it votes rather than decides), and the risk layer is pure code (it cannot be talked into anything). Three different failure modes, three independent layers.

## Trust & safety model

| Layer | Brain | Can it be wrong? | Contained by |
|---|---|---|---|
| Signal agents | Deterministic math + one cached LLM | Yes | Raw numbers attached to every packet |
| Council | 3 × GLM LLM jurors, opposed mandates | Yes — often | Needs 2/3 weighted votes; votes, doesn't execute |
| Risk gates | Pure TypeScript | No | Hard-coded; veto is absolute |
| Execution | IOC limit orders only | Slippage | Per-trade equity share cap (5%) |

Additional guardrails: max 3 concurrent positions, 20s cooldown between executions, 120s minimum expiry headroom (never buy a coin-flip), 8¢ minimum edge between council probability and venue price, and a −15% session loss limit that halts the desk.

**Dual-mode execution.** With a funded wallet key configured the desk trades LIVE on Somnia Shannon (chainId `50312`), signing real IOC limit orders and auto-redeeming wins. Without a key it runs an isomorphic PAPER desk — same signals, same council, same gates — filling at live venue prices with a +1¢ slippage model. The mode badge and the audit ledger always tell you which world you're in.

## Getting started

```bash
# 1. install
bun install          # or npm install / pnpm install

# 2. environment (optional — omit to run in PAPER mode)
echo 'DATABASE_URL="file:./db/custom.db"' >> .env
# LIVE mode only: a funded Somnia Shannon testnet wallet (get tSTT + tUSDC from the faucets)
echo 'DREAMDESK_PRIVATE_KEY="0x..."' >> .env

# 3. database
bunx prisma db push

# 4. run
bun run dev          # http://localhost:3000
```

### Going live (testnet)

1. Create a fresh wallet for the desk (never reuse a personal key).
2. Fund it from the Somnia Shannon faucets (~10,000 tUSDC max from the dreamDEX faucet — the UI's **Faucet** button claims it for you when LIVE).
3. Set `DREAMDESK_PRIVATE_KEY` and restart. The badge flips to **LIVE · SOMNIA SHANNON**.
4. Start the desk, press **Force cycle**, and watch the full pipeline.

## Demo video (3 min)

A narrated walkthrough — the pipeline, the council, the gates, and the hash-chain ledger, all live:

- `docs/demo/dreamdesk-demo-3min.mp4` (also attached to the DoraHacks BUIDL)
- Thumbnail: `docs/screenshots/thumbnail-1280x720.png`

[![DreamDesk demo thumbnail](docs/screenshots/thumbnail-1280x720.png)](docs/demo/dreamdesk-demo-3min.mp4)

## The UI — a trading room with a glass wall

- **Console** — mode badge (LIVE/PAPER with reason), asset + window selects, start/stop, force cycle, faucet. Equity, realized PnL, wallet collateral, win rate.
- **Decision pipeline** — the engine's six phases (`gathering → convening → risk → executing → settling → cooldown`) light up in real time over SSE.
- **01 Signal Agents** — each agent's direction, strength bar, confidence, and a plain-English reading with raw indicator values.
- **02 Council Chamber** — three juror cards with vote, confidence, rationale, and which brain produced it (`llm` or `heuristic`). Disagreement is on display, not hidden.
- **03 Risk Gates** — all eight gates with pass/fail and the exact reason. Watch a veto happen live.
- **04 Order Book** — open positions marked to market every tick, settlement history with tx hashes and realized PnL per contract.
- **05 Audit Ledger** — the tail of the hash chain, with a live **chain intact / broken** verification badge.

## API reference

| Route | Method | Purpose |
|---|---|---|
| `/api/desk/status` | GET | Full desk snapshot (mode, phase, agents, decision, positions, stats, audit tail) |
| `/api/desk/start` | POST | Start session — `{ asset: "BTC"\|"ETH", cadenceSec: 300\|3600, mode?: "LIVE"\|"PAPER" }` |
| `/api/desk/stop` | POST | Stop session |
| `/api/desk/cycle` | POST | Force one full decision cycle immediately (demo button) |
| `/api/desk/faucet` | POST | Claim tUSDC from the dreamDEX testnet faucet (LIVE mode) |
| `/api/desk/audit` | GET | Full audit ledger + `verifyChain()` result |
| `/api/desk/stream` | GET | SSE stream of desk snapshots (real-time UI) |

## Tech stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS + shadcn/ui
- **Prisma + SQLite** — sessions, decisions, signals, votes, risk checks, trades, audit events
- **@somnia-chain/markets-sdk** — market discovery, order book, IOC order creation, redemption
- **dreamDEX price-feed GraphQL oracle** — the same settlement index the contracts resolve against (Binance spot as fallback feed)
- **z-ai-web-dev-sdk (GLM)** — sentiment agent + council jurors, with honest heuristic degradation
- **SSE** — one engine event bus fans out to every connected browser

## Repository layout

```
src/
├── app/
│   ├── page.tsx                  # the trading floor UI
│   └── api/desk/*                # status · start · stop · cycle · faucet · audit · stream
├── components/desk/              # console, panels, atoms (all live-view components)
├── hooks/use-desk.ts             # SSE + status polling + desk actions
└── lib/desk/
    ├── engine.ts                 # DeskEngine — six-phase decision loop, settlements, snapshot
    ├── agents.ts                 # momentum · volatility · sentiment signal agents
    ├── council.ts                # 3-juror LLM council + weighted quorum + heuristic fallback
    ├── risk.ts                   # 8 deterministic gates
    ├── adapters/index.ts         # ExecutionAdapter: LiveAdapter (on-chain) / PaperAdapter (sim)
    ├── exchange.ts               # market discovery, order book, balances, faucet
    ├── prices.ts                 # dual-feed price manager (oracle + Binance fallback)
    ├── indicators.ts             # EMA, ROC, stdev, RSI, z-score
    ├── ledger.ts                 # SHA-256 hash-chained audit log + verifier
    └── config.ts                 # desk knobs + LIVE/PAPER resolution
prisma/schema.prisma              # 7 models — the audit trail's source of truth
```

## Honest limitations

- One desk, one asset per session, two windows (5m/1h) — breadth was traded for a legible, auditable depth.
- The sentiment agent caches its LLM read for 10 minutes; a fast-moving tape can outdate it between caches.
- PAPER fills assume +1¢ slippage against live venue prices — a simplification, but a conservative one.
- The heuristic juror fallback keeps the desk alive during LLM outages, but votes are labeled `heuristic` in the UI so no one mistakes them for model reasoning.

## Team

[@icohangar-ops](https://github.com/icohangar-ops) · [@Cubiczan](https://github.com/Cubiczan)
