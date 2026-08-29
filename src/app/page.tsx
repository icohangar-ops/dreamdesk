"use client";

// DreamDesk — an auditable multi-agent trading desk for dreamDEX Event Contracts.
//
// Page flow mirrors the engine: console → pipeline → signal agents →
// LLM council → risk gates → executions → audit ledger.

import { useDesk } from "@/hooks/use-desk";
import { Console } from "@/components/desk/console";
import { AgentPanel, AuditPanel, CouncilPanel, Pipeline, RiskPanel, TradePanel } from "@/components/desk/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PANEL_TITLES = {
  agents: "01 · Signal Agents",
  council: "02 · Council Chamber",
  risk: "03 · Risk Gates",
  book: "04 · Order Book",
  ledger: "05 · Audit Ledger",
} as const;

export default function Home() {
  const { snap, connected, busy, act } = useDesk();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200">
      {/* ── masthead ─────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800/80 bg-[#0c0c0f]/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 font-mono text-sm font-bold text-zinc-950">
              D
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
                DreamDesk <span className="text-zinc-500">— Autonomous Event-Contract Trading Floor</span>
              </h1>
              <p className="font-mono text-[10px] text-zinc-600">
                dreamDEX Event Contracts · Somnia Shannon (50312) · multi-agent consensus · hash-chained audit
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
            <a
              href="https://dorahacks.io/hackathon/event-contracts/detail"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-800 px-2.5 py-1 transition-colors hover:border-sky-500/40 hover:text-sky-300"
            >
              Event Contracts Hackathon
            </a>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-800 px-2.5 py-1 transition-colors hover:border-violet-500/40 hover:text-violet-300"
            >
              Explorer
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {/* ── console ──────────────────────────────────────────────── */}
        <Console snap={snap} connected={connected} busy={busy} act={act} />

        {/* ── decision pipeline ────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Decision pipeline</span>
            <Pipeline phase={snap.phase} running={snap.status === "RUNNING"} />
            {snap.status === "RUNNING" ? (
              <span className="ml-auto font-mono text-[10px] text-sky-400">
                {snap.phase === "cooldown" ? "next cycle scheduled…" : "engine ticking…"}
              </span>
            ) : (
              <span className="ml-auto font-mono text-[10px] text-zinc-600">desk idle — press START</span>
            )}
          </div>
        </section>

        {/* ── 01 signal agents ─────────────────────────────────────── */}
        <Panel title={PANEL_TITLES.agents} hint="Deterministic quant reads + an LLM sentiment scout — every packet carries its raw numbers for audit.">
          <AgentPanel agents={snap.agents} />
        </Panel>

        {/* ── 02/03 council + risk ─────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title={PANEL_TITLES.council} hint="Three LLM jurors with opposed mandates vote; two YES with weighted conviction clears the bar.">
            <CouncilPanel decision={snap.decision} />
          </Panel>
          <Panel title={PANEL_TITLES.risk} hint="Eight deterministic gates — no LLM may overrule them.">
            <RiskPanel decision={snap.decision} />
          </Panel>
        </div>

        {/* ── 04/05 book + ledger ──────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title={PANEL_TITLES.book} hint="IOC limit orders into the dreamDEX book — LIVE fills settle on-chain, PAPER fills mirror venue prices.">
            <TradePanel open={snap.openTrades} settled={snap.settledTrades} />
          </Panel>
          <Panel title={PANEL_TITLES.ledger} hint="Every decision step lands in an append-only SHA-256 hash chain.">
            <AuditPanel tail={snap.auditTail} count={snap.auditCount} chainOk={snap.chainOk} />
          </Panel>
        </div>

        {/* ── footer ───────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-800/80 pt-4 pb-2 text-center">
          <p className="font-mono text-[10px] tracking-wider text-zinc-600 uppercase">
            DreamDesk · built for the dreamDEX Event Contracts Hackathon · Somnia Shannon testnet · no financial advice, just receipts
          </p>
        </footer>
      </main>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 border-zinc-800 bg-[#0e0e11] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs tracking-widest text-zinc-300 uppercase">{title}</span>
          <span className="text-[11px] font-normal text-zinc-600">{hint}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
