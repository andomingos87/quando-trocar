import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { cancelarComissao } from "@/lib/admin/comissoes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let body: { motivo?: unknown };
  try {
    body = (await request.json()) as { motivo?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await cancelarComissao(
      supabase,
      id,
      { motivo: typeof body.motivo === "string" ? body.motivo : "" },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao cancelar comissao.";
    if (status === 500) console.error("admin/comissoes cancelar failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
