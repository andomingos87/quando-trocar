import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  getConfiguracoesPagamento,
  updateConfiguracoesPagamento,
  type ConfiguracoesPagamentoUpdate,
} from "@/lib/admin/configuracoes-pagamento";
import { getRequestIp } from "@/lib/admin/request-ip";
import type { AsaasAmbiente } from "@/lib/payments/asaas-gateway";
import type { GatewaySlug } from "@/lib/payments/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const configuracoes = await getConfiguracoesPagamento(supabase);
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    console.error("admin/configuracoes-pagamento GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao carregar configuracoes de pagamento." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Partial<ConfiguracoesPagamentoUpdate>;
  try {
    body = (await request.json()) as Partial<ConfiguracoesPagamentoUpdate>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const patch: ConfiguracoesPagamentoUpdate = {};
  if (typeof body.provedor_ativo === "string") {
    patch.provedor_ativo = body.provedor_ativo as GatewaySlug;
  }
  if (typeof body.asaas_ambiente === "string") {
    patch.asaas_ambiente = body.asaas_ambiente as AsaasAmbiente;
  }
  // Segredos: so repassa quando vierem preenchidos (write-only).
  if (typeof body.asaas_api_key === "string" && body.asaas_api_key.trim()) {
    patch.asaas_api_key = body.asaas_api_key;
  }
  if (typeof body.asaas_webhook_token === "string" && body.asaas_webhook_token.trim()) {
    patch.asaas_webhook_token = body.asaas_webhook_token;
  }
  if (typeof body.mp_access_token === "string" && body.mp_access_token.trim()) {
    patch.mp_access_token = body.mp_access_token;
  }
  if (typeof body.mp_webhook_secret === "string" && body.mp_webhook_secret.trim()) {
    patch.mp_webhook_secret = body.mp_webhook_secret;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const configuracoes = await updateConfiguracoesPagamento(supabase, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar configuracoes de pagamento.";
    if (status === 500) console.error("admin/configuracoes-pagamento PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
