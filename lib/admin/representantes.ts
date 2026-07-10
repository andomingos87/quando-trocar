import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ComissaoTipo } from "./comissoes";
import { normalizePhoneToE164 } from "./phone";

// ADR-0019: cadastro de representantes comerciais. Mutacoes sao iniciadas por
// admin humano (ADR-0001) e auditadas em admin_audit_log.

const CODIGO_REGEX = /^[A-Z0-9][A-Z0-9-]{1,29}$/;

export type RepresentanteRow = {
  id: string;
  nome: string;
  whatsapp: string;
  codigo: string;
  ativo: boolean;
  comissao_tipo: ComissaoTipo | null;
  comissao_valor: number | null;
  comissao_duracao_meses: number | null;
  created_at: string;
  updated_at: string;
};

export type RepresentanteListRow = RepresentanteRow & {
  leads_count: number;
  oficinas_ativas_count: number;
  comissao_prevista: number;
  comissao_paga: number;
};

export type RepresentanteInput = {
  nome?: string;
  whatsapp?: string;
  codigo?: string;
  ativo?: boolean;
  comissao_tipo?: ComissaoTipo | null;
  comissao_valor?: number | null;
  comissao_duracao_meses?: number | null;
};

export type RepresentanteValidationError = {
  field: keyof RepresentanteInput;
  message: string;
};

export function validateRepresentanteInput(
  input: RepresentanteInput,
  { partial }: { partial: boolean },
):
  | { ok: true; data: RepresentanteInput }
  | { ok: false; error: RepresentanteValidationError } {
  const data: RepresentanteInput = {};

  if (input.nome !== undefined || !partial) {
    const nome = typeof input.nome === "string" ? input.nome.trim() : "";
    if (!nome) {
      return { ok: false, error: { field: "nome", message: "Nome obrigatorio." } };
    }
    data.nome = nome;
  }

  if (input.whatsapp !== undefined || !partial) {
    const normalized = normalizePhoneToE164(input.whatsapp ?? "");
    if (!normalized.ok) {
      return {
        ok: false,
        error: { field: "whatsapp", message: "WhatsApp invalido (use formato brasileiro ou E.164)." },
      };
    }
    data.whatsapp = normalized.e164;
  }

  if (input.codigo !== undefined || !partial) {
    const codigo = typeof input.codigo === "string" ? input.codigo.trim().toUpperCase() : "";
    if (!CODIGO_REGEX.test(codigo)) {
      return {
        ok: false,
        error: {
          field: "codigo",
          message: "Codigo deve ter 2-30 caracteres (letras, numeros e hifen; ex: CARLOS-SP).",
        },
      };
    }
    data.codigo = codigo;
  }

  if (input.ativo !== undefined) {
    if (typeof input.ativo !== "boolean") {
      return { ok: false, error: { field: "ativo", message: "Ativo deve ser booleano." } };
    }
    data.ativo = input.ativo;
  }

  // Override de comissao: tipo+valor andam juntos (regras §18.4).
  const tipoDefinido = input.comissao_tipo !== undefined;
  const valorDefinido = input.comissao_valor !== undefined;
  if (tipoDefinido || valorDefinido) {
    const tipo = input.comissao_tipo ?? null;
    const valor = input.comissao_valor ?? null;
    if ((tipo === null) !== (valor === null)) {
      return {
        ok: false,
        error: {
          field: "comissao_tipo",
          message: "Override de comissao exige tipo e valor juntos (ou nenhum).",
        },
      };
    }
    if (tipo !== null && tipo !== "percentual" && tipo !== "fixo") {
      return {
        ok: false,
        error: { field: "comissao_tipo", message: "Tipo deve ser 'percentual' ou 'fixo'." },
      };
    }
    if (valor !== null && (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0)) {
      return {
        ok: false,
        error: { field: "comissao_valor", message: "Valor deve ser numero >= 0." },
      };
    }
    data.comissao_tipo = tipo;
    data.comissao_valor = valor;
  }

  if (input.comissao_duracao_meses !== undefined) {
    const d = input.comissao_duracao_meses;
    if (d !== null && (typeof d !== "number" || !Number.isInteger(d) || d < 1)) {
      return {
        ok: false,
        error: {
          field: "comissao_duracao_meses",
          message: "Duracao deve ser inteiro >= 1 (ou vazio para herdar a global).",
        },
      };
    }
    data.comissao_duracao_meses = d;
  }

  return { ok: true, data };
}

