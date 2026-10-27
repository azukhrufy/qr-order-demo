import { NextResponse } from "next/server";
import { resetAll } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(resetAll());
}
