import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { cancelarPagamentoPendente } from "@/lib/admin/pagamentos";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  let body: { justificativa?: unknown };
  try {
    body = (await request.json()) as { justificativa?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }
  if (typeof body.justificativa !== "string" || body.justificativa.trim().length === 0) {
    return NextResponse.json(
      { ok: false, message: "Justificativa obrigatoria." },
      { status: 400 },
    );
  }
  try {
    const supabase = createSupabaseAdminClient();
    await cancelarPagamentoPendente(supabase, id, {
      adminId: auth.admin.adminId,
      justificativa: body.justificativa.trim(),
      ip: getRequestIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao cancelar.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
