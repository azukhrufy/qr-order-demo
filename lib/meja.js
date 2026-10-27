import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token meja: HMAC(secret, nomor meja) — stateless, tanpa tabel registry.
 *
 * Kenapa perlu: nomor meja di URL (/tamu?meja=12) gampang ditebak. Tanpa token,
 * siapa pun bisa membuka /tamu?meja=99 dari rumah dan mengirim pesanan iseng
 * yang lalu dimasak dapur. Dengan token, hanya QR yang benar-benar ada di meja
 * (atau dibagikan staf) yang bisa membuat order.
 *
 * Bukan pengganti gerbang konfirmasi staf: tamu di meja 12 tetap bisa iseng dari
 * HP-nya sendiri — itu ditahan rate limit + tombol Terima/Tolak di layar staf.
 */
const SECRET =
  process.env.QR_SECRET ||
  // fallback demo: cukup untuk mencegah tebak-tebakan, bukan untuk produksi
  "demo-qr-secret-ganti-di-produksi";

/** Token boleh dimatikan hanya untuk demo cepat: QR_TOKEN_REQUIRED=0 */
export const TOKEN_REQUIRED = process.env.QR_TOKEN_REQUIRED !== "0";

export function normalizeTable(table) {
  return String(table ?? "").trim().toUpperCase().slice(0, 12);
}

export function tableToken(table) {
  return createHmac("sha256", SECRET).update(normalizeTable(table)).digest("hex").slice(0, 12);
}

export function verifyTableToken(table, token) {
  if (typeof token !== "string" || !token) return false;
  const want = Buffer.from(tableToken(table), "utf8");
  const got = Buffer.from(token.trim().toLowerCase(), "utf8");
  if (want.length !== got.length) return false;
  try {
    return timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** URL halaman tamu yang dipakai di dalam QR. */
export function guestPath(table) {
  const meja = encodeURIComponent(normalizeTable(table));
  const suffix = TOKEN_REQUIRED ? `&t=${tableToken(table)}` : "";
  return `/tamu?meja=${meja}${suffix}`;
}

export function guestUrl(base, table) {
  return `${String(base).replace(/\/$/, "")}${guestPath(table)}`;
}
