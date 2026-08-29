// Tamper-evident audit ledger.
// Every desk artifact (signal, vote, risk check, execution, settlement) is
// appended as an event whose hash commits to the previous hash — a genesis-
// anchored chain anyone can re-verify event by event.

import { createHash } from "crypto";

export type AuditInput = {
  seq: number;
  kind: string;
  actor: string;
  payload: unknown;
  prevHash: string;
  ts: string | number | Date;
};

export const GENESIS_HASH = "0x" + "0".repeat(64);

export function computeAuditHash({ seq, kind, actor, payload, prevHash, ts }: AuditInput): string {
  const canonical = [
    prevHash,
    String(seq),
    kind,
    actor,
    typeof payload === "string" ? payload : JSON.stringify(payload),
    typeof ts === "string" || typeof ts === "number" ? String(ts) : ts.toISOString(),
  ].join("|");
  return "0x" + createHash("sha256").update(canonical).digest("hex");
}

export type VerifyRow = {
  seq: number;
  kind: string;
  actor: string;
  hash: string;
  prevHash: string;
  payload: string;
  createdAt: Date;
};

export type VerifyResult = {
  ok: boolean;
  length: number;
  brokenAt: number | null; // seq of first broken link, if any
  detail: string;
};

/** Re-walk the chain and confirm every link commits to its predecessor. */
export function verifyChain(rows: VerifyRow[]): VerifyResult {
  if (rows.length === 0) {
    return { ok: true, length: 0, brokenAt: null, detail: "Ledger empty" };
  }
  let prev = GENESIS_HASH;
  for (const row of rows) {
    const expected = computeAuditHash({
      seq: row.seq,
      kind: row.kind,
      actor: row.actor,
      payload: row.payload,
      prevHash: prev,
      ts: row.createdAt,
    });
    if (row.prevHash !== prev) {
      return {
        ok: false,
        length: rows.length,
        brokenAt: row.seq,
        detail: `Event #${row.seq} links to ${row.prevHash.slice(0, 10)}… but expected ${prev.slice(0, 10)}…`,
      };
    }
    if (row.hash !== expected) {
      return {
        ok: false,
        length: rows.length,
        brokenAt: row.seq,
        detail: `Event #${row.seq} payload does not match its committed hash (tamper detected)`,
      };
    }
    prev = row.hash;
  }
  return {
    ok: true,
    length: rows.length,
    brokenAt: null,
    detail: `All ${rows.length} events verified — chain intact from genesis`,
  };
}
