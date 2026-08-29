"use client";

// The five observation panels of the DreamDesk trading floor.

import { cn } from "@/lib/utils";
import { Chip, StrengthBar, dirBg, dirTone, fmtClock, fmtHash, fmtPct, fmtPx, fmtTime, fmtUsd } from "./atoms";
import type { DecisionView, TradeView } from "@/lib/desk/engine";
import type { SignalPacket } from "@/lib/desk/agents";
import type { RiskGate } from "@/lib/desk/risk";

const AGENT_META: Record<string, { label: string; blurb: string; icon: string }> = {
  MOMENTUM: { label: "Momentum Scout", blurb: "EMA9/21 spread · 30-tick rate of change", icon: "▲" },
  VOLATILITY: { label: "Volatility Cartographer", blurb: "Tick σ · z-score · regime classifier", icon: "∼" },
  SENTIMENT: { label: "Sentiment Oracle", blurb: "LLM market read · 10-min cache · abstains honestly", icon: "◈" },
};

export function AgentPanel({ agents }: { agents: Record<string, SignalPacket> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["MOMENTUM", "VOLATILITY", "SENTIMENT"] as const).map((key) => {
        const a = agents[key];
        const meta = AGENT_META[key];
        return (
          <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">{meta.label}</span>
              <Chip tone={a.direction === "UP" ? "up" : a.direction === "DOWN" ? "down" : "neutral"}>{a.direction}</Chip>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={cn("text-2xl font-semibold tabular-nums", dirTone(a.direction))}>
                {(a.strength * 100).toFixed(0)}
              </span>
              <span className="text-[10px] text-zinc-500">strength / conf {fmtPct(a.confidence)}</span>
            </div>
            <div className="mt-2">
              <StrengthBar value={a.strength} tone={a.direction === "UP" ? "up" : a.direction === "DOWN" ? "down" : "flat"} />
            </div>
            <p className="mt-3 min-h-[2.5rem] text-xs leading-relaxed text-zinc-400">{a.detail}</p>
            <p className="mt-2 border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-600">{meta.blurb}</p>
          </div>
        );
      })}
    </div>
  );
}

const PHASES = ["gathering", "convening", "risk", "executing", "settling", "cooldown"] as const;

