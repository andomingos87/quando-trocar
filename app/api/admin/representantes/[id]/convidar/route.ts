import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { buildConviteRepresentante } from "@/lib/admin/convite-representante";
import { getRepresentanteById } from "@/lib/admin/representantes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { siteConfig } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Convite manual do representante para o portal (ADR-0025). Acao iniciada por
// admin humano (ADR-0001), auditada. Usa template Meta aprovado — obrigatorio
// porque o representante quase nunca esta na janela de 24h da conta.
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const representante = await getRepresentanteById(supabase, id);
  if (!representante) {
    return NextResponse.json(
      { ok: false, message: "Representante nao encontrado." },
      { status: 404 },
    );
  }

  const convite = buildConviteRepresentante({
    rep: representante,
    siteUrl: siteConfig.siteUrl,
  });
  if (!convite.ok) {
    return NextResponse.json(
      { ok: false, message: convite.message },
      { status: convite.status },
    );
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_CONVITE_REP_NAME;
  if (!templateName) {
    console.error("representante/convidar missing WHATSAPP_TEMPLATE_CONVITE_REP_NAME");
    return NextResponse.json(
      { ok: false, message: "Template de convite nao configurado." },
      { status: 503 },
    );
  }

  try {
    const client = new WhatsAppCloudApiClient();
    await client.sendTemplateMessage({
      to: convite.payload.to,
      templateName,
      languageCode: "pt_BR",
      bodyParameters: convite.payload.bodyParameters,
      // Template criado com variaveis NOMEADAS ({{nome}}, {{link}}) — a Meta
      // rejeita envio posicional contra template nomeado.
      bodyParameterNames: convite.payload.bodyParameterNames,
    });
  } catch (err) {
    console.error("representante/convidar template send failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao enviar o convite. Tente novamente." },
      { status: 502 },
    );
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: auth.admin.adminId,
    acao: "representante.convite_enviado",
    entidade: "representantes",
    entidade_id: id,
    payload: { whatsapp: representante.whatsapp, portal_url: convite.payload.portalUrl },
    ip: getRequestIp(request),
  });

  return NextResponse.json({ ok: true, message: "Convite enviado no WhatsApp." });
}
