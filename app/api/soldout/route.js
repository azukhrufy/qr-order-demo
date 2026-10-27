import { NextResponse } from "next/server";
import { setSoldout } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  const soldout = setSoldout(id, Boolean(body.value));
  return NextResponse.json({ soldout });
}
