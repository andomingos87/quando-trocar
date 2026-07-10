import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { marcarComissoesPagasLote } from "@/lib/admin/comissoes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { representante_id?: unknown; mes?: unknown };
  try {
    body = (await request.json()) as { representante_id?: unknown; mes?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  if (typeof body.representante_id !== "string" || body.representante_id.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Representante obrigatorio." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await marcarComissoesPagasLote(
      supabase,
      {
        representante_id: body.representante_id,
        mes: typeof body.mes === "string" && body.mes ? body.mes : undefined,
      },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao marcar comissoes em lote.";
    if (status === 500) console.error("admin/comissoes pagar-lote failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
