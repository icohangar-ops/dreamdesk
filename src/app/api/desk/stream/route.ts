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
      const heartbeat = setInterval(() => send("__ping__"), 15_000);
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
