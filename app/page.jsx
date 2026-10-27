"use client";

import { useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState("");

  async function reset() {
    setMsg("mereset…");
    await fetch("/api/reset", { method: "POST" });
    setMsg("state demo sudah dikosongkan ✓");
  }

  return (
    <main className="lp">
      <div className="lp-card">
        <h1>QR Order — demo alur</h1>
        <p>
          Tamu scan QR di meja, pesanan langsung masuk ke layar staf, dan ketersediaan menu bisa
          diubah real-time. Buka dua layar ini bersamaan (HP + laptop) untuk melihat alurnya.
        </p>
        <a className="primary" href="/tamu">
          Halaman tamu (scan QR / menu)
        </a>
        <a className="secondary" href="/staf">
          Layar staf (pesanan &amp; ketersediaan)
        </a>
        <button className="s-btn" style={{ width: "100%", marginTop: 6 }} onClick={reset}>
          Reset state demo
        </button>
        {msg ? <small>{msg}</small> : null}
        <small>
          Demo: data di memori, tanpa login, tanpa pembayaran. Untuk demo di lokasi, jalankan
          server di laptop lalu buka dari HP di jaringan yang sama.
        </small>
      </div>
    </main>
  );
}
