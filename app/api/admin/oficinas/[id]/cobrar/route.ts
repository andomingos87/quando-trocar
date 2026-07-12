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
      const REASON_MSG: Record<string, string> = {
        preco_zero: "Preco efetivo e zero — ajuste o plano ou o preco negociado.",
        cancelada: "Oficina cancelada nao pode ser cobrada.",
        missing_vencimento: "Oficina sem proximo vencimento.",
        missing_plano: "Oficina sem plano definido.",
        missing_cpf_cnpj: "Preencha o CPF/CNPJ da oficina antes de cobrar via ASAAS.",
      };
      return NextResponse.json(
        { ok: false, message: REASON_MSG[r.reason] ?? `nao_gerado:${r.reason}` },
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
