"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLive, rupiah, postJSON } from "@/lib/client";

const STATUS_FLOW = {
  menunggu: "diterima",
  diterima: "diproses",
  diproses: "siap",
  siap: "disajikan"
};

function timeAgo(ts, now) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  return `${Math.floor(s / 60)} mnt lalu`;
}

export default function StafPage() {
  const [menu, setMenu] = useState(null);
  const live = useLive();
  const [tab, setTab] = useState("orders");
  const [audioReady, setAudioReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const audioCtxRef = useRef(null);
  const seenOrdersRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => res.json())
      .then(setMenu)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Bunyi hanya setelah interaksi staf (kebijakan autoplay browser).
  useEffect(() => {
    if (!audioReady) return;

    function beep() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      [0, 0.18].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = idx ? 1180 : 880;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + offset;
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    }

    const fresh = live.orders.filter(
      (o) => o.status === "menunggu" && !seenOrdersRef.current.has(o.id)
    );
    live.orders.forEach((o) => seenOrdersRef.current.add(o.id));

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    if (fresh.length) beep();
  }, [live.orders, audioReady]);

  function unlockAudio() {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    audioCtxRef.current.resume();
    setAudioReady(true);
  }

  const pending = live.orders.filter((o) => o.status === "menunggu").length;
  const calls = live.calls.filter((c) => !c.done);
  const items = menu?.items ?? [];

  const visibleOrders = useMemo(
    () => live.orders.filter((o) => o.status !== "ditolak").slice(0, 20),
    [live.orders]
  );

  async function setStatus(id, status) {
    await postJSON("/api/order/status", { id, status });
  }
  async function toggleSoldout(id, value) {
    await postJSON("/api/soldout", { id, value });
  }
  async function closeCall(id) {
    await postJSON("/api/call/done", { id });
  }
  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    seenOrdersRef.current = new Set();
    firstLoadRef.current = true;
  }

  if (!menu) return <main className="s-main">Memuat…</main>;

  return (
    <div className="s-wrap">
      <header className="s-head">
        <h1>
          Layar Staf<small>demo · pesanan &amp; ketersediaan</small>
        </h1>
        <div className={`s-pill ${pending ? "alert" : ""}`}>{pending} menunggu</div>
        <button className={`s-btn ${audioReady ? "go" : ""}`} onClick={unlockAudio}>
          {audioReady ? "🔊 Suara aktif" : "🔈 Aktifkan suara"}
        </button>
        <button className="s-btn" onClick={reset}>
          Reset
        </button>
      </header>

      <div className="s-tabs">
        <button className={`s-tab ${tab === "orders" ? "on" : ""}`} onClick={() => setTab("orders")}>
          Pesanan
        </button>
        <button className={`s-tab ${tab === "avail" ? "on" : ""}`} onClick={() => setTab("avail")}>
          Ketersediaan menu
        </button>
      </div>

      <main className="s-main">
        {tab === "orders" ? (
          <>
            {calls.length ? (
              <div className="s-calls">
                {calls.map((c) => (
                  <div className="s-call" key={c.id}>
                    <span>
                      {c.type === "bill" ? "🧾 Minta bill" : "🔔 Panggil pelayan"} — <b>Meja {c.table}</b>
                    </span>
                    <span className="s-time">{timeAgo(c.createdAt, now)}</span>
                    <button className="s-btn go" style={{ marginLeft: "auto" }} onClick={() => closeCall(c.id)}>
                      Sudah direspons
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {!visibleOrders.length && !calls.length ? (
              <div className="s-empty">
                Belum ada pesanan masuk.
                <br />
                Buka <b>/tamu</b> di HP lain, lalu kirim pesanan.
              </div>
            ) : null}

            {visibleOrders.map((o) => {
              const late = o.status === "menunggu" && now - o.createdAt > 120000;
              const next = STATUS_FLOW[o.status];
              return (
                <div className={`s-order ${late ? "late" : ""}`} key={o.id}>
                  <div className="s-ohead">
                    <span className="s-table">Meja {o.table}</span>
                    <span className="s-time">{timeAgo(o.createdAt, now)}</span>
                    {late ? <span className="s-time" style={{ color: "#ffb4ad" }}>⚠ belum diterima &gt;2 mnt</span> : null}
                    <span className={`s-status ${o.status}`}>{o.status}</span>
                  </div>

                  <div className="s-lines">
                    {o.items.map((it, idx) => (
                      <div className="s-li" key={`${o.id}-${idx}`}>
                        <q>{it.qty}×</q>
                        <span>
                          {it.name}
                          {it.note ? <span className="s-time"> ({it.note})</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>

                  {o.note ? <div className="s-note">📝 {o.note}</div> : null}

                  <div className="s-ohead">
                    <span className="s-time">Total {rupiah(o.total)}</span>
                  </div>

                  <div className="s-actions">
                    {o.status === "menunggu" ? (
                      <>
                        <button className="s-btn go" onClick={() => setStatus(o.id, "diterima")}>
                          Terima &amp; kirim ke dapur
                        </button>
                        <button className="s-btn bad" onClick={() => setStatus(o.id, "ditolak")}>
                          Tolak
                        </button>
                      </>
                    ) : null}
                    {next && o.status !== "menunggu" ? (
                      <button className="s-btn warn" onClick={() => setStatus(o.id, next)}>
                        {next === "diproses"
                          ? "Mulai diproses"
                          : next === "siap"
                          ? "Siap diantar"
                          : "Sudah disajikan"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="s-hintbar">
              Tap <b>Habis</b> — item langsung hilang dari menu tamu dalam hitungan detik. Tamu yang
              sudah memasukkannya ke keranjang akan ditolak saat mengirim pesanan.
            </div>
            <div className="s-grid">
              {items.map((it) => {
                const off = live.soldout.includes(it.id);
                return (
                  <div className={`s-av ${off ? "off" : ""}`} key={it.id}>
                    <div className="nm">
                      {it.emoji} {it.name}
                    </div>
                    <div className="pr">
                      {rupiah(it.price)} · {it.cat}
                    </div>
                    <button
                      className={`s-btn ${off ? "go" : "bad"}`}
                      onClick={() => toggleSoldout(it.id, !off)}
                    >
                      {off ? "Tersedia lagi" : "Habis"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
