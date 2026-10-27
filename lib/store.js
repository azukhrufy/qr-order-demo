import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

// State demo: tersimpan di memori proses DAN di-flush ke file JSON.
// Tujuan file: order/stok tidak hilang saat proses restart atau redeploy
// (Render/VPS), yang sebelumnya membuat demo "kehilangan pesanan" di depan owner.
// Untuk produk asli tetap Postgres + Prisma — bukan file JSON.
const g = globalThis;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const MAX_ORDERS = 200;
const MAX_CALLS = 50;

/**
 * Batas anti-order-iseng. Angka ini sengaja konservatif: cukup longgar untuk
 * tamu yang benar-benar menambah pesanan, cukup ketat untuk memblokir spam.
 */
export const LIMITS = {
  maxQtyPerItem: 20,
  maxLines: 25,
  maxTotal: 5_000_000,
  tableOrders: 3,
  tableWindowMs: 3 * 60 * 1000,
  ipOrders: 20,
  ipWindowMs: 60 * 1000,
  duplicateWindowMs: 15 * 1000
};

function emptyState() {
  return {
    orders: [],
    soldout: new Set(),
    calls: [],
    clients: new Set(),
    ipHits: new Map(),
    lastSavedAt: null,
    saveError: null
  };
}

function loadFromDisk(state) {
  let raw;
  try {
    raw = readFileSync(STATE_FILE, "utf8");
  } catch {
    return state; // belum ada file = start bersih
  }

  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.orders)) state.orders = data.orders;
    if (Array.isArray(data.soldout)) state.soldout = new Set(data.soldout.map(String));
    if (Array.isArray(data.calls)) state.calls = data.calls;
    state.lastSavedAt = Number(data.savedAt) || null;
    return state;
  } catch (err) {
    // File rusak jangan bikin server mati — mulai bersih dan laporkan sekali.
    console.warn(`[store] state.json tidak terbaca (${err?.message || err}); mulai dari state kosong`);
    return state;
  }
}

export const store = (() => {
  if (g.__qrStore) return g.__qrStore;
  const state = loadFromDisk(emptyState());
  g.__qrStore = state;
  return state;
})();

let saveTimer = null;

function writeNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const payload = JSON.stringify(
    {
      version: 1,
      savedAt: Date.now(),
      orders: store.orders,
      soldout: [...store.soldout],
      calls: store.calls
    },
    null,
    0
  );

  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STATE_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, STATE_FILE); // rename = atomik, tidak ada state setengah tertulis
    store.lastSavedAt = Date.now();
    store.saveError = null;
  } catch (err) {
    store.saveError = String(err?.message || err);
    console.warn(`[store] gagal menyimpan state ke ${STATE_FILE}: ${store.saveError}`);
  }
}

/** Simpan tertunda ~120 ms supaya burst (mis. mark habis 5 item) cuma 1 tulisan. */
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(writeNow, 120);
  saveTimer.unref?.();
}

export function flushNow() {
  writeNow();
}

if (!g.__qrStoreExitHook) {
  g.__qrStoreExitHook = true;
  process.once("exit", () => {
    try {
      writeNow();
    } catch {
      /* proses sudah berakhir */
    }
  });
}

export function persistenceInfo() {
  return {
    file: STATE_FILE,
    writable: !store.saveError,
    error: store.saveError,
    lastSavedAt: store.lastSavedAt,
    orders: store.orders.length
  };
}

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

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function signatureOf(table, items) {
  const body = [...items]
    .map((it) => `${it.id}:${it.qty}`)
    .sort()
    .join("|");
  return `${table}#${body}`;
}

function pruneIpHits(now) {
  const horizon = now - LIMITS.ipWindowMs;
  for (const [ip, hits] of store.ipHits) {
    const kept = hits.filter((t) => t > horizon);
    if (kept.length) store.ipHits.set(ip, kept);
    else store.ipHits.delete(ip);
  }
}

/**
 * Gerbang anti-order-iseng. Dipanggil SEBELUM order dibuat.
 * items di sini sudah dinormalisasi + dihargai dari menu server (bukan dari klien).
 * Mengembalikan { ok: true } atau { ok: false, status, error, message }.
 */
