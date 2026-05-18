import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const { data: pagamento } = await supabase
    .from("pagamentos")
    .select("id, status, valor, mp_preference_id, oficina_id, oficinas:oficina_id (nome, whatsapp_principal)")
    .eq("id", id)
    .maybeSingle();
  if (!pagamento) {
    return NextResponse.json({ ok: false, message: "Pagamento nao encontrado." }, { status: 404 });
  }
  if (pagamento.status !== "pendente") {
    return NextResponse.json(
      { ok: false, message: "Somente pagamentos pendentes podem ser reenviados." },
      { status: 400 },
    );
  }
  if (!pagamento.mp_preference_id) {
    return NextResponse.json(
      { ok: false, message: "Sem preference_id no pagamento — gere novamente." },
      { status: 400 },
    );
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_COBRANCA_NAME;
  if (!templateName) {
    return NextResponse.json(
      { ok: false, message: "Template de cobranca nao configurado." },
      { status: 503 },
    );
  }

  const oficinaRaw = (pagamento as { oficinas?: unknown }).oficinas;
  const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] : oficinaRaw;
  if (!oficina) {
    return NextResponse.json({ ok: false, message: "Oficina nao encontrada." }, { status: 404 });
  }

  const initPoint = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${pagamento.mp_preference_id}`;
  try {
    const client = new WhatsAppCloudApiClient();
    await client.sendTemplateMessage({
      to: (oficina as { whatsapp_principal: string }).whatsapp_principal,
      templateName,
      languageCode: "pt_BR",
      bodyParameters: [
        (oficina as { nome: string }).nome,
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          Number(pagamento.valor),
        ),
        initPoint,
      ],
    });
  } catch (err) {
    console.error("reenviar template failed", err);
    return NextResponse.json({ ok: false, message: "Erro ao reenviar." }, { status: 502 });
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: auth.admin.adminId,
    acao: "pagamento.link_reenviado",
    entidade: "pagamentos",
    entidade_id: id,
    payload: { oficina_id: pagamento.oficina_id },
    ip: getRequestIp(request),
  });

  return NextResponse.json({ ok: true });
}
