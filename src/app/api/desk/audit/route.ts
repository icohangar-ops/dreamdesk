import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyChain } from "@/lib/desk/ledger";
import { engine } from "@/lib/desk/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!engine.sessionId) {
    return NextResponse.json({ ok: true, events: [], verification: { ok: true, length: 0, brokenAt: null, detail: "No session yet" } });
  }
  const events = await db.auditEvent.findMany({
    where: { sessionId: engine.sessionId },
    orderBy: { seq: "asc" },
  });
  const verification = verifyChain(events);
  return NextResponse.json({
    ok: true,
    events: events.map((e) => ({ seq: e.seq, kind: e.kind, actor: e.actor, hash: e.hash, prevHash: e.prevHash, payload: JSON.parse(e.payload), at: e.createdAt.toISOString() })),
    verification,
  });
}