function mapRepresentante(r: Record<string, unknown>): RepresentanteRow {
  return {
    id: r.id as string,
    nome: r.nome as string,
    whatsapp: r.whatsapp as string,
    codigo: r.codigo as string,
    ativo: r.ativo as boolean,
    comissao_tipo: (r.comissao_tipo as ComissaoTipo | null) ?? null,
    comissao_valor: r.comissao_valor === null ? null : Number(r.comissao_valor),
    comissao_duracao_meses: r.comissao_duracao_meses as number | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

const REPRESENTANTE_COLUMNS =
  "id, nome, whatsapp, codigo, ativo, comissao_tipo, comissao_valor, comissao_duracao_meses, created_at, updated_at";

export async function listRepresentantes(
  supabase: SupabaseClient,
): Promise<RepresentanteListRow[]> {
  const { data, error } = await supabase
    .from("representantes")
    .select(REPRESENTANTE_COLUMNS)
    .is("deleted_at", null)
    .order("nome", { ascending: true });
  if (error) throw new Error(`list_representantes_failed: ${error.message}`);

  const rows = (data ?? []).map(mapRepresentante);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [leadsRes, oficinasRes, comissoesRes] = await Promise.all([
    supabase.from("leads_oficina").select("representante_id").in("representante_id", ids),
    supabase
      .from("oficinas")
      .select("representante_id, status")
      .in("representante_id", ids)
      .is("deleted_at", null),
    supabase
      .from("comissoes")
      .select("representante_id, valor, status")
      .in("representante_id", ids),
  ]);
  if (leadsRes.error) throw new Error(`list_representantes_leads_failed: ${leadsRes.error.message}`);
  if (oficinasRes.error) {
    throw new Error(`list_representantes_oficinas_failed: ${oficinasRes.error.message}`);
  }
  if (comissoesRes.error) {
    throw new Error(`list_representantes_comissoes_failed: ${comissoesRes.error.message}`);
  }

  const leadsCount = new Map<string, number>();
  for (const l of leadsRes.data ?? []) {
    if (!l.representante_id) continue;
    leadsCount.set(l.representante_id, (leadsCount.get(l.representante_id) ?? 0) + 1);
  }
  const oficinasCount = new Map<string, number>();
  for (const o of oficinasRes.data ?? []) {
    if (!o.representante_id || o.status !== "ativa") continue;
    oficinasCount.set(o.representante_id, (oficinasCount.get(o.representante_id) ?? 0) + 1);
  }
  const prevista = new Map<string, number>();
  const paga = new Map<string, number>();
  for (const c of comissoesRes.data ?? []) {
    if (c.status === "prevista") {
      prevista.set(c.representante_id, (prevista.get(c.representante_id) ?? 0) + Number(c.valor));
    }
    if (c.status === "paga") {
      paga.set(c.representante_id, (paga.get(c.representante_id) ?? 0) + Number(c.valor));
    }
  }

  return rows.map((r) => ({
    ...r,
    leads_count: leadsCount.get(r.id) ?? 0,
    oficinas_ativas_count: oficinasCount.get(r.id) ?? 0,
    comissao_prevista: Math.round((prevista.get(r.id) ?? 0) * 100) / 100,
    comissao_paga: Math.round((paga.get(r.id) ?? 0) * 100) / 100,
  }));
}

export async function getRepresentanteById(
  supabase: SupabaseClient,
  id: string,
): Promise<RepresentanteRow | null> {
  const { data, error } = await supabase
    .from("representantes")
    .select(REPRESENTANTE_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`get_representante_failed: ${error.message}`);
  return data ? mapRepresentante(data) : null;
}

async function assertCodigoDisponivel(
  supabase: SupabaseClient,
  codigo: string,
  ignoreId?: string,
): Promise<void> {
  let query = supabase
    .from("representantes")
    .select("id")
    .ilike("codigo", codigo)
    .is("deleted_at", null);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`codigo_check_failed: ${error.message}`);
  if (data) {
    const err = new Error("Codigo ja esta em uso por outro representante.");
    Object.assign(err, { status: 409 });
    throw err;
  }
}

export async function createRepresentante(
  supabase: SupabaseClient,
  input: RepresentanteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<RepresentanteRow> {
  const validation = validateRepresentanteInput(input, { partial: false });
  if (!validation.ok) {
    const err = new Error(validation.error.message);
    Object.assign(err, { status: 400, validation: validation.error });
    throw err;
  }
  const data = validation.data;
  await assertCodigoDisponivel(supabase, data.codigo!);

  const { data: created, error } = await supabase
    .from("representantes")
    .insert({
      nome: data.nome,
      whatsapp: data.whatsapp,
      codigo: data.codigo,
      ativo: data.ativo ?? true,
      comissao_tipo: data.comissao_tipo ?? null,
      comissao_valor: data.comissao_valor ?? null,
      comissao_duracao_meses: data.comissao_duracao_meses ?? null,
    })
    .select(REPRESENTANTE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      const err = new Error("WhatsApp ou codigo ja em uso por outro representante.");
      Object.assign(err, { status: 409 });
      throw err;
    }
    throw new Error(`create_representante_failed: ${error.message}`);
  }

  const row = mapRepresentante(created);
  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "representante.create",
    entidade: "representantes",
    entidade_id: row.id,
    payload: { after: row },
    ip: ctx.ip,
  });
  return row;
}