export function Pipeline({ phase, running }: { phase: string; running: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PHASES.map((p, i) => {
        const active = running && phase === p;
        const done = running && PHASES.indexOf(phase as (typeof PHASES)[number]) > i;
        return (
          <span key={p} className="flex items-center gap-1.5">
            {i > 0 && <span className={cn("h-px w-3", done ? "bg-sky-400/60" : "bg-zinc-700")} />}
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                active
                  ? "border-sky-400/60 bg-sky-500/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                  : done
                    ? "border-zinc-700 bg-zinc-800/60 text-zinc-400"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-600",
              )}
            >
              {p}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const JUROR_META: Record<string, { label: string; stance: string }> = {
  TREND: { label: "Juror TREND", stance: "rides the momentum" },
  CONTRARIAN: { label: "Juror CONTRARIAN", stance: "fades the crowd" },
  SENTINEL: { label: "Juror SENTINEL", stance: "protects the desk" },
};

export function CouncilPanel({ decision }: { decision: DecisionView | null }) {
  if (!decision) {
    return (
      <p className="py-8 text-center text-sm text-zinc-600">
        The council has not convened yet. Run a cycle to watch three LLM jurors deliberate.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={decision.consensus === "UP" ? "up" : decision.consensus === "DOWN" ? "down" : "warn"}>
          consensus {decision.consensus ?? "—"}
        </Chip>
        <Chip tone="violet">engine {decision.status}</Chip>
        {decision.entryProb !== null && <Chip tone="info">model prob {fmtPct(decision.entryProb, 1)}</Chip>}
        {decision.venueProb !== null && <Chip tone="info">venue prob {fmtPct(decision.venueProb, 1)}</Chip>}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">cycle #{decision.cycle}</span>
      </div>
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm leading-relaxed text-zinc-300">
        {decision.summary}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {decision.votes.map((v) => (
          <div
            key={v.juror}
            className={cn(
              "rounded-xl border p-3",
              v.vote === "YES" ? "border-emerald-500/30 bg-emerald-500/5" : v.vote === "NO" ? "border-rose-500/30 bg-rose-500/5" : "border-zinc-700/50 bg-zinc-800/20",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-zinc-400 uppercase">{JUROR_META[v.juror]?.label ?? v.juror}</span>
              <Chip tone={v.vote === "YES" ? "up" : v.vote === "NO" ? "down" : "neutral"}>{v.vote}</Chip>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">{JUROR_META[v.juror]?.stance}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">{v.rationale}</p>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-zinc-500">
              <span>conf {fmtPct(v.confidence)}</span>
              <span className={v.engine === "llm" ? "text-violet-400" : "text-amber-400"}>{v.engine}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskPanel({ decision }: { decision: DecisionView | null }) {
  const gates: RiskGate[] = decision?.riskGates ?? [];
  return (
    <div className="space-y-1.5">
      {gates.length === 0 && <p className="py-6 text-center text-sm text-zinc-600">Risk gates arm once the council reaches a verdict.</p>}
      {gates.map((g) => (
        <div key={g.gate} className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
              g.passed ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-rose-500/50 bg-rose-500/10 text-rose-400",
            )}
          >
            {g.passed ? "✓" : "✕"}
          </span>
          <span className="text-xs font-medium text-zinc-200">{g.gate}</span>
          <span className="ml-auto truncate pl-4 text-right text-[11px] text-zinc-500">{g.detail}</span>
        </div>
      ))}
    </div>
  );
}

function TradeRow({ t }: { t: TradeView }) {
  const won = t.status === "SETTLED_WIN";
  const open = t.status === "PLACED";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 md:grid-cols-[auto_1fr_1fr_auto_auto]">
      <Chip tone={t.side === "UP" ? "up" : "down"}>{t.side}</Chip>
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-zinc-300">{t.symbol}</p>
        <p className="text-[10px] text-zinc-600">
          {fmtTime(t.openedAt)} · size {fmtUsd(t.size)} @ {fmtPct(t.price, 1)}
          {t.txHash ? ` · tx ${fmtHash(t.txHash)}` : t.mode === "PAPER" ? " · paper fill" : ""}
        </p>
      </div>
      <div className="hidden text-right md:block">
        <p className="font-mono text-xs text-zinc-400">
          entry {fmtPct(t.entryProb, 1)} → mark {t.markProb !== null ? fmtPct(t.markProb, 1) : "—"}
        </p>
        <p className="text-[10px] text-zinc-600">{open ? `expires in ${fmtClock(t.secondsLeft)}` : "settled"}</p>
      </div>
      <Chip
        tone={won ? "up" : open ? "info" : t.status === "FAILED" ? "warn" : "down"}
      >
        {t.status.replace("SETTLED_", "")}
      </Chip>
      <span className={cn("text-right font-mono text-sm font-semibold tabular-nums", t.pnl > 0 ? "text-emerald-400" : t.pnl < 0 ? "text-rose-400" : "text-zinc-500")}>
        {t.status === "PLACED" ? "—" : fmtUsd(t.pnl)}
      </span>
    </div>
  );
}

export function TradePanel({ open, settled }: { open: TradeView[]; settled: TradeView[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Open positions ({open.length})</p>
        {open.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-600">No live positions.</p>
        ) : (
          <div className="space-y-1.5">{open.map((t) => <TradeRow key={t.id} t={t} />)}</div>
        )}
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Settlement history ({settled.length})</p>
        {settled.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-600">Nothing settled yet — first expiry lands here with its on-chain redemption receipt.</p>
        ) : (
          <div className="space-y-1.5">{settled.slice(0, 8).map((t) => <TradeRow key={t.id} t={t} />)}</div>
        )}
      </div>
    </div>
  );
}

export function AuditPanel({
  tail,
  count,
  chainOk,
}: {
  tail: { seq: number; kind: string; actor: string; hash: string; payload: string; at: string }[];
  count: number;
  chainOk: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={chainOk ? "up" : "down"}>{chainOk ? "hash chain intact" : "chain broken"}</Chip>
        <span className="font-mono text-[10px] text-zinc-600">{count} events · SHA-256 linked · tamper-evident</span>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {tail.length === 0 && <p className="py-6 text-center text-xs text-zinc-600">The ledger is empty. Start a session to mint block #0.</p>}
        {tail.map((e) => (
          <div key={e.seq} className="flex items-start gap-2 rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2.5 py-1.5">
            <span className="w-10 shrink-0 font-mono text-[10px] text-zinc-600">#{String(e.seq).padStart(3, "0")}</span>
            <span className="w-24 shrink-0 font-mono text-[10px] text-sky-400/90">{e.kind}</span>
            <span className="w-20 shrink-0 truncate font-mono text-[10px] text-zinc-500">{e.actor}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400">{e.payload}</span>
            <span className="shrink-0 font-mono text-[10px] text-zinc-600">{fmtTime(e.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
