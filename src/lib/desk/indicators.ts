// Pure quant indicators over the price ring buffer.
// Deterministic by design: the same tick window always yields the same numbers,
// so every agent reading and council input is reproducible after the fact.

export type Tick = { ts: number; price: number };

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = values[i] * k + acc * (1 - k);
  return acc;
}

export function emaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let acc = values[0];
  out.push(acc);
  for (let i = 1; i < values.length; i++) {
    acc = values[i] * k + acc * (1 - k);
    out.push(acc);
  }
  return out;
}

export function rateOfChange(values: number[], lookback: number): number {
  if (values.length < lookback + 1 || values[values.length - 1 - lookback] === 0) return 0;
  const then = values[values.length - 1 - lookback];
  const now = values[values.length - 1];
  return (now - then) / then;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Relative volatility: stdev of returns, annualization-agnostic (per-tick). */
export function tickVolatility(values: number[], window = 60): number {
  const slice = values.slice(-window);
  if (slice.length < 3) return 0;
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] !== 0) rets.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  }
  return stdev(rets);
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

/** Z-score of the latest value against the trailing window. */
export function zScore(values: number[], window = 60): number {
  const slice = values.slice(-window);
  if (slice.length < 3) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const sd = stdev(slice);
  if (sd === 0) return 0;
  return (slice[slice.length - 1] - mean) / sd;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function fmtUsd(x: number, digits = 2): string {
  return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
