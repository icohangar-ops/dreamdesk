"use client";

// Shared presentational atoms for the DreamDesk trading floor.

import { cn } from "@/lib/utils";

/* ------------------------------ formatting ------------------------------ */

export const fmtUsd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "—"
    : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtPct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : `${(n * 100).toFixed(digits)}%`;

export const fmtPx = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtHash = (h: string | null, head = 6, tail = 4) =>
  !h ? "—" : h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;

export const fmtClock = (sec: number | null | undefined) => {
  if (sec === null || sec === undefined) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};

export const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return "—";
  }
};

/* -------------------------------- colors -------------------------------- */

export const dirTone = (dir: string | null | undefined) =>
  dir === "UP" ? "text-emerald-400" : dir === "DOWN" ? "text-rose-400" : "text-zinc-400";

export const dirBg = (dir: string | null | undefined) =>
  dir === "UP"
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
    : dir === "DOWN"
      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
      : "bg-zinc-500/10 border-zinc-500/30 text-zinc-300";

/* ------------------------------- sparkline ------------------------------ */

export function Sparkline({
  points,
  up,
  width = 240,
  height = 56,
}: {
  points: number[];
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] tracking-widest text-zinc-600"
        style={{ width, height }}
      >
        COLLECTING TICKS…
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - 4 - ((p - min) / span) * (height - 8)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const stroke = up ? "#34d399" : "#fb7185";
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${up ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${up ? "up" : "dn"})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={stroke} />
    </svg>
  );
}

/* --------------------------------- badge -------------------------------- */

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "up" | "down" | "warn" | "info" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-800/80 border-zinc-700 text-zinc-300",
    up: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
    down: "bg-rose-500/10 border-rose-500/40 text-rose-300",
    warn: "bg-amber-500/10 border-amber-500/40 text-amber-300",
    info: "bg-sky-500/10 border-sky-500/40 text-sky-300",
    violet: "bg-violet-500/10 border-violet-500/40 text-violet-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ strength bar ---------------------------- */

export function StrengthBar({ value, tone }: { value: number; tone: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "bg-emerald-400" : tone === "down" ? "bg-rose-400" : "bg-zinc-500";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
