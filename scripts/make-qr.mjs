#!/usr/bin/env node
/**
 * Generator QR stand untuk demo di lokasi.
 *
 * Pemakaian:
 *   node scripts/make-qr.mjs <url> [meja] [nama-resto]
 * Contoh:
 *   node scripts/make-qr.mjs http://192.168.1.7:4173/tamu 12 "Cafe D'Pakar"
 *
 * Hasil: qr-stand.html — buka di browser, Ctrl+P, pilih ukuran A6 (atau simpan PDF).
 * Catatan: URL yang dipakai adalah IP LAN laptop saat demo, jadi jalankan ulang
 * setiap kali jaringan/IP berubah.
 */
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const [, , urlArg, tableArg = "12", restoArg = "Resto Demo"] = process.argv;

if (!urlArg) {
  console.error("Pemakaian: node scripts/make-qr.mjs <url> [meja] [nama-resto]");
  process.exit(1);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const qr = await QRCode.toString(urlArg, {
  type: "svg",
  margin: 0,
  errorCorrectionLevel: "M",
  color: { dark: "#12100e", light: "#ffffff" }
});

// qrcode mengembalikan <svg ...>...</svg>; buang deklarasi xml bila ada
const qrInner = qr.replace(/<\?xml.*?\?>/s, "").trim();

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>QR Stand — Meja ${esc(tableArg)}</title>
<style>
  @page { size: A6 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #12100e;
    color: #f5efe6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .card {
    width: 105mm;
    height: 148mm;
    padding: 10mm 9mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background: radial-gradient(120% 80% at 50% 0%, #241d14 0%, #12100e 60%);
  }
  .brand { font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: #e8a33d; }
  .table { font-size: 26pt; font-weight: 800; line-height: 1; margin-top: 2mm; }
  .qr {
    background: #fff;
    padding: 5mm;
    border-radius: 5mm;
    width: 66mm;
    height: 66mm;
  }
  .qr svg { width: 100%; height: 100%; display: block; }
  .hint { font-size: 9.5pt; text-align: center; line-height: 1.45; color: #f5efe6; }
  .hint b { color: #e8a33d; }
  .foot { font-size: 7.5pt; text-align: center; color: #a99e8f; letter-spacing: .2px; }
</style>
</head>
<body>
  <div class="card">
    <div style="text-align:center">
      <div class="brand">${esc(restoArg)}</div>
      <div class="table">MEJA ${esc(tableArg)}</div>
    </div>

    <div class="qr">${qrInner}</div>

    <div class="hint">
      Scan untuk melihat menu &amp;<br><b>pesan langsung dari meja ini</b>
    </div>

    <div class="foot">Tanpa install aplikasi · pesanan langsung masuk ke staf</div>
  </div>
</body>
</html>
`;

await writeFile("qr-stand.html", html, "utf8");
await writeFile("qr-stand.svg", qrInner, "utf8");
console.log(`qr-stand.html dibuat untuk: ${urlArg} (meja ${tableArg})`);
console.log("Buka di browser → Ctrl+P → ukuran kertas A6 (atau Save as PDF).");
