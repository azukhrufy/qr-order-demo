import { NextResponse } from "next/server";
import { addCall } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const call = addCall(body.table, body.type);
  return NextResponse.json(call, { status: 201 });
}
