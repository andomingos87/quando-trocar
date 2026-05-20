import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

export type ConfiguracoesVendedorRow = {
  id: string;
  taxa_recuperacao_roi: number;
  whatsapp_handoff_comercial: string;
  frases_landing: string[];
  updated_at: string;
};

export type ConfiguracoesVendedorUpdate = {
  taxa_recuperacao_roi?: number;
  whatsapp_handoff_comercial?: string;
  frases_landing?: string[];
};

export type ConfiguracoesValidationError =
  | { field: "taxa_recuperacao_roi"; message: string }
  | { field: "whatsapp_handoff_comercial"; message: string }
  | { field: "frases_landing"; message: string };

const WHATSAPP_REGEX = /^\+[1-9][0-9]{7,14}$/;

export function validateConfiguracoesInput(
  input: ConfiguracoesVendedorUpdate,
): ConfiguracoesValidationError | null {
  if (input.taxa_recuperacao_roi !== undefined) {
    const value = input.taxa_recuperacao_roi;
    if (typeof value !== "number" || Number.isNaN(value) || value <= 0 || value >= 1) {
      return {
        field: "taxa_recuperacao_roi",
        message: "Taxa deve ser numero entre 0 e 1 (ex: 0.15 = 15%).",
      };
    }
  }
  if (input.whatsapp_handoff_comercial !== undefined) {
    if (
      typeof input.whatsapp_handoff_comercial !== "string" ||
      !WHATSAPP_REGEX.test(input.whatsapp_handoff_comercial)
    ) {
      return {
        field: "whatsapp_handoff_comercial",
        message: "WhatsApp em formato E.164 (ex: +5511945207618).",
      };
    }
  }
  if (input.frases_landing !== undefined) {
    if (!Array.isArray(input.frases_landing)) {
      return { field: "frases_landing", message: "Frases devem ser uma lista." };
    }
    if (input.frases_landing.length === 0) {
      return { field: "frases_landing", message: "Pelo menos uma frase-gatilho." };
    }
    if (
      input.frases_landing.some((f) => typeof f !== "string" || f.trim().length === 0)
    ) {
      return { field: "frases_landing", message: "Frases nao podem ser vazias." };
    }
  }
  return null;
}

export async function getConfiguracoesVendedor(
  supabase: SupabaseClient,
): Promise<ConfiguracoesVendedorRow> {
  const { data, error } = await supabase
    .from("configuracoes_vendedor")
    .select("id, taxa_recuperacao_roi, whatsapp_handoff_comercial, frases_landing, updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_configuracoes_failed: ${error.message}`);
  if (!data) {
    throw new Error("configuracoes_vendedor_not_seeded");
  }
  return {
    ...data,
    taxa_recuperacao_roi: Number(data.taxa_recuperacao_roi),
    frases_landing: data.frases_landing ?? [],
  };
}

export async function updateConfiguracoesVendedor(
  supabase: SupabaseClient,
  input: ConfiguracoesVendedorUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<ConfiguracoesVendedorRow> {
  const validation = validateConfiguracoesInput(input);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  const before = await getConfiguracoesVendedor(supabase);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: ctx.adminId,
  };
  if (input.taxa_recuperacao_roi !== undefined) {
    patch.taxa_recuperacao_roi = input.taxa_recuperacao_roi;
  }
  if (input.whatsapp_handoff_comercial !== undefined) {
    patch.whatsapp_handoff_comercial = input.whatsapp_handoff_comercial;
  }
  if (input.frases_landing !== undefined) {
    patch.frases_landing = input.frases_landing
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  return withAdminAudit(
    supabase,
    (after: ConfiguracoesVendedorRow) => ({
      adminId: ctx.adminId,
      acao: "configuracoes_vendedor.update",
      entidade: "configuracoes_vendedor",
      entidadeId: before.id,
      ip: ctx.ip,
      payload: { before, after },
    }),
    async () => {
      const { data, error } = await supabase
        .from("configuracoes_vendedor")
        .update(patch)
        .eq("id", before.id)
        .select("id, taxa_recuperacao_roi, whatsapp_handoff_comercial, frases_landing, updated_at")
        .single();
      if (error) throw new Error(`update_configuracoes_failed: ${error.message}`);
      return {
        ...data,
        taxa_recuperacao_roi: Number(data.taxa_recuperacao_roi),
        frases_landing: data.frases_landing ?? [],
      };
    },
  );
}
