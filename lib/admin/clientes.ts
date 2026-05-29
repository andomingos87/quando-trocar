import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { maskName, maskWhatsapp, truncateMessage } from "./pii";
import { normalizePhoneToE164 } from "./phone";

// ADR-0001: opt-out via admin e iniciativa humana, nao decisao do LLM.

export type ClienteFinalStatus = "ativo" | "opt_out" | "numero_errado";

export type ClienteListRow = {
  id: string;
  oficina_id: string | null;
  oficina_nome: string | null;
  nome: string | null;
  nome_mascarado: string;
  whatsapp_mascarado: string;
  status: ClienteFinalStatus;
  consentimento_whatsapp: boolean | null;
  origem_consentimento: string | null;
  opt_out_at: string | null;
  created_at: string;
};

export type ClienteListFilters = {
  status?: ClienteFinalStatus | "todas";
  oficina_id?: string;
  busca?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

export type ClienteListResult = {
  rows: ClienteListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClienteDetail = ClienteListRow & {
  nome: string | null;
  whatsapp: string;
  data_consentimento: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type ClienteVeiculo = {
  id: string;
  descricao: string | null;
  placa: string | null;
  created_at: string;
};

export type ClienteLembrete = {
  id: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  servico_tipo: string | null;
  veiculo_descricao: string | null;
};

export type ClienteMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body_truncado: string;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 50;

const ACTIVE_LEMBRETE_STATUSES = [
  "pendente",
  "enfileirado",
  "agendado",
] as const;

export async function listClientesFinais(
  supabase: SupabaseClient,
  filters: ClienteListFilters = {},
): Promise<ClienteListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clientes_finais")
    .select(
      `id, oficina_id, nome, whatsapp, status, consentimento_whatsapp, origem_consentimento,
       opt_out_at, created_at,
       oficinas:oficina_id (nome)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!filters.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (filters.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);

  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim();
    const phone = normalizePhoneToE164(term);
    if (phone.ok) {
      query = query.eq("whatsapp", phone.e164);
    } else {
      const safe = term.replace(/[%,]/g, "");
      query = query.ilike("nome", `%${safe}%`);
    }
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`list_clientes_failed: ${error.message}`);

  const rows: ClienteListRow[] = (data ?? []).map((c) => {
    const oficinaRaw = c.oficinas as { nome: string } | { nome: string }[] | null;
    const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;
    return {
      id: c.id as string,
      oficina_id: (c.oficina_id ?? null) as string | null,
      oficina_nome: oficina?.nome ?? null,
      nome: (c.nome ?? null) as string | null,
      nome_mascarado: maskName(c.nome as string | null),
      whatsapp_mascarado: maskWhatsapp(c.whatsapp as string),
      status: c.status as ClienteFinalStatus,
      consentimento_whatsapp: (c.consentimento_whatsapp ?? null) as boolean | null,
      origem_consentimento: (c.origem_consentimento ?? null) as string | null,
      opt_out_at: (c.opt_out_at ?? null) as string | null,
      created_at: c.created_at as string,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export async function getClienteById(
  supabase: SupabaseClient,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ClienteDetail | null> {
  let query = supabase
    .from("clientes_finais")
    .select(
      `id, oficina_id, nome, whatsapp, status, consentimento_whatsapp, origem_consentimento,
       data_consentimento, opt_out_at, created_at, updated_at, deleted_at,
       oficinas:oficina_id (nome)`,
    )
    .eq("id", id);
  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`get_cliente_failed: ${error.message}`);
  if (!data) return null;

  const oficinaRaw = data.oficinas as { nome: string } | { nome: string }[] | null;
  const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;

  return {
    id: data.id as string,
    oficina_id: (data.oficina_id ?? null) as string | null,
    oficina_nome: oficina?.nome ?? null,
    nome: (data.nome ?? null) as string | null,
    whatsapp: data.whatsapp as string,
    nome_mascarado: maskName(data.nome as string | null),
    whatsapp_mascarado: maskWhatsapp(data.whatsapp as string),
    status: data.status as ClienteFinalStatus,
    consentimento_whatsapp: (data.consentimento_whatsapp ?? null) as boolean | null,
    origem_consentimento: (data.origem_consentimento ?? null) as string | null,
    data_consentimento: (data.data_consentimento ?? null) as string | null,
    opt_out_at: (data.opt_out_at ?? null) as string | null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    deleted_at: (data.deleted_at ?? null) as string | null,
  };
}

export async function getClienteVeiculos(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<ClienteVeiculo[]> {
  const { data, error } = await supabase
    .from("veiculos")
    .select("id, descricao, placa, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`get_cliente_veiculos_failed: ${error.message}`);
  return (data ?? []) as ClienteVeiculo[];
}

export async function getClienteLembretes(
  supabase: SupabaseClient,
  clienteId: string,
  limit = 20,
): Promise<ClienteLembrete[]> {
  const { data, error } = await supabase
    .from("lembretes")
    .select(
      `id, status, scheduled_at, sent_at,
       servicos:servico_id (tipo),
       veiculos:veiculo_id (descricao, placa)`,
    )
    .eq("cliente_id", clienteId)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`get_cliente_lembretes_failed: ${error.message}`);
  return (data ?? []).map((l) => {
    const servicoRaw = l.servicos as { tipo: string } | { tipo: string }[] | null;
    const servico = Array.isArray(servicoRaw) ? servicoRaw[0] ?? null : servicoRaw;
    const veiculoRaw = l.veiculos as
      | { descricao: string; placa: string }
      | { descricao: string; placa: string }[]
      | null;
    const veiculo = Array.isArray(veiculoRaw) ? veiculoRaw[0] ?? null : veiculoRaw;
    return {
      id: l.id as string,
      status: l.status as string,
      scheduled_at: (l.scheduled_at ?? null) as string | null,
      sent_at: (l.sent_at ?? null) as string | null,
      servico_tipo: servico?.tipo ?? null,
      veiculo_descricao: veiculo?.descricao ?? veiculo?.placa ?? null,
    };
  });
}

export async function getClienteMessages(
  supabase: SupabaseClient,
  clienteId: string,
  limit = 20,
): Promise<ClienteMessage[]> {
  const { data, error } = await supabase
    .from("mensagens")
    .select("id, direction, body, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_cliente_messages_failed: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id as string,
    direction: m.direction as "inbound" | "outbound",
    body_truncado: truncateMessage((m.body as string | null) ?? "", 120),
    created_at: m.created_at as string,
  }));
}

// ----------------------------------------------------------------------------
// Mutacoes
// ----------------------------------------------------------------------------

export type MarcarClienteOptOutInput = {
  motivo: string;
};

export function validateMarcarClienteOptOut(
  input: Partial<MarcarClienteOptOutInput>,
):
  | { ok: true; data: MarcarClienteOptOutInput }
  | { ok: false; field: "motivo"; message: string } {
  if (!input.motivo || typeof input.motivo !== "string") {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  const motivo = input.motivo.trim();
  if (motivo.length === 0) {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  if (motivo.length > 500) {
    return { ok: false, field: "motivo", message: "Motivo muito longo (max 500 chars)." };
  }
  return { ok: true, data: { motivo } };
}

export async function marcarClienteOptOut(
  supabase: SupabaseClient,
  id: string,
  input: MarcarClienteOptOutInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status !== "ativo") {
    const err = new Error(
      `Cliente com status "${before.status}" ja saiu de "ativo"; nao ha mudanca a fazer.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_finais")
    .update({
      status: "opt_out",
      opt_out_at: nowIso,
      consentimento_whatsapp: false,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (error) throw new Error(`marcar_cliente_opt_out_failed: ${error.message}`);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("marcar_cliente_opt_out_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.marcar_opt_out",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      motivo: input.motivo,
      before: { status: before.status, consentimento: before.consentimento_whatsapp },
      after: { status: after.status, opt_out_at: after.opt_out_at },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

// ----------------------------------------------------------------------------
// Reativar opt-out (C1)
// ----------------------------------------------------------------------------

export type ClienteReactivateInput = { origem_consentimento: string };

export function validateReactivateCliente(
  input: Partial<ClienteReactivateInput>,
):
  | { ok: true; data: ClienteReactivateInput }
  | { ok: false; field: "origem_consentimento"; message: string } {
  if (
    !input.origem_consentimento ||
    typeof input.origem_consentimento !== "string"
  ) {
    return {
      ok: false,
      field: "origem_consentimento",
      message: "Origem do consentimento obrigatoria.",
    };
  }
  const origem = input.origem_consentimento.trim();
  if (origem.length === 0) {
    return {
      ok: false,
      field: "origem_consentimento",
      message: "Origem do consentimento obrigatoria.",
    };
  }
  if (origem.length > 200) {
    return {
      ok: false,
      field: "origem_consentimento",
      message: "Texto muito longo (max 200 chars).",
    };
  }
  return { ok: true, data: { origem_consentimento: origem } };
}

export async function reactivateCliente(
  supabase: SupabaseClient,
  id: string,
  input: ClienteReactivateInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status !== "opt_out") {
    const err = new Error(
      `Cliente com status "${before.status}" nao precisa de reativacao de opt-out.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_finais")
    .update({
      status: "ativo",
      opt_out_at: null,
      consentimento_whatsapp: true,
      origem_consentimento: input.origem_consentimento,
      data_consentimento: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (error) throw new Error(`reactivate_cliente_failed: ${error.message}`);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("reactivate_cliente_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.reactivate",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      origem_consentimento: input.origem_consentimento,
      before: { status: before.status, opt_out_at: before.opt_out_at },
      after: { status: after.status, data_consentimento: after.data_consentimento },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

// ----------------------------------------------------------------------------
// Marcar numero errado (C2) / corrigir (C3)
// ----------------------------------------------------------------------------

export type ClienteMarcarNumeroErradoInput = { motivo: string };

export function validateMarcarNumeroErrado(
  input: Partial<ClienteMarcarNumeroErradoInput>,
):
  | { ok: true; data: ClienteMarcarNumeroErradoInput }
  | { ok: false; field: "motivo"; message: string } {
  if (!input.motivo || typeof input.motivo !== "string") {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  const motivo = input.motivo.trim();
  if (motivo.length === 0) {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  if (motivo.length > 500) {
    return { ok: false, field: "motivo", message: "Motivo muito longo (max 500 chars)." };
  }
  return { ok: true, data: { motivo } };
}

export async function marcarNumeroErrado(
  supabase: SupabaseClient,
  id: string,
  input: ClienteMarcarNumeroErradoInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status !== "ativo") {
    const err = new Error(
      `Cliente em status "${before.status}" nao pode ser marcado como numero errado.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_finais")
    .update({
      status: "numero_errado",
      updated_at: nowIso,
    })
    .eq("id", id);
  if (error) throw new Error(`marcar_numero_errado_failed: ${error.message}`);

  const cancelados = await cancelLembretesPendentes(supabase, id);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("marcar_numero_errado_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.marcar_numero_errado",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      motivo: input.motivo,
      lembretes_cancelados: cancelados,
      before: { status: before.status },
      after: { status: after.status },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

export type ClienteMarcarNumeroCorretoInput = Record<string, never>;

export function validateMarcarNumeroCorreto(): {
  ok: true;
  data: ClienteMarcarNumeroCorretoInput;
} {
  return { ok: true, data: {} };
}

export async function marcarNumeroCorreto(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status !== "numero_errado") {
    const err = new Error(
      `Cliente em status "${before.status}" nao precisa ser marcado como numero correto.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_finais")
    .update({ status: "ativo", updated_at: nowIso })
    .eq("id", id);
  if (error) throw new Error(`marcar_numero_correto_failed: ${error.message}`);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("marcar_numero_correto_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.marcar_numero_correto",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      before: { status: before.status },
      after: { status: after.status },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

// ----------------------------------------------------------------------------
// Editar nome (C4)
// ----------------------------------------------------------------------------

export type ClienteUpdateInput = { nome: string | null };

export function validateUpdateCliente(
  input: Partial<ClienteUpdateInput>,
):
  | { ok: true; data: ClienteUpdateInput }
  | { ok: false; field: "nome"; message: string } {
  if (input.nome === undefined) {
    return { ok: false, field: "nome", message: "Nenhum campo para atualizar." };
  }
  if (input.nome === null) {
    return { ok: true, data: { nome: null } };
  }
  if (typeof input.nome !== "string") {
    return { ok: false, field: "nome", message: "Nome deve ser texto." };
  }
  const trimmed = input.nome.trim();
  if (trimmed.length > 200) {
    return { ok: false, field: "nome", message: "Nome muito longo (max 200)." };
  }
  return { ok: true, data: { nome: trimmed.length === 0 ? null : trimmed } };
}

export async function updateCliente(
  supabase: SupabaseClient,
  id: string,
  input: ClienteUpdateInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const { error } = await supabase
    .from("clientes_finais")
    .update({ nome: input.nome, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`update_cliente_failed: ${error.message}`);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("update_cliente_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.update",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      before: { nome: before.nome },
      after: { nome: after.nome },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

// ----------------------------------------------------------------------------
// Trocar WhatsApp (C4-whatsapp)
// ----------------------------------------------------------------------------

export type ClienteChangeWhatsappInput = {
  whatsapp: string;
  confirmacao_whatsapp: string;
};

export function validateChangeClienteWhatsapp(
  input: Partial<ClienteChangeWhatsappInput>,
):
  | { ok: true; data: { whatsapp: string } }
  | { ok: false; field: "whatsapp" | "confirmacao_whatsapp"; message: string } {
  if (!input.whatsapp || typeof input.whatsapp !== "string") {
    return { ok: false, field: "whatsapp", message: "WhatsApp obrigatorio." };
  }
  if (
    !input.confirmacao_whatsapp ||
    typeof input.confirmacao_whatsapp !== "string"
  ) {
    return {
      ok: false,
      field: "confirmacao_whatsapp",
      message: "Confirmacao obrigatoria.",
    };
  }
  const phone = normalizePhoneToE164(input.whatsapp);
  if (!phone.ok) {
    return { ok: false, field: "whatsapp", message: "WhatsApp invalido." };
  }
  const confirm = normalizePhoneToE164(input.confirmacao_whatsapp);
  if (!confirm.ok || confirm.e164 !== phone.e164) {
    return {
      ok: false,
      field: "confirmacao_whatsapp",
      message: "Confirmacao nao confere com o novo numero.",
    };
  }
  return { ok: true, data: { whatsapp: phone.e164 } };
}

export async function changeClienteWhatsapp(
  supabase: SupabaseClient,
  id: string,
  input: { whatsapp: string },
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; cliente: ClienteDetail }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.whatsapp === input.whatsapp) {
    return { ok: true, cliente: before };
  }
  if (!before.oficina_id) {
    const err = new Error("cliente_sem_oficina");
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { data: existing, error: existingErr } = await supabase
    .from("clientes_finais")
    .select("id")
    .eq("oficina_id", before.oficina_id)
    .eq("whatsapp", input.whatsapp)
    .is("deleted_at", null)
    .neq("id", id)
    .limit(1);
  if (existingErr) {
    throw new Error(`change_cliente_whatsapp_check_failed: ${existingErr.message}`);
  }
  if (existing && existing.length > 0) {
    const err = new Error("Ja existe outro cliente com esse WhatsApp nesta oficina.");
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { error } = await supabase
    .from("clientes_finais")
    .update({ whatsapp: input.whatsapp, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`change_cliente_whatsapp_failed: ${error.message}`);

  const after = await getClienteById(supabase, id);
  if (!after) throw new Error("change_cliente_whatsapp_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.change_whatsapp",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      before: { whatsapp: before.whatsapp },
      after: { whatsapp: after.whatsapp },
    },
    ip: ctx.ip,
  });

  return { ok: true, cliente: after };
}

// ----------------------------------------------------------------------------
// Soft delete (C5)
// ----------------------------------------------------------------------------

export type ClienteSoftDeleteInput = { motivo: string };

export function validateSoftDeleteCliente(
  input: Partial<ClienteSoftDeleteInput>,
):
  | { ok: true; data: ClienteSoftDeleteInput }
  | { ok: false; field: "motivo"; message: string } {
  if (!input.motivo || typeof input.motivo !== "string") {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  const motivo = input.motivo.trim();
  if (motivo.length === 0) {
    return { ok: false, field: "motivo", message: "Motivo obrigatorio." };
  }
  if (motivo.length > 500) {
    return { ok: false, field: "motivo", message: "Motivo muito longo (max 500 chars)." };
  }
  return { ok: true, data: { motivo } };
}

export async function softDeleteCliente(
  supabase: SupabaseClient,
  id: string,
  input: ClienteSoftDeleteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; id: string }> {
  const before = await getClienteById(supabase, id);
  if (!before) {
    const err = new Error("cliente_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_finais")
    .update({
      deleted_at: nowIso,
      deleted_by: ctx.adminId,
      deleted_reason: input.motivo,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (error) throw new Error(`soft_delete_cliente_failed: ${error.message}`);

  const cancelados = await cancelLembretesPendentes(supabase, id);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "cliente.soft_delete",
    entidade: "clientes_finais",
    entidade_id: id,
    payload: {
      motivo: input.motivo,
      lembretes_cancelados: cancelados,
      before: { status: before.status, whatsapp: before.whatsapp },
    },
    ip: ctx.ip,
  });

  return { ok: true, id };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function cancelLembretesPendentes(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("lembretes")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .in("status", ACTIVE_LEMBRETE_STATUSES as unknown as string[])
    .select("id");
  if (error) {
    throw new Error(`cancel_lembretes_failed: ${error.message}`);
  }
  return (data ?? []).length;
}
