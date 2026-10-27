#!/usr/bin/env node
/**
 * Probe anti-order-iseng. Jalankan terhadap server yang sudah hidup:
 *
 *   node scripts/probe-guards.mjs http://localhost:4173 [meja] [token]
 *
 * Kalau token tidak dikirim, script mengambil token dari /api/qr?format=json...
 * (tidak ada) — jadi token dihitung lokal dengan cara yang sama seperti server
 * (HMAC QR_SECRET, fallback demo). Hasil: ringkasan PASS/FAIL per aturan.
 *
 * Semua request memakai meja uji sendiri (default 99) supaya tidak mengotori
 * demo meja asli, lalu diakhiri POST /api/reset bila DIM=1.
 */
import { tableToken } from "../lib/meja.js";

const base = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const table = process.argv[3] || "99";
const token = process.argv[4] || tableToken(table);

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const oneItem = (id, qty = 1, price = 1) => [{ id, qty, price }];

// 1) Tanpa token meja → 403
{
  const r = await post("/api/order", { table, items: oneItem("kopi-susu") });
  record("order tanpa token ditolak 403", r.status === 403, `status ${r.status} ${r.data?.error || ""}`);
}

// 2) Dengan token → 201
let firstOrderId = null;
{
  const r = await post("/api/order", { table, token, items: oneItem("kopi-susu") });
  firstOrderId = r.data?.id || null;
  record("order dengan token diterima 201", r.status === 201, `status ${r.status} ${r.data?.error || ""}`);
}

// 3) Kirim ulang identik → 409 DUPLIKAT (bukan order kedua)
{
  const r = await post("/api/order", { table, token, items: oneItem("kopi-susu") });
  const sameId = r.data?.orderId === firstOrderId;
  record("kirim ulang identik ditolak 409 DUPLIKAT", r.status === 409 && r.data?.error === "DUPLIKAT" && sameId, `status ${r.status} ${r.data?.error || ""}`);
}

// 4) Rate limit per meja: batas 3 order / 3 menit
{
  const seq = [
    ["matcha", 1],
    ["bandrek", 1],
    ["es-teh-lemon", 1]
  ];
  let last = null;
  for (const [id, qty] of seq) {
    last = await post("/api/order", { table, token, items: oneItem(id, qty) });
  }
  record("order ke-4 dalam 3 menit ditolak 429", last?.status === 429, `status ${last?.status} ${last?.data?.error || ""}${last?.data?.retryAfter ? ` retry ${last.data.retryAfter}s` : ""}`);
}

// 5) Qty di atas batas → 413 (pakai meja lain supaya tidak kena rate limit)
{
  const r = await post("/api/order", { table: `${table}b`, token: tableToken(`${table}b`), items: oneItem("kopi-susu", 999) });
  record("qty 999 ditolak 413", r.status === 413, `status ${r.status} ${r.data?.error || ""}`);
}

// 6) Item tidak ada di menu → 400
{
  const r = await post("/api/order", { table: `${table}c`, token: tableToken(`${table}c`), items: oneItem("menu-karangan") });
  record("item karangan ditolak 400", r.status === 400, `status ${r.status} ${r.data?.error || ""}`);
}

// 7) Harga dari klien diabaikan (kirim price 1 untuk menu Rp35.000)
{
  const r = await post("/api/order", { table: `${table}d`, token: tableToken(`${table}d`), items: oneItem("nasi-goreng-dpakar", 1, 1) });
  const total = r.data?.total;
  record("harga klien diabaikan server", r.status === 201 && total > 1, `total ${total}`);
}

// 8) Panggil pelayan dua kali → 429
{
  const t = `${table}e`;
  const tk = tableToken(t);
  const a = await post("/api/call", { table: t, token: tk, type: "pelayan" });
  const b = await post("/api/call", { table: t, token: tk, type: "pelayan" });
  record("panggil pelayan dua kali ditolak 429", a.status === 201 && b.status === 429, `${a.status} lalu ${b.status}`);
}

// 9) QR per meja memuat token yang cocok dengan yang dihitung server
{
  const res = await fetch(`${base}/api/qr?meja=${encodeURIComponent(table)}&format=json`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  const urlOk = String(data?.target || "").includes(`meja=${encodeURIComponent(table)}`) && String(data?.target || "").includes(`t=${token}`);
  record("QR memuat nomor meja + token", res.ok && urlOk && data?.token === token, data?.target || `status ${res.status}`);
}

// 10) Health: persistence menulis ke disk (flush tertunda ~120 ms → tunggu maks 2 dtk)
{
  let data = null;
  for (let i = 0; i < 20; i += 1) {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    data = await res.json().catch(() => null);
    if (data?.persistence?.lastSavedAt) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  record(
    "persistence menulis ke disk",
    Boolean(data?.persistence?.writable && data?.persistence?.file && data?.persistence?.lastSavedAt),
    `${data?.persistence?.file} lastSaved ${data?.persistence?.lastSavedAt || "-"}`
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);

if (process.env.RESET === "1") {
  await fetch(`${base}/api/reset`, { method: "POST" });
  console.log("state demo sudah di-reset");
}

process.exit(failed.length ? 1 : 0);
