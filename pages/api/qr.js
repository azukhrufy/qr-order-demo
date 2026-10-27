import QRCode from "qrcode";
import { guestPath, normalizeTable, tableToken } from "@/lib/meja";

/**
 * GET /api/qr?meja=12&format=svg|png&base=https://...
 *
 * Menghasilkan QR yang mengarah ke halaman tamu (/tamu?meja=12&t=<token>),
 * dipakai untuk stand QR di meja. Default memakai host dari request, jadi
 * otomatis benar baik di localhost, Render, maupun domain sendiri.
 *
 * Token meja (HMAC dari nomor meja) membuat nomor meja di URL tidak bisa
 * ditebak orang luar: tanpa token, /api/order menolak dengan 403.
 */
export default async function handler(req, res) {
  const meja = normalizeTable(req.query.meja || req.query.table || "12");
  const format = String(req.query.format || "svg").toLowerCase();

  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = String(req.query.base || `${proto}://${host}`).replace(/\/$/, "");

  // Satu pola URL per meja, termasuk token-nya.
  const target = `${base}${guestPath(meja)}`;

  // format=json: dipakai untuk memeriksa isi QR tanpa decode gambar (probe/debug).
  if (format === "json") {
    return res.status(200).json({ meja, target, token: tableToken(meja) });
  }

  const opts = {
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#12100e", light: "#ffffff" }
  };

  try {
    if (format === "png") {
      const buf = await QRCode.toBuffer(target, { ...opts, type: "png", width: 900 });
      res.setHeader("content-type", "image/png");
      res.setHeader("cache-control", "public, max-age=3600");
      return res.send(buf);
    }

    const svg = await QRCode.toString(target, { ...opts, type: "svg" });
    res.setHeader("content-type", "image/svg+xml; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=3600");
    return res.send(svg);
  } catch (err) {
    return res.status(500).json({ error: "QR_FAILED", detail: String(err?.message || err) });
  }
}
