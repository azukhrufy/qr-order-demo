import { NextResponse } from "next/server";
import { setOrderStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const order = setOrderStatus(String(body.id || ""), String(body.status || ""));
  if (!order) return NextResponse.json({ error: "NOT_FOUND_OR_BAD_STATUS" }, { status: 404 });
  return NextResponse.json(order);
}
