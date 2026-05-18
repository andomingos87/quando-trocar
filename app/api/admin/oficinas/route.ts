import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  createOficinaManual,
  validateOficinaCreate,
} from "@/lib/admin/oficinas";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const validation = validateOficinaCreate((body ?? {}) as Record<string, unknown>);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.error.message, field: validation.error.field },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await createOficinaManual(supabase, validation.data, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao criar oficina.";
    if (status === 500) console.error("admin/oficinas POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
