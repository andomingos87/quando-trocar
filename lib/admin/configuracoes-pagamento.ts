import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AsaasAmbiente } from "@/lib/payments/asaas-gateway";
import type { GatewaySlug } from "@/lib/payments/types";

import { withAdminAudit } from "./audit";

const PROVEDORES: readonly GatewaySlug[] = ["mercado_pago", "asaas"];
const AMBIENTES: readonly AsaasAmbiente[] = ["sandbox", "producao"];

// Nomes fixos dos segredos no Vault (ver migration 20260712120000).
export const PAYMENT_SECRET_NAMES = {
  asaas_api_key: "asaas_api_key",
  asaas_webhook_token: "asaas_webhook_token",
  mp_access_token: "mercado_pago_access_token",
  mp_webhook_secret: "mercado_pago_webhook_secret",
} as const;

export type ConfiguracoesPagamentoUpdate = {
  provedor_ativo?: GatewaySlug;
  asaas_ambiente?: AsaasAmbiente;
  // Segredos: write-only. Vazio/ausente = manter o atual.
  asaas_api_key?: string;
  asaas_webhook_token?: string;
  mp_access_token?: string;
  mp_webhook_secret?: string;
};

// Presenca de cada segredo — nunca o valor. Alimenta a UI e o guard de ativacao.
export type SecretPresence = {
  asaas_api_key_set: boolean;
  asaas_webhook_token_set: boolean;
  mp_access_token_set: boolean;
  mp_webhook_secret_set: boolean;
};

export type ConfiguracoesPagamentoRow = SecretPresence & {
  id: string;
  provedor_ativo: GatewaySlug;
  asaas_ambiente: AsaasAmbiente;
  updated_at: string;
};

export type ConfiguracoesPagamentoValidationError = { field: string; message: string };

function nonEmpty(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

// Validador puro (testavel sem DB). `presence` reflete os segredos ja usaveis.
export function validateConfiguracoesPagamentoInput(
  input: ConfiguracoesPagamentoUpdate,
  presence: SecretPresence,
): ConfiguracoesPagamentoValidationError | null {
  if (input.provedor_ativo !== undefined && !PROVEDORES.includes(input.provedor_ativo)) {
    return { field: "provedor_ativo", message: "Provedor invalido." };
  }
  if (input.asaas_ambiente !== undefined && !AMBIENTES.includes(input.asaas_ambiente)) {
    return { field: "asaas_ambiente", message: "Ambiente invalido." };
  }
  // Guard de ativacao: nao deixa ativar um provedor sem credencial usavel.
  if (input.provedor_ativo === "asaas") {
    const willHaveKey = nonEmpty(input.asaas_api_key) || presence.asaas_api_key_set;
    if (!willHaveKey) {
      return {
        field: "provedor_ativo",
        message: "Configure a API key do ASAAS antes de ativa-lo.",
      };
    }
  }
  if (input.provedor_ativo === "mercado_pago") {
    const willHaveToken = nonEmpty(input.mp_access_token) || presence.mp_access_token_set;
    if (!willHaveToken) {
      return {
        field: "provedor_ativo",
        message: "Configure o access token do Mercado Pago antes de ativa-lo.",
      };
    }
  }
  return null;
}

async function secretExists(supabase: SupabaseClient, name: string): Promise<boolean> {
  const { data } = await supabase.rpc("payment_secret_exists", { p_name: name });
  return data === true;
}

export async function getConfiguracoesPagamento(
  supabase: SupabaseClient,
): Promise<ConfiguracoesPagamentoRow> {
  const { data, error } = await supabase
    .from("configuracoes_pagamento")
    .select("id, provedor_ativo, asaas_ambiente, updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_configuracoes_pagamento_failed: ${error.message}`);
  if (!data) throw new Error("configuracoes_pagamento_not_seeded");

  const [asaasKey, asaasTok, mpTok, mpSec] = await Promise.all([
    secretExists(supabase, PAYMENT_SECRET_NAMES.asaas_api_key),
    secretExists(supabase, PAYMENT_SECRET_NAMES.asaas_webhook_token),
    secretExists(supabase, PAYMENT_SECRET_NAMES.mp_access_token),
    secretExists(supabase, PAYMENT_SECRET_NAMES.mp_webhook_secret),
  ]);

  return {
    id: data.id,
    provedor_ativo: data.provedor_ativo as GatewaySlug,
    asaas_ambiente: data.asaas_ambiente as AsaasAmbiente,
    updated_at: data.updated_at,
    asaas_api_key_set: asaasKey,
    asaas_webhook_token_set: asaasTok,
    // MP tambem aceita fallback por env (setup antigo do ADR-0008).
    mp_access_token_set: mpTok || !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
    mp_webhook_secret_set: mpSec || !!process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  };
}

export async function updateConfiguracoesPagamento(
  supabase: SupabaseClient,
  input: ConfiguracoesPagamentoUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<ConfiguracoesPagamentoRow> {
  const before = await getConfiguracoesPagamento(supabase);

  const validation = validateConfiguracoesPagamentoInput(input, before);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  // Grava segredos (write-only, upsert no Vault). Vazio = manter.
  const secretWrites: Array<[string, string | undefined]> = [
    [PAYMENT_SECRET_NAMES.asaas_api_key, input.asaas_api_key],
    [PAYMENT_SECRET_NAMES.asaas_webhook_token, input.asaas_webhook_token],
    [PAYMENT_SECRET_NAMES.mp_access_token, input.mp_access_token],
    [PAYMENT_SECRET_NAMES.mp_webhook_secret, input.mp_webhook_secret],
  ];
  const secretsAlterados: string[] = [];
  for (const [name, value] of secretWrites) {
    if (!nonEmpty(value)) continue;
    const { error } = await supabase.rpc("set_payment_secret", {
      p_name: name,
      p_value: value!.trim(),
    });
    if (error) throw new Error(`set_payment_secret_failed:${name}:${error.message}`);
    secretsAlterados.push(name);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: ctx.adminId,
  };
  if (input.provedor_ativo !== undefined) patch.provedor_ativo = input.provedor_ativo;
  if (input.asaas_ambiente !== undefined) patch.asaas_ambiente = input.asaas_ambiente;

  return withAdminAudit(
    supabase,
    (after: ConfiguracoesPagamentoRow) => ({
      adminId: ctx.adminId,
      acao: "configuracoes_pagamento.update",
      entidade: "configuracoes_pagamento",
      entidadeId: before.id,
      ip: ctx.ip,
      // NUNCA registrar segredos: so config nao-secreta + nomes alterados.
      payload: {
        before: { provedor_ativo: before.provedor_ativo, asaas_ambiente: before.asaas_ambiente },
        after: { provedor_ativo: after.provedor_ativo, asaas_ambiente: after.asaas_ambiente },
        secrets_alterados: secretsAlterados,
      },
    }),
    async () => {
      const { error } = await supabase
        .from("configuracoes_pagamento")
        .update(patch)
        .eq("id", before.id);
      if (error) throw new Error(`update_configuracoes_pagamento_failed: ${error.message}`);
      return getConfiguracoesPagamento(supabase);
    },
  );
}