export function orderGuard({ table, ip, items }) {
  const now = Date.now();

  if (!items.length) {
    return { ok: false, status: 400, error: "EMPTY_ORDER", message: "Pesanan kosong." };
  }
  if (items.length > LIMITS.maxLines) {
    return {
      ok: false,
      status: 413,
      error: "TERLALU_BANYAK_ITEM",
      message: `Maksimal ${LIMITS.maxLines} jenis item per pesanan.`
    };
  }

  const tooMany = items.find((it) => it.qty > LIMITS.maxQtyPerItem);
  if (tooMany) {
    return {
      ok: false,
      status: 413,
      error: "QTY_TERLALU_BESAR",
      message: `Maksimal ${LIMITS.maxQtyPerItem} porsi per item (${tooMany.name}).`
    };
  }

  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  if (total > LIMITS.maxTotal) {
    return {
      ok: false,
      status: 413,
      error: "TOTAL_TERLALU_BESAR",
      message: "Total pesanan melebihi batas. Silakan pesan bertahap."
    };
  }

  // Rate limit per meja: mencegah satu QR difoto lalu dipakai spam.
  const sameTable = store.orders.filter(
    (o) => o.table === table && o.createdAt > now - LIMITS.tableWindowMs
  );
  if (sameTable.length >= LIMITS.tableOrders) {
    const oldest = Math.min(...sameTable.map((o) => o.createdAt));
    const retryAfter = Math.ceil((oldest + LIMITS.tableWindowMs - now) / 1000);
    return {
      ok: false,
      status: 429,
      error: "TERLALU_SERING",
      retryAfter: Math.max(1, retryAfter),
      message: `Meja ${table} sudah mengirim ${LIMITS.tableOrders} pesanan dalam 3 menit. Tunggu ${Math.max(1, retryAfter)} detik.`
    };
  }

  // Rate limit per IP: menahan skrip yang menembak banyak meja sekaligus.
  if (ip) {
    pruneIpHits(now);
    const hits = store.ipHits.get(ip) || [];
    if (hits.length >= LIMITS.ipOrders) {
      return {
        ok: false,
        status: 429,
        error: "TERLALU_SERING_IP",
        retryAfter: 30,
        message: "Terlalu banyak pesanan dari jaringan ini. Coba lagi sebentar."
      };
    }
  }

  // Double tap / kirim ulang: order identik dari meja sama dalam 15 detik.
  const sig = signatureOf(table, items);
  const twin = store.orders.find(
    (o) => o.sig === sig && o.createdAt > now - LIMITS.duplicateWindowMs
  );
  if (twin) {
    return {
      ok: false,
      status: 409,
      error: "DUPLIKAT",
      orderId: twin.id,
      message: "Pesanan ini sudah terkirim barusan. Tidak dikirim dua kali."
    };
  }

  return { ok: true, sig, total };
}

export function noteIp(ip) {
  if (!ip) return;
  const now = Date.now();
  const hits = store.ipHits.get(ip) || [];
  hits.push(now);
  store.ipHits.set(ip, hits);
}

export function addOrder({ table, items, note, sig }) {
  const clean = items.map((it) => ({
    id: String(it.id),
    name: String(it.name || ""),
    qty: clampInt(it.qty, 1, LIMITS.maxQtyPerItem, 1),
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
    sig: sig || signatureOf(String(table || "12"), clean),
    createdAt: Date.now(),
    acceptedAt: null
  };

  store.orders.unshift(order);
  if (store.orders.length > MAX_ORDERS) store.orders.length = MAX_ORDERS;

  broadcast();
  scheduleSave();
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
  scheduleSave();
  return order;
}

export function setSoldout(id, value) {
  if (value) store.soldout.add(id);
  else store.soldout.delete(id);
  broadcast();
  scheduleSave();
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
  if (store.calls.length > MAX_CALLS) store.calls.length = MAX_CALLS;
  broadcast();
  scheduleSave();
  return call;
}

export function doneCall(id) {
  const call = store.calls.find((c) => c.id === id);
  if (call) call.done = true;
  broadcast();
  scheduleSave();
  return call;
}

export function resetAll() {
  store.orders = [];
  store.soldout = new Set();
  store.calls = [];
  store.ipHits.clear();
  broadcast();
  flushNow();
  return snapshot();
}
