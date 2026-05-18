import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

export type Plano = {
  id: string;
  nome: string;
  preco_base: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanoWithUsage = Plano & {
  oficinas_vinculadas: number;
};

export type PlanoInput = {
  nome: string;
  preco_base: number;
  descricao?: string | null;
  ativo?: boolean;
};

export type PlanoUpdate = Partial<PlanoInput>;

export type PlanoValidationError =
  | { field: "nome"; message: string }
  | { field: "preco_base"; message: string };

export function validatePlanoInput(
  input: Partial<PlanoInput>,
  { isPartial = false }: { isPartial?: boolean } = {},
): PlanoValidationError | null {
  if (!isPartial || input.nome !== undefined) {
    if (typeof input.nome !== "string" || input.nome.trim().length === 0) {
      return { field: "nome", message: "Nome obrigatorio." };
    }
    if (input.nome.length > 120) {
      return { field: "nome", message: "Nome muito longo (max 120)." };
    }
  }
  if (!isPartial || input.preco_base !== undefined) {
    if (
      typeof input.preco_base !== "number" ||
      Number.isNaN(input.preco_base) ||
      input.preco_base < 0
    ) {
      return {
        field: "preco_base",
        message: "Preco base deve ser numero >= 0.",
      };
    }
  }
  return null;
}

export async function listPlanos(
  supabase: SupabaseClient,
): Promise<PlanoWithUsage[]> {
  const { data: planos, error } = await supabase
    .from("planos")
    .select("id, nome, preco_base, descricao, ativo, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`list_planos_failed: ${error.message}`);
  if (!planos || planos.length === 0) return [];

  const planoIds = planos.map((p) => p.id);
  const { data: usage, error: usageError } = await supabase
    .from("oficinas")
    .select("plano_id, status")
    .in("plano_id", planoIds)
    .neq("status", "cancelada");

  if (usageError) {
    throw new Error(`list_planos_usage_failed: ${usageError.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of usage ?? []) {
    if (!row.plano_id) continue;
    counts.set(row.plano_id, (counts.get(row.plano_id) ?? 0) + 1);
  }

  return planos.map((p) => ({
    ...p,
    preco_base: Number(p.preco_base),
    oficinas_vinculadas: counts.get(p.id) ?? 0,
  }));
}

export async function countOficinasVinculadas(
  supabase: SupabaseClient,
  planoId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("oficinas")
    .select("id", { count: "exact", head: true })
    .eq("plano_id", planoId)
    .neq("status", "cancelada");
  if (error) {
    throw new Error(`count_oficinas_vinculadas_failed: ${error.message}`);
  }
  return count ?? 0;
}

// Contagem de oficinas que serao afetadas por uma mudanca em preco_base:
// somente oficinas vinculadas e SEM preco_negociado (estas usam preco_base).
export async function countOficinasAfetadasPorPrecoBase(
  supabase: SupabaseClient,
  planoId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("oficinas")
    .select("id", { count: "exact", head: true })
    .eq("plano_id", planoId)
    .neq("status", "cancelada")
    .is("preco_negociado", null);
  if (error) {
    throw new Error(
      `count_oficinas_afetadas_failed: ${error.message}`,
    );
  }
  return count ?? 0;
}

export async function getPlanoById(
  supabase: SupabaseClient,
  id: string,
): Promise<Plano | null> {
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome, preco_base, descricao, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get_plano_failed: ${error.message}`);
  if (!data) return null;
  return { ...data, preco_base: Number(data.preco_base) };
}

export async function createPlano(
  supabase: SupabaseClient,
  input: PlanoInput,
  ctx: { adminId: string; ip: string | null },
): Promise<Plano> {
  const validation = validatePlanoInput(input);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  return withAdminAudit(
    supabase,
    (result: Plano) => ({
      adminId: ctx.adminId,
      acao: "plano.create",
      entidade: "planos",
      entidadeId: result.id,
      ip: ctx.ip,
      payload: { ...result },
    }),
    async () => {
      const { data, error } = await supabase
        .from("planos")
        .insert({
          nome: input.nome.trim(),
          preco_base: input.preco_base,
          descricao: input.descricao ?? null,
          ativo: input.ativo ?? true,
        })
        .select("id, nome, preco_base, descricao, ativo, created_at, updated_at")
        .single();
      if (error) throw new Error(`create_plano_failed: ${error.message}`);
      return { ...data, preco_base: Number(data.preco_base) };
    },
  );
}

export async function updatePlano(
  supabase: SupabaseClient,
  id: string,
  input: PlanoUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<Plano> {
  const validation = validatePlanoInput(input, { isPartial: true });
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  const before = await getPlanoById(supabase, id);
  if (!before) {
    const err = new Error("plano_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.preco_base !== undefined) patch.preco_base = input.preco_base;
  if (input.descricao !== undefined) patch.descricao = input.descricao;
  if (input.ativo !== undefined) patch.ativo = input.ativo;

  return withAdminAudit(
    supabase,
    (after: Plano) => ({
      adminId: ctx.adminId,
      acao: "plano.update",
      entidade: "planos",
      entidadeId: id,
      ip: ctx.ip,
      payload: { before, after },
    }),
    async () => {
      const { data, error } = await supabase
        .from("planos")
        .update(patch)
        .eq("id", id)
        .select("id, nome, preco_base, descricao, ativo, created_at, updated_at")
        .single();
      if (error) throw new Error(`update_plano_failed: ${error.message}`);
      return { ...data, preco_base: Number(data.preco_base) };
    },
  );
}

export async function deactivatePlano(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ id: string; ativo: false; oficinasVinculadas: number }> {
  const before = await getPlanoById(supabase, id);
  if (!before) {
    const err = new Error("plano_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const vinculadas = await countOficinasVinculadas(supabase, id);
  if (vinculadas > 0) {
    const err = new Error(
      `Nao e possivel desativar: ${vinculadas} oficina(s) vinculada(s). Migre antes.`,
    );
    Object.assign(err, {
      status: 409,
      oficinasVinculadas: vinculadas,
    });
    throw err;
  }

  await withAdminAudit(
    supabase,
    {
      adminId: ctx.adminId,
      acao: "plano.deactivate",
      entidade: "planos",
      entidadeId: id,
      ip: ctx.ip,
      payload: { oficinas_vinculadas: vinculadas, before },
    },
    async () => {
      const { error } = await supabase
        .from("planos")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`deactivate_plano_failed: ${error.message}`);
    },
  );

  return { id, ativo: false, oficinasVinculadas: vinculadas };
}