export async function patchRepresentante(
  supabase: SupabaseClient,
  id: string,
  input: RepresentanteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<RepresentanteRow> {
  const before = await getRepresentanteById(supabase, id);
  if (!before) {
    const err = new Error("representante_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const validation = validateRepresentanteInput(input, { partial: true });
  if (!validation.ok) {
    const err = new Error(validation.error.message);
    Object.assign(err, { status: 400, validation: validation.error });
    throw err;
  }
  const data = validation.data;
  if (data.codigo && data.codigo !== before.codigo) {
    await assertCodigoDisponivel(supabase, data.codigo, id);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp;
  if (data.codigo !== undefined) patch.codigo = data.codigo;
  if (data.ativo !== undefined) patch.ativo = data.ativo;
  if (data.comissao_tipo !== undefined) patch.comissao_tipo = data.comissao_tipo;
  if (data.comissao_valor !== undefined) patch.comissao_valor = data.comissao_valor;
  if (data.comissao_duracao_meses !== undefined) {
    patch.comissao_duracao_meses = data.comissao_duracao_meses;
  }

  const { data: updated, error } = await supabase
    .from("representantes")
    .update(patch)
    .eq("id", id)
    .select(REPRESENTANTE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      const err = new Error("WhatsApp ou codigo ja em uso por outro representante.");
      Object.assign(err, { status: 409 });
      throw err;
    }
    throw new Error(`patch_representante_failed: ${error.message}`);
  }

  const row = mapRepresentante(updated);
  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "representante.update",
    entidade: "representantes",
    entidade_id: id,
    payload: { before, after: row },
    ip: ctx.ip,
  });
  return row;
}

export async function softDeleteRepresentante(
  supabase: SupabaseClient,
  id: string,
  input: { confirmNome: string },
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true }> {
  const before = await getRepresentanteById(supabase, id);
  if (!before) {
    const err = new Error("representante_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (input.confirmNome?.trim() !== before.nome) {
    const err = new Error("Nome de confirmacao nao confere.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  // Regras §18.1: representante com comissoes registradas nao pode ser
  // excluido — preserva a trilha financeira. So desativar.
  const { count } = await supabase
    .from("comissoes")
    .select("id", { count: "exact", head: true })
    .eq("representante_id", id);
  if ((count ?? 0) > 0) {
    const err = new Error(
      "Representante com comissoes registradas nao pode ser excluido. Desative-o.",
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("representantes")
    .update({ deleted_at: nowIso, deleted_by: ctx.adminId, updated_at: nowIso })
    .eq("id", id);
  if (error) throw new Error(`soft_delete_representante_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "representante.soft_delete",
    entidade: "representantes",
    entidade_id: id,
    payload: { before: { nome: before.nome, codigo: before.codigo } },
    ip: ctx.ip,
  });

  return { ok: true };
}
