import { NextResponse } from "next/server";
import { store, addOrder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "EMPTY_ORDER" }, { status: 400 });
  }

  // Validasi ULANG ketersediaan saat submit — bukan hanya disembunyikan di UI.
  const blocked = items
    .filter((it) => store.soldout.has(String(it.id)))
    .map((it) => String(it.name || it.id));

  if (blocked.length) {
    return NextResponse.json({ error: "ITEM_HABIS", items: blocked }, { status: 409 });
  }

  const order = addOrder({ table: body.table, items, note: body.note });
  return NextResponse.json(order, { status: 201 });
}
