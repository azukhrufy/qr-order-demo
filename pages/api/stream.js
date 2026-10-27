import { store, snapshot } from "@/lib/store";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

export default function handler(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  res.flushHeaders?.();

  const send = (payload) => {
    try {
      res.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {
      store.clients.delete(send);
    }
  };

  store.clients.add(send);
  send(snapshot());

  // keep-alive supaya proxy tidak memutus koneksi idle
  const timer = setInterval(() => {
    try {
      res.write(": ka\n\n");
    } catch {
      /* koneksi sudah tertutup */
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(timer);
    store.clients.delete(send);
  });
}
