import { NextResponse } from "next/server";

import { clearRepresentanteSessionCookie } from "@/lib/representante/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearRepresentanteSessionCookie();
  return NextResponse.json({ ok: true });
}
