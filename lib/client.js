"use client";

import { useEffect, useState } from "react";

const EMPTY = { orders: [], soldout: [], calls: [] };

/**
 * Satu sumber state untuk tamu & staf.
 * Ambil snapshot awal via /api/state, lalu ikut stream SSE.
 */
export function useLive() {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    let alive = true;
    let source;

    fetch("/api/state", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (alive) setState(data);
      })
      .catch(() => {});

    source = new EventSource("/api/stream");
    source.addEventListener("update", (event) => {
      try {
        setState(JSON.parse(event.data));
      } catch {
        /* abaikan payload rusak */
      }
    });

    return () => {
      alive = false;
      source?.close();
    };
  }, []);

  return state;
}

export const rupiah = (value) => "Rp" + Number(value || 0).toLocaleString("id-ID");

export async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}
