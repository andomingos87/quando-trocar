import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

export type TipoServicoKey = "troca_oleo" | "amortecedor" | "revisao" | "outro";

export type TipoServicoDefault = {
  tipo_servico: TipoServicoKey;
  label: string;
  dias_lembrete: number;
  template_name: string;
  template_language: string;
  ativo: boolean;
  updated_at: string;
};

export type TipoServicoUpdate = {
  label?: string;
  dias_lembrete?: number;
  template_name?: string;
  template_language?: string;
  ativo?: boolean;
};

export type TipoServicoValidationError =
  | { field: "label"; message: string }
  | { field: "dias_lembrete"; message: string }
  | { field: "template_name"; message: string }
  | { field: "template_language"; message: string };

const TIPO_SERVICO_KEYS: readonly TipoServicoKey[] = [
  "troca_oleo",
  "amortecedor",
  "revisao",
  "outro",
];

export function isTipoServicoKey(value: unknown): value is TipoServicoKey {
  return typeof value === "string" && TIPO_SERVICO_KEYS.includes(value as TipoServicoKey);
}

export function validateTipoServicoUpdate(
  input: TipoServicoUpdate,
): TipoServicoValidationError | null {
  if (input.label !== undefined) {
    if (typeof input.label !== "string" || input.label.trim().length === 0) {
      return { field: "label", message: "Label obrigatorio." };
    }
    if (input.label.length > 60) {
      return { field: "label", message: "Label muito longo (max 60)." };
    }
  }
  if (input.dias_lembrete !== undefined) {
    if (
      typeof input.dias_lembrete !== "number" ||
      !Number.isInteger(input.dias_lembrete) ||
      input.dias_lembrete <= 0 ||
      input.dias_lembrete > 3650
    ) {
      return {
        field: "dias_lembrete",
        message: "Dias deve ser inteiro entre 1 e 3650.",
      };
    }
  }
  if (input.template_name !== undefined) {
    if (typeof input.template_name !== "string" || !/^[a-z0-9_]{1,64}$/.test(input.template_name)) {
      return {
        field: "template_name",
        message: "Template_name deve usar [a-z0-9_], max 64.",
      };
    }
  }
  if (input.template_language !== undefined) {
    if (
      typeof input.template_language !== "string" ||
      !/^[a-z]{2}(_[A-Z]{2})?$/.test(input.template_language)
    ) {
      return {
        field: "template_language",
        message: "Idioma invalido (ex: pt_BR, en).",
      };
    }
  }
  return null;
}

export async function listTiposServico(
  supabase: SupabaseClient,
): Promise<TipoServicoDefault[]> {
  const { data, error } = await supabase
    .from("tipos_servico_default")
    .select("tipo_servico, label, dias_lembrete, template_name, template_language, ativo, updated_at")
    .order("tipo_servico", { ascending: true });
  if (error) throw new Error(`list_tipos_servico_failed: ${error.message}`);
  return (data ?? []) as TipoServicoDefault[];
}

export async function getTipoServico(
  supabase: SupabaseClient,
  tipo: TipoServicoKey,
): Promise<TipoServicoDefault | null> {
  const { data, error } = await supabase
    .from("tipos_servico_default")
    .select("tipo_servico, label, dias_lembrete, template_name, template_language, ativo, updated_at")
    .eq("tipo_servico", tipo)
    .maybeSingle();
  if (error) throw new Error(`get_tipo_servico_failed: ${error.message}`);
  return (data as TipoServicoDefault | null) ?? null;
}

export async function updateTipoServico(
  supabase: SupabaseClient,
  tipo: TipoServicoKey,
  input: TipoServicoUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<TipoServicoDefault> {
  const validation = validateTipoServicoUpdate(input);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  const before = await getTipoServico(supabase, tipo);
  if (!before) {
    const err = new Error("tipo_servico_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.dias_lembrete !== undefined) patch.dias_lembrete = input.dias_lembrete;
  if (input.template_name !== undefined) patch.template_name = input.template_name.trim();
  if (input.template_language !== undefined) patch.template_language = input.template_language;
  if (input.ativo !== undefined) patch.ativo = input.ativo;

  return withAdminAudit(
    supabase,
    (after: TipoServicoDefault) => ({
      adminId: ctx.adminId,
      acao: "tipo_servico.update",
      entidade: "tipos_servico_default",
      entidadeId: tipo,
      ip: ctx.ip,
      payload: { before, after },
    }),
    async () => {
      const { data, error } = await supabase
        .from("tipos_servico_default")
        .update(patch)
        .eq("tipo_servico", tipo)
        .select(
          "tipo_servico, label, dias_lembrete, template_name, template_language, ativo, updated_at",
        )
        .single();
      if (error) throw new Error(`update_tipo_servico_failed: ${error.message}`);
      return data as TipoServicoDefault;
    },
  );
}
