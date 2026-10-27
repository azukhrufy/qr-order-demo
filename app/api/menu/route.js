import { NextResponse } from "next/server";
import menu from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(menu, { headers: { "cache-control": "no-store" } });
}
