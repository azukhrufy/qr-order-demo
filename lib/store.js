import { randomUUID } from "node:crypto";

// State demo disimpan di memori (per proses dev/server).
// Untuk produk asli: Postgres + Prisma, bukan Map di memori.
const g = globalThis;

export const store =
  g.__qrStore ??
  (g.__qrStore = {
    orders: [],
    soldout: new Set(),
    calls: [],
    clients: new Set()
  });

export function snapshot() {
  return {
    orders: store.orders,
    soldout: [...store.soldout],
    calls: store.calls
  };
}

export function broadcast() {
  const payload = snapshot();
  for (const send of store.clients) {
    try {
      send(payload);
    } catch {
      store.clients.delete(send);
    }
  }
}

export function addOrder({ table, items, note }) {
  const clean = items.map((it) => ({
    id: String(it.id),
    name: String(it.name || ""),
    qty: Math.max(1, Number.parseInt(it.qty, 10) || 1),
    price: Math.max(0, Number.parseInt(it.price, 10) || 0),
    note: String(it.note || "").slice(0, 160)
  }));

  const order = {
    id: randomUUID(),
    table: String(table || "12").slice(0, 12),
    items: clean,
    note: String(note || "").slice(0, 240),
    total: clean.reduce((sum, it) => sum + it.price * it.qty, 0),
    status: "menunggu",
    createdAt: Date.now(),
    acceptedAt: null
  };

  store.orders.unshift(order);
  broadcast();
  return order;
}

export const ORDER_STATUSES = ["menunggu", "diterima", "diproses", "siap", "disajikan", "ditolak"];

export function setOrderStatus(id, status) {
  const order = store.orders.find((o) => o.id === id);
  if (!order) return null;
  if (!ORDER_STATUSES.includes(status)) return null;
  order.status = status;
  if (status === "diterima" && !order.acceptedAt) order.acceptedAt = Date.now();
  broadcast();
  return order;
}

export function setSoldout(id, value) {
  if (value) store.soldout.add(id);
  else store.soldout.delete(id);
  broadcast();
  return [...store.soldout];
}

export function addCall(table, type) {
  const call = {
    id: randomUUID(),
    table: String(table || "12"),
    type: type === "bill" ? "bill" : "pelayan",
    createdAt: Date.now(),
    done: false
  };
  store.calls.unshift(call);
  broadcast();
  return call;
}

export function doneCall(id) {
  const call = store.calls.find((c) => c.id === id);
  if (call) call.done = true;
  broadcast();
  return call;
}

export function resetAll() {
  store.orders = [];
  store.soldout = new Set();
  store.calls = [];
  broadcast();
  return snapshot();
}
