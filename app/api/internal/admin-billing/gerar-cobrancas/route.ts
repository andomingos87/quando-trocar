import { NextResponse } from "next/server";

import { gerarCobrancaProxima } from "@/lib/admin/billing";
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
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: oficinas, error } = await supabase
    .from("oficinas")
    .select("id, proximo_vencimento")
    .eq("status", "ativa")
    .gte("proximo_vencimento", today)
    .lte("proximo_vencimento", horizon);
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  let preferenciasGeradas = 0;
  const erros: unknown[] = [];

  for (const o of oficinas ?? []) {
    try {
      const r = await gerarCobrancaProxima(supabase, o.id, {
        notificationUrl:
          process.env.MERCADO_PAGO_NOTIFICATION_URL ||
          process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.MERCADO_PAGO_NOTIFICATION_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercado-pago`
            : undefined,
      });
      if (r.ok && !r.reused) preferenciasGeradas += 1;
    } catch (err) {
      erros.push({ oficina_id: o.id, error: String(err) });
    }
  }

  await supabase.from("cobranca_jobs").insert({
    tipo: "cobranca_proxima",
    oficinas_avaliadas: oficinas?.length ?? 0,
    preferencias_geradas: preferenciasGeradas,
    pausas_aplicadas: 0,
    erros: erros.length > 0 ? erros : null,
  });

  return NextResponse.json({
    ok: true,
    oficinas_avaliadas: oficinas?.length ?? 0,
    preferencias_geradas: preferenciasGeradas,
    erros_count: erros.length,
  });
}
