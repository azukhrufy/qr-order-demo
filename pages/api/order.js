import { store, addOrder } from "@/lib/store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) {
    return res.status(400).json({ error: "EMPTY_ORDER" });
  }

  // Validasi ULANG ketersediaan saat submit — bukan hanya disembunyikan di UI.
  const blocked = items
    .filter((it) => store.soldout.has(String(it.id)))
    .map((it) => String(it.name || it.id));

  if (blocked.length) {
    return res.status(409).json({ error: "ITEM_HABIS", items: blocked });
  }

  const order = addOrder({ table: body.table, items, note: body.note });
  return res.status(201).json(order);
}
