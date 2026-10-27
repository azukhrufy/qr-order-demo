"use client";

import { useEffect, useMemo, useState } from "react";
import { useLive, rupiah, postJSON } from "@/lib/client";

export default function TamuPage() {
  const [menu, setMenu] = useState(null);
  const live = useLive();
  const soldout = useMemo(() => new Set(live.soldout), [live.soldout]);

  const [cart, setCart] = useState({});
  const [cat, setCat] = useState("Semua");
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => res.json())
      .then(setMenu)
      .catch(() => {});
  }, []);

  // Item yang sudah di keranjang lalu ditandai habis oleh staf → buang + beri tahu.
  useEffect(() => {
    if (!menu) return;
    setCart((prev) => {
      const gone = Object.keys(prev).filter((id) => soldout.has(id));
      if (!gone.length) return prev;
      const names = gone
        .map((id) => menu.items.find((it) => it.id === id)?.name)
        .filter(Boolean);
      const next = { ...prev };
      gone.forEach((id) => delete next[id]);
      setToast(`Menu baru habis: ${names.join(", ")} — dihapus dari pesanan.`);
      return next;
    });
  }, [live.soldout, menu, soldout]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const items = menu?.items ?? [];
  const total = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, qty]) => {
        const item = items.find((it) => it.id === id);
        return sum + (item ? item.price * qty : 0);
      }, 0),
    [cart, items]
  );
  const count = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart]
  );

  const order = orderId ? live.orders.find((o) => o.id === orderId) : null;

  function add(id) {
    if (soldout.has(id)) {
      setToast("Menu ini baru saja habis.");
      return;
    }
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function dec(id) {
    setCart((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  }

  async function submit() {
    const payload = Object.entries(cart).map(([id, qty]) => {
      const item = items.find((it) => it.id === id);
      return { id, name: item.name, qty, price: item.price };
    });
    if (!payload.length) {
      setToast("Pesanan masih kosong.");
      return;
    }
    setSending(true);
    const { ok, status, data } = await postJSON("/api/order", {
      table: menu.table,
      items: payload,
      note
    });
    setSending(false);

    if (status === 409 && data?.items) {
      setCart((prev) => {
        const next = { ...prev };
        data.items.forEach((name) => {
          const item = items.find((it) => it.name === name);
          if (item) delete next[item.id];
        });
        return next;
      });
      setToast(`Baru saja habis: ${data.items.join(", ")}. Silakan pilih menu lain.`);
      return;
    }
    if (!ok) {
      setToast("Pesanan gagal dikirim. Coba lagi.");
      return;
    }

    setOrderId(data.id);
    setCart({});
    setNote("");
    setSheet(false);
  }

  async function callWaiter(type) {
    await postJSON("/api/call", { table: menu?.table, type });
    setToast(
      type === "bill"
        ? "Permintaan bill dikirim — staf akan datang."
        : "Panggilan terkirim — staf akan menghampiri meja."
    );
  }

  if (!menu) {
    return <main className="t-list">Memuat menu…</main>;
  }

  const cats = ["Semua", ...menu.categories];
  const visible = items.filter(
    (it) => cat === "Semua" || it.cat === cat || it.tag === cat
  );

  const statusStep = (() => {
    const s = order?.status;
    if (!s) return 0;
    if (s === "diproses") return 2;
    if (s === "siap" || s === "disajikan") return 3;
    return 1;
  })();

  return (
    <div className="t-body">
      <header className="t-head">
        <div className="t-brand">
          {menu.resto}
          <small>Pesan langsung dari meja</small>
        </div>
        <div className="t-table">Meja {menu.table}</div>
      </header>

      <div className="t-chips">
        {cats.map((c) => (
          <button key={c} className={`t-chip ${c === cat ? "on" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="t-list">
        {visible.map((it) => {
          const off = soldout.has(it.id);
          return (
            <div key={it.id} className={`t-item ${off ? "off" : ""}`}>
              <div className="t-thumb">{it.emoji || "🍽️"}</div>
              <div style={{ minWidth: 0 }}>
                <h3>{it.name}</h3>
                <p>{it.desc}</p>
                <div className="t-price">{rupiah(it.price)}</div>
              </div>
              {off ? (
                <span className="t-habis">HABIS</span>
              ) : (
                <button className="t-add" onClick={() => add(it.id)} aria-label={`Tambah ${it.name}`}>
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="t-call">
        <button onClick={() => callWaiter("pelayan")}>🔔 Panggil pelayan</button>
        <button onClick={() => callWaiter("bill")}>🧾 Minta bill</button>
      </div>

      {count > 0 ? (
        <div className="t-bar">
          <button className="btn ghost" onClick={() => setSheet(true)}>
            {count} item
          </button>
          <button className="btn" onClick={() => setSheet(true)}>
            Lihat pesanan · {rupiah(total)}
          </button>
        </div>
      ) : null}

      {sheet ? (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="sheet-panel">
            <h2>Pesanan meja {menu.table}</h2>
            {Object.entries(cart).length === 0 ? (
              <p className="t-hint">Belum ada item.</p>
            ) : (
              Object.entries(cart).map(([id, qty]) => {
                const it = items.find((x) => x.id === id);
                if (!it) return null;
                return (
                  <div className="t-row" key={id}>
                    <div>
                      <div className="n">{it.name}</div>
                      <div className="p">{rupiah(it.price)}</div>
                    </div>
                    <div className="t-qty">
                      <button onClick={() => dec(id)}>−</button>
                      <b>{qty}</b>
                      <button onClick={() => add(id)}>+</button>
                    </div>
                  </div>
                );
              })
            )}
            <div className="t-total">
              <span>Total</span>
              <span>{rupiah(total)}</span>
            </div>
            <p className="t-hint">Belum termasuk pajak &amp; service. Pembayaran di kasir.</p>
            <input
              className="t-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan untuk dapur (mis. tanpa sambal, es sedikit)"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn ghost" onClick={() => setSheet(false)}>
                Tutup
              </button>
              <button className="btn" onClick={submit} disabled={sending}>
                {sending ? "Mengirim…" : "Kirim ke dapur"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {orderId ? (
        <div className="t-done">
          <div className="t-tick">✓</div>
          <h1>{order?.status === "ditolak" ? "Pesanan ditolak staf" : "Pesanan terkirim!"}</h1>
          <p>
            Meja {menu.table} · {rupiah(order?.total || 0)}
          </p>
          <div className="t-steps">
            <div className={`t-step ${statusStep >= 1 ? "on" : ""}`}>
              <div className="t-dot" />
              <div>
                <div className="t-lbl">Pesanan diterima</div>
              </div>
            </div>
            <div className={`t-step ${statusStep >= 2 ? "on" : ""}`}>
              <div className="t-dot" />
              <div>
                <div className="t-lbl">Sedang disiapkan dapur</div>
              </div>
            </div>
            <div className={`t-step ${statusStep >= 3 ? "on" : ""}`}>
              <div className="t-dot" />
              <div>
                <div className="t-lbl">Siap, segera diantar</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
            <button className="btn ghost" onClick={() => setOrderId(null)}>
              Tambah pesanan
            </button>
            <button className="btn" onClick={() => callWaiter("bill")}>
              Minta bill di kasir
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="t-toast">{toast}</div> : null}
    </div>
  );
}
