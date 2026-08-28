"use client";

// DreamDesk command console — mode badge, session controls, and live P&L strip.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Chip, Sparkline, fmtPct, fmtPx, fmtUsd } from "./atoms";
import type { DeskSnapshot } from "@/hooks/use-desk";

type Act = (kind: "start" | "stop" | "cycle" | "faucet", body?: Record<string, unknown>) => Promise<{ ok: boolean } & Record<string, unknown>>;

export function Console({
  snap,
  connected,
  busy,
  act,
}: {
  snap: DeskSnapshot;
  connected: boolean;
  busy: string | null;
  act: Act;
}) {
  const [asset, setAsset] = useState(snap.asset || "BTC");
  const [cadence, setCadence] = useState(String(snap.cadenceSec || 300));
  const running = snap.status === "RUNNING";
  const live = snap.mode === "LIVE";

  const start = () =>
    act("start", {
      asset,
      cadenceSec: Number(cadence),
      mode: live ? "LIVE" : undefined,
    });

  const priceHistory = snap.price?.history.map((t) => t.price) ?? [];
  const first = priceHistory[0];
  const last = priceHistory[priceHistory.length - 1];
  const up = first !== undefined && last !== undefined ? last >= first : true;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ── control row ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div><Chip tone={live ? "up" : "warn"} className="cursor-help px-3 py-1 text-[11px]">
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
                {live ? "LIVE · SOMNIA SHANNON" : "PAPER DESK"}
              </Chip></div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-72 text-xs leading-relaxed">
              {snap.modeReason || (live ? "Signing real orders against dreamDEX event contracts on Somnia Shannon testnet." : "No funded desk wallet configured — every fill is simulated at venue prices.")}
            </TooltipContent>
          </Tooltip>

          <Select value={asset} onValueChange={setAsset} disabled={running}>
            <SelectTrigger className="h-8 w-24 border-zinc-700 bg-zinc-900 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value="BTC">BTC</SelectItem>
              <SelectItem value="ETH">ETH</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cadence} onValueChange={setCadence} disabled={running}>
            <SelectTrigger className="h-8 w-36 border-zinc-700 bg-zinc-900 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value="300">5-min window</SelectItem>
              <SelectItem value="3600">1-hour window</SelectItem>
            </SelectContent>
          </Select>

          {running ? (
            <Button onClick={() => act("stop")} disabled={busy === "stop"} variant="destructive" className="h-8 font-mono text-xs tracking-wider uppercase">
              ■ Stop desk
            </Button>
          ) : (
            <Button onClick={start} disabled={busy === "start"} className="h-8 bg-emerald-600 font-mono text-xs tracking-wider uppercase hover:bg-emerald-500">
              ▶ Start desk
            </Button>
          )}

          <Button
            onClick={() => act("cycle")}
            disabled={busy === "cycle" || !running}
            variant="outline"
            className="h-8 border-zinc-700 bg-zinc-900 font-mono text-xs tracking-wider uppercase hover:bg-zinc-800"
          >
            ⟳ Force cycle
          </Button>

          {live && (
            <Button
              onClick={() => act("faucet")}
              disabled={busy === "faucet"}
              variant="outline"
              className="h-8 border-sky-500/40 bg-sky-500/10 font-mono text-xs tracking-wider uppercase text-sky-300 hover:bg-sky-500/20"
            >
              ⛁ Faucet tUSDC
            </Button>
          )}

          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-sky-400" : "bg-zinc-600"}`} />
            {connected ? "SSE live" : "reconnecting"}
          </span>
        </div>

        {/* ── ticker + stats strip ────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">{snap.asset} · dreamDEX oracle</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">${fmtPx(snap.price?.price)}</p>
              {!snap.oracleHealthy && <p className="text-[10px] text-amber-400">oracle degraded — binance fallback feed</p>}
            </div>
            <div className="ml-auto">
              <Sparkline points={priceHistory} up={up} width={180} height={44} />
            </div>
          </div>

          <Stat label="Desk equity" value={fmtUsd(snap.equity)} sub={`start ${fmtUsd(snap.startingEquity, 0)}`} />
          <Stat
            label="Realized PnL"
            value={fmtUsd(snap.realizedPnl)}
            tone={snap.realizedPnl > 0 ? "up" : snap.realizedPnl < 0 ? "down" : "flat"}
            sub={`${snap.stats.trades} trades · ${fmtPct(snap.stats.winRate)} win`}
          />
          <Stat label="Cycles / convenings" value={`${snap.stats.cycles} / ${snap.stats.convenings}`} sub={`cycle #${snap.cycle} · ${snap.phase}`} />
          <Stat
            label={live ? "Wallet collateral" : "Open positions"}
            value={live ? fmtUsd(snap.collateral, 0) : String(snap.openTrades.length)}
            sub={live ? snap.wallet ? `${snap.wallet.slice(0, 6)}…${snap.wallet.slice(-4)}` : "—" : `${snap.stats.wins}W ${snap.stats.losses}L settled`}
          />
        </div>

        {snap.lastError && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">⚠ {snap.lastError}</p>
        )}
        {live && snap.exchangeError && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{snap.exchangeError}</p>
        )}
      </div>
    </TooltipProvider>
  );
}

function Stat({ label, value, sub, tone = "flat" }: { label: string; value: string; sub?: string; tone?: "up" | "down" | "flat" }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-zinc-100"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}
