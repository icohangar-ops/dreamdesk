import { engine } from "@/lib/desk/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      send(engine.snapshot());
      const onUpdate = (snap: unknown) => send(snap);
      engine.on("update", onUpdate);
      // SSE comment frames are auto-ignored by EventSource — perfect for keepalives.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        engine.off("update", onUpdate);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch { /* already closed */ }
      };
      req.signal?.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
