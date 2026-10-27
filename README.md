# QR Order — demo alur pesan dari meja

Demo untuk menunjukkan alur inti sistem pesanan dari meja restoran.

- Tamu scan QR di meja → menu terbuka di browser HP (tanpa install aplikasi)
- Pesanan dikirim → **muncul di layar staf dalam hitungan detik** dengan bunyi
- Staf menandai item **Habis** → item langsung hilang dari menu tamu, dan pesanan yang masih
  memuat item tersebut **ditolak saat submit** (bukan hanya disembunyikan di UI)
- Tombol **Panggil pelayan** / **Minta bill** dari meja
- Timer SLA: order yang belum diterima lebih dari 2 menit ditandai merah di layar staf

## Menjalankan

Prasyarat: **Node 22 (LTS "Jod")** dan **Yarn 1.22.x** — lihat `.nvmrc` dan field `engines` di
`package.json`.

```bash
nvm use            # memakai Node 22 sesuai .nvmrc
yarn install --frozen-lockfile
yarn dev
```

Buka:

- `http://localhost:4173/` — halaman pemilih
- `http://localhost:4173/tamu` — halaman tamu (yang di-scan lewat QR)
- `http://localhost:4173/staf` — layar staf (pesanan & ketersediaan)

Untuk demo di lokasi: jalankan `yarn dev` di laptop, lalu buka `/tamu` dan `/staf` dari HP
yang berada di jaringan/hotspot yang sama, memakai IP LAN laptop.

> Catatan: dependency dikelola **yarn** (`yarn.lock` di-commit). `.yarnrc` sudah mengunci
> registry ke `registry.yarnpkg.com` supaya tidak mengambil mirror npm default mesin
> (`mirrors.tencentyun.com`) yang tidak bisa dipakai.


## Stack

- **Next.js 16 — Pages Router**, full JavaScript (`.jsx`), tanpa TypeScript
- **Chakra UI v2** (`@chakra-ui/react` + `@emotion/*` + `framer-motion`) untuk seluruh UI
- **react-icons** (`react-icons/fi`) untuk ikon
- State demo di memori (`lib/store.js`) — satu proses Node
- Realtime pakai **SSE** (`pages/api/stream.js`), bukan polling

## Struktur

```
pages/
  _app.jsx             ChakraProvider + theme
  index.jsx            halaman pemilih
  tamu.jsx             halaman tamu (menu, keranjang, status)
  staf.jsx             layar staf (inbox pesanan, ketersediaan)
  api/
    menu.js
    state.js
    order.js           POST kirim pesanan (validasi item habis → 409)
    order/status.js    ubah status pesanan
    soldout.js         tandai item habis / tersedia
    call.js            panggil pelayan / minta bill
    call/done.js       tandai panggilan selesai
    stream.js          SSE
    reset.js           kosongkan state demo
lib/
  menu.js              data menu (ganti isi file ini per resto)
  store.js             state + broadcast
  client.js            hook useLive (SSE) + helper fetch/rupiah
  theme.js             tema Chakra (warna, font, style global)
```

## Deploy

Aplikasi ini **butuh proses Node yang hidup** (API routes + state di memori + SSE). Bukan
kandidat static export.

**Render — Web Service (bukan Static Site).** Repo sudah menyertakan `render.yaml`; tinggal
New → Blueprint, atau manual dengan:

- Environment: **Node**
- Build: `yarn install --frozen-lockfile && yarn build`
- Start: `yarn start` (script membaca `$PORT` dari platform)
- `NODE_VERSION=22.23.4` (juga ada di `.node-version`)

Catatan Render: free tier tidur setelah ~15 menit idle (permintaan pertama setelah tidur
lambat ±30 detik) dan **state demo hilang saat proses restart/redeploy**. Jangan naikkan
jumlah instance — state tidak dibagi antar instance.

**Vercel — belum siap apa adanya.** Vercel menjalankan API route sebagai serverless function,
jadi `lib/store.js` (memori proses) tidak dibagi antar instance: pada uji 8 order paralel,
hanya 2 yang tersimpan. Untuk Vercel, state harus pindah ke Upstash Redis / database dan SSE
diganti polling.

## Batas demo (belum termasuk)

Belum ada login/role, database, printer thermal, pajak PB1/service charge, multi-meja sekaligus,
dan integrasi POS. Data hilang saat server restart — ini demo alur, bukan produk produksi.

## Mengganti menu per resto

Edit `lib/menu.js`: nama resto, nomor meja, kategori, dan daftar item. Tidak perlu menyentuh
kode lain.

## Prop QR untuk demo di lokasi

```bash
yarn qr http://<ip-lan-laptop>:4173/tamu 12 "Nama Resto"
```

Menghasilkan `qr-stand.html` (layout A6 siap cetak — buka di browser, Ctrl+P, pilih A6 atau
Save as PDF) dan `qr-stand.svg` (QR mentah). Jalankan ulang setiap kali IP laptop berubah,
karena QR mengarah ke alamat LAN saat demo.

