# DreamDesk — An Auditable Multi-Agent Trading Desk for dreamDEX Event Contracts

> [github.com/icohangar-ops/dreamdesk](https://github.com/icohangar-ops/dreamdesk) · [3-min demo video](https://github.com/icohangar-ops/dreamdesk/blob/main/docs/demo/dreamdesk-demo-3min.mp4) · Somnia Shannon testnet (chainId 50312) · LIVE on-chain trading verified, PAPER mode for unfunded environments

## Inspiration

Event contracts are the simplest instrument in crypto: *will BTC close above its opening price in the next five minutes — yes or no?* Fixed payout, zero fees, fully on-chain. dreamDEX turned that into a clean on-chain order book on Somnia, where a binary contract is just another limit order.

That simplicity is exactly what makes event contracts the perfect stage for an **auditable autonomous agent**. With only two outcomes, a fixed payout, and a hard expiry, there is nowhere for an AI system to hide: every prediction can be scored, every fill can be traced, every settlement can be replayed. Complex instruments blur attribution — a binary coin-flip with a timestamp does not.

But most "AI trading bots" today are black boxes with a P&L chart attached. When an LLM decides to buy, nobody can answer the questions that matter: *What did the model actually see? What did it reason? Who else disagreed? What stopped it from over-trading? Would you be able to prove, after the fact, that nothing was edited?*

We built DreamDesk to answer yes to that last question, out loud, on every single decision. The thesis: **an autonomous trading desk must show its work** — not a black-box bot, but a trading room with the glass wall removed, where judges, risk officers, and regulators can watch three AI jurors disagree, watch a deterministic risk gate overrule the entire council, and verify that not one line of the story was rewritten after the fact.

## What it does

DreamDesk runs a complete autonomous trading operation on dreamDEX Event Contracts, and writes every step of every decision to a tamper-evident, hash-chained audit ledger.

**The pipeline — five stages, one loop:**

**01 · Signal Agents.** Three quant/AI agents read the market independently: MOMENTUM (EMA 9/21 crossover + ROC-30), VOLATILITY (σ, z-score-60, regime classifier), and SENTIMENT (a GLM LLM read of the tape, cached 10 minutes, that abstains honestly when it has nothing to add). Every packet carries its raw indicator values — no "trust me" numbers.

**02 · Council Chamber.** Three LLM jurors with deliberately opposed mandates debate the signal packet: TREND rides momentum, CONTRARIAN fades the crowd, SENTINEL protects the desk. Each returns a vote (UP/DOWN/ABSTAIN), a confidence, and a written rationale. A weighted 2/3 quorum is required to clear a proposal. The jurors vote — they never execute.

**03 · Risk Gates.** Eight deterministic gates vet every council-approved proposal: market selected · on-chain contract status · expiry headroom ≥ 120s (never buy a coin-flip) · council confidence ≥ 0.6 · edge ≥ 8¢ between council probability and venue price · max 3 concurrent positions · 20s cooldown between executions · −15% session stop that halts the desk. These gates are pure TypeScript. No LLM can overrule them, and a single veto kills the trade.

**04 · Execution.** LIVE mode signs real IOC limit orders (+2¢) against dreamDEX's on-chain order book on Somnia Shannon via the markets SDK, and auto-redeems winning contracts at settlement. PAPER mode is an isomorphic simulation — same signals, same council, same gates — filling at live venue prices with a conservative +1¢ slippage model. The mode badge and the ledger always tell you which world you're in.

**05 · Audit Ledger.** Every event — signal packet, juror vote, risk check, order fill, settlement — is hashed into a SHA-256 chain (`prevHash|seq|kind|actor|payload|timestamp`). `/api/desk/audit` runs `verifyChain()` over the entire session on demand; the UI shows a live **HASH CHAIN INTACT / BROKEN** badge and replays the full session history.

**The three-layer design is deliberate:** deterministic quant signals anchor the debate (they can be regression-tested), the LLM council adds context and second-order reasoning (it can be wrong, so it votes rather than decides), and the risk layer is pure code (it cannot be talked into anything). Three different failure modes, three independent layers of containment.

## How we built it

**Stack.** Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind + shadcn/ui for the entire desk UI; Prisma + SQLite for seven models (sessions, decisions, signals, votes, risk checks, trades, audit events); `@somnia-chain/markets-sdk` for market discovery, the order book, IOC order creation, and redemption; dreamDEX's price-feed GraphQL oracle — the same settlement index the contracts resolve against — with a Binance spot fallback; z-ai-web-dev-sdk (GLM) for the sentiment agent and the three jurors, with honest `heuristic` degradation when the LLM quota is exhausted (fallback votes are labeled as such in the UI); SSE to fan one engine event bus out to every connected browser in real time.

**One engine, one truth.** `DeskEngine` runs a six-phase loop (`gathering → convening → risk → executing → settling → cooldown`) and is the single writer to the database and the ledger. The UI is a pure view over engine snapshots — nothing in the frontend can fabricate or alter desk state.

**Real chain integration.** LIVE mode is not a mock: it discovers live markets through the SDK, reads real books, sizes positions to a 5% per-trade equity cap, places IOC limit orders signed by a dedicated desk wallet, polls settlement, and redeems wins — all recorded on Somnia Shannon with transaction hashes surfaced in the UI and the ledger.

## Verification — this desk actually traded

We shipped with evidence, not promises:

- **LIVE end-to-end on Somnia Shannon:** the desk executed real on-chain trades on market `BTC-7763015-28AUG26-1940/tUSDC`. The first trade was a WIN: **+99.25 tUSDC realized**, taking the desk from 1,000 → **1,066.15 tUSDC** across the session, with settlement tx hashes recorded in the ledger.
- **Long-running PAPER session:** 224 full decision cycles producing **1,443 audit events with `verifyChain()` = INTACT**, consensus breakdown 5 UP / 0 DOWN / 37 SPLIT, and 126 juror votes of which 76 came from the LLM and 50 from the labeled heuristic fallback.
- **14/14 unit checks pass**, covering the hash-chain verifier (tamper detection), risk-gate determinism, and council quorum logic. Raw logs and a trimmed audit sample are committed under `docs/`.
- `docs/VERIFICATION.md` walks through every number above with the exact commands to reproduce them.

## Challenges we ran into

**Making "auditable" mean something.** An append-only log is trivial; proving integrity is not. We settled on a strict event schema and a hash chain where each event commits to the previous hash — then built the verifier as a first-class API and UI badge, and unit-tested the tamper case explicitly (flip one byte, the chain must break).

**Opposable LLM jurors that stay honest.** A council of three identical prompts produces three identical votes — theatre, not debate. Giving each juror an opposed mandate (ride / fade / protect) plus its own confidence produced genuine SPLIT decisions, which we display rather than hide. When the LLM quota runs dry, the desk keeps breathing through a heuristic fallback — but every fallback vote is labeled `heuristic` in the UI so no one mistakes it for model reasoning.

**On-chain settlement is asynchronous and stubborn.** IOC orders can rest unfilled; windows close; redemption is a separate transaction. The engine treats settlement and redemption as first-class phases with their own ledger events, so a win is never "assumed" — it is recorded when the chain records it.

**Building a real-time trading room that reads like a proof.** The hardest UI problem was showing disagreement and veto without turning the page into a log viewer. The answer was the pipeline metaphor: six phases lighting up live over SSE, juror cards with written rationales, eight gates with pass/fail reasons, and the ledger tail always one glance away.

## Accomplishments we're proud of

- A **complete autonomous desk** — signals, debate, risk, execution, settlement, audit — that is legible enough to watch in real time and provable enough to replay after the fact.
- **Real on-chain wins on Somnia Shannon**, not a simulation of what trading might look like: signed IOC orders on dreamDEX's book, auto-redemption, tx hashes in the ledger.
- A **hash-chained audit trail** that survived 1,443 events with the verifier intact, plus a UI badge that will tell you the moment it doesn't.
- **Honest degradation everywhere**: LLM outages become labeled heuristic votes; unfunded environments get a full-fidelity PAPER mode; the mode badge never lets you forget which one you're watching.
- A demo video that shows the actual product doing the actual thing — pipeline, council disagreement, a risk veto, and the ledger — in three minutes.

## What we learned

- **Auditing is a product feature, not a compliance checkbox.** The moment the hash-chain badge went into the UI, the whole design changed — every component started asking "how would this look in the ledger?"
- **Constraint beats freedom for LLM reliability.** Jurors with opposed mandates, a weighted quorum, and no execution authority produced far more useful behavior than any single "smart" prompt. The LLM votes; deterministic code decides; the chain remembers.
- **Event contracts are the right sandbox for agent finance.** Binary outcomes + fixed payout + hard expiry make agent performance scoreable and mistakes visible. We'd choose it again as the proving ground for any autonomous trading system.
- **Fallbacks must be visible to be safe.** The heuristic juror kept the desk alive during LLM outages — and labeling those votes in the UI is what made that acceptable.

## What's next

- **More assets and windows** (ETH was built and is selectable; more markets follow the same adapter path).
- **Leaderboard + replay API** so anyone can diff two desk sessions and verify both chains independently.
- **Juror memory** — jurors currently reason per-cycle; persistent positions would let them explain *why* they changed their mind.
- **On-chain anchoring** of ledger checkpoints (publishing the chain head hash on Somnia periodically) for third-party verification without trusting our server.
- **Mainnet readiness review** — the execution path is testnet-proven; a mainnet deployment would start with tightened session stops and position caps.

## Links

- **GitHub:** [github.com/icohangar-ops/dreamdesk](https://github.com/icohangar-ops/dreamdesk) (full source, verification evidence in `docs/VERIFICATION.md`)
- **Demo video (3 min):** [`docs/demo/dreamdesk-demo-3min.mp4`](https://github.com/icohangar-ops/dreamdesk/blob/main/docs/demo/dreamdesk-demo-3min.mp4) — also attached to this BUIDL
- **Thumbnail:** `docs/screenshots/thumbnail-1280x720.png`
- **Built for:** [dreamDEX × Somnia Event Contracts Hackathon](https://dorahacks.io/hackathon/event-contracts/detail)

**Team:** [@icohangar-ops](https://github.com/icohangar-ops) · [@Cubiczan](https://github.com/Cubiczan)
