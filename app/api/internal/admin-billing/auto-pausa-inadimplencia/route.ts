import { NextResponse } from "next/server";

import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-internal-job-secret");
  return provided === secret;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const grace = Number(process.env.INADIMPLENCIA_DIAS_GRACE ?? "7");
  const cutoff = new Date(Date.now() - grace * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: candidatas, error } = await supabase
    .from("oficinas")
    .select("id, nome, whatsapp_principal, proximo_vencimento")
    .eq("status", "ativa")
    .lt("proximo_vencimento", cutoff);
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  let pausasAplicadas = 0;
  const erros: unknown[] = [];

  for (const o of candidatas ?? []) {
    try {
      // Tem pagamento pago cobrindo o ciclo? Se sim, nao pausa.
      const { count: pagosNoCiclo } = await supabase
        .from("pagamentos")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", o.id)
        .eq("vencimento", o.proximo_vencimento)
        .eq("status", "pago");
      if ((pagosNoCiclo ?? 0) > 0) continue;

      const { error: updError } = await supabase
        .from("oficinas")
        .update({
          status: "pausada",
          motivo_pausa: "inadimplencia",
          updated_at: new Date().toISOString(),
        })
        .eq("id", o.id);
      if (updError) throw new Error(updError.message);

      await supabase.from("admin_audit_log").insert({
        admin_id: null,
        acao: "oficina.auto_pausa_inadimplencia",
        entidade: "oficinas",
        entidade_id: o.id,
        payload: { proximo_vencimento_antes: o.proximo_vencimento, grace_dias: grace },
      });

      const templateName = process.env.WHATSAPP_TEMPLATE_COBRANCA_NAME;
      if (templateName) {
        try {
          const client = new WhatsAppCloudApiClient();
          await client.sendTemplateMessage({
            to: o.whatsapp_principal,
            templateName,
            languageCode: "pt_BR",
            bodyParameters: [o.nome, "suspenso por inadimplencia", ""],
          });
        } catch (err) {
          console.error("auto-pausa template send failed", err);
        }
      }

      pausasAplicadas += 1;
    } catch (err) {
      erros.push({ oficina_id: o.id, error: String(err) });
    }
  }

  await supabase.from("cobranca_jobs").insert({
    tipo: "auto_pausa_inadimplencia",
    oficinas_avaliadas: candidatas?.length ?? 0,
    preferencias_geradas: 0,
    pausas_aplicadas: pausasAplicadas,
    erros: erros.length > 0 ? erros : null,
  });

  return NextResponse.json({
    ok: true,
    candidatas: candidatas?.length ?? 0,
    pausas_aplicadas: pausasAplicadas,
    erros_count: erros.length,
  });
}
