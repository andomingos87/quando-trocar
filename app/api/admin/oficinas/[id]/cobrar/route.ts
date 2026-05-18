import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { gerarCobrancaProxima } from "@/lib/admin/billing";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  try {
    const r = await gerarCobrancaProxima(supabase, id, { force: true });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, message: `nao_gerado:${r.reason}` },
        { status: 400 },
      );
    }
    await supabase.from("admin_audit_log").insert({
      admin_id: auth.admin.adminId,
      acao: "oficina.cobranca_manual_disparada",
      entidade: "oficinas",
      entidade_id: id,
      payload: { pagamento_id: r.pagamentoId, preference_id: r.preferenceId, reused: r.reused },
      ip: getRequestIp(request),
    });
    return NextResponse.json({
      ok: true,
      pagamento_id: r.pagamentoId,
      init_point: r.initPoint,
    });
  } catch (err) {
    console.error("admin cobrar manual failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao disparar cobranca." },
      { status: 500 },
    );
  }
}
