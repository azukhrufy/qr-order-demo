import { store, snapshot } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const push = (text) => {
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          return false;
        }
      };

      const send = (payload) => {
        if (!push(`event: update\ndata: ${JSON.stringify(payload)}\n\n`)) {
          store.clients.delete(send);
        }
      };

      store.clients.add(send);
      send(snapshot());

      // keep-alive supaya proxy tidak memutus koneksi idle
      const timer = setInterval(() => {
        if (!push(": ka\n\n")) store.clients.delete(send);
      }, 25000);

      cleanup = () => {
        clearInterval(timer);
        store.clients.delete(send);
      };
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    }
  });
}
