import { menu } from "@/lib/menu";
import { verifyTableToken, TOKEN_REQUIRED, normalizeTable } from "@/lib/meja";
import { addOrder, noteIp, orderGuard, store } from "@/lib/store";

const MENU_BY_ID = new Map(menu.items.map((it) => [it.id, it]));

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : String(fwd || "").split(",")[0];
  return (first || req.socket?.remoteAddress || "").trim();
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const table = normalizeTable(body.table || menu.table);
  const ip = clientIp(req);

  // 0) QR asli? Nomor meja di URL bisa ditebak tanpa token ini.
  if (TOKEN_REQUIRED && !verifyTableToken(table, body.token)) {
    return res.status(403).json({
      error: "MEJA_TIDAK_VALID",
      message: "QR meja tidak dikenali. Silakan scan ulang QR yang ada di meja Anda."
    });
  }

  if (!rawItems.length) {
    return res.status(400).json({ error: "EMPTY_ORDER", message: "Pesanan kosong." });
  }

  // 1) Nama & harga diambil dari MENU SERVER, bukan dari yang dikirim browser.
  //    Tanpa ini, siapa pun bisa mengirim price: 0 lewat devtools.
  const unknown = [];
  const items = [];
  for (const raw of rawItems) {
    const id = String(raw?.id ?? "");
    const found = MENU_BY_ID.get(id);
    if (!found) {
      unknown.push(id || "(kosong)");
      continue;
    }
    items.push({
      id: found.id,
      name: found.name,
      price: found.price,
      qty: Math.max(1, Number.parseInt(raw?.qty, 10) || 1),
      note: String(raw?.note || "").slice(0, 160)
    });
  }

  if (unknown.length) {
    return res.status(400).json({
      error: "ITEM_TIDAK_DIKENAL",
      items: unknown,
      message: `Menu tidak dikenali: ${unknown.join(", ")}.`
    });
  }

  // 2) Ketersediaan divalidasi ULANG saat submit (daftar di HP tamu bisa basi).
  const blocked = items.filter((it) => store.soldout.has(it.id)).map((it) => it.name);
  if (blocked.length) {
    return res.status(409).json({ error: "ITEM_HABIS", items: blocked });
  }

  // 3) Gerbang anti-iseng: batas qty/item, total, rate limit meja + IP, double tap.
  const guard = orderGuard({ table, ip, items });
  if (!guard.ok) {
    return res.status(guard.status).json({
      error: guard.error,
      message: guard.message,
      ...(guard.retryAfter ? { retryAfter: guard.retryAfter } : {}),
      ...(guard.orderId ? { orderId: guard.orderId } : {})
    });
  }

  noteIp(ip);
  const order = addOrder({ table, items, note: body.note, sig: guard.sig });
  return res.status(201).json(order);
}
