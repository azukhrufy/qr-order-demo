import { NextResponse } from "next/server";
import { doneCall } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const call = doneCall(String(body.id || ""));
  if (!call) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(call);
}
