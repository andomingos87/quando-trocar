import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePhoneToE164 } from "./phone";

// ADR-0001: estas transicoes sao iniciadas por admin humano, nao por LLM.
// Toda mutacao grava em admin_audit_log com adminId do invocador.

export type LeadStatus =
  | "novo"
  | "em_conversa"
  | "qualificado"
  | "interessado"
  | "teste_aceito"
  | "convertido"
  | "perdido";

export type LeadOrigem = "landing_page" | "manual_whatsapp";

export type LeadListRow = {
  id: string;
  whatsapp: string;
  nome: string | null;
  nome_responsavel: string | null;
  nome_oficina: string | null;
  cidade: string | null;
  status: LeadStatus;
  origem: LeadOrigem;
  oficina_id: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type LeadListFilters = {
  status?: LeadStatus | "todas";
  origem?: LeadOrigem;
  oficina_id?: string;
  busca?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

export type LeadListResult = {
  rows: LeadListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type LeadDetail = LeadListRow & {
  volume_trocas_mes: number | null;
  ticket_medio: number | null;
  principal_dor: string | null;
  melhor_horario_contato: string | null;
  motivo_perda: string | null;
  interesse_declarado_at: string | null;
  converted_at: string | null;
  metadata: Record<string, unknown> | null;
  deleted_at: string | null;
};

export type LeadConversa = {
  id: string;
  agent_mode: string;
  participant_type: string;
  handoff_required: boolean;
  handoff_reason: string | null;
  last_message_at: string | null;
};

export type LeadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
  provider_status: string | null;
  provider_error_message: string | null;
};

export type LeadToolCallPreview = {
  id: string;
  tool_name: string;
  created_at: string;
  is_error: boolean;
};

const DEFAULT_PAGE_SIZE = 50;

export async function listLeads(
  supabase: SupabaseClient,
  filters: LeadListFilters = {},
): Promise<LeadListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads_oficina")
    .select(
      `id, whatsapp, nome, nome_responsavel, nome_oficina, cidade, status, origem, oficina_id, last_message_at, created_at`,
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
  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);

  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim();
    // Tenta normalizar como WhatsApp; se valido, busca por igualdade. Senao,
    // ilike em nome/nome_responsavel/nome_oficina/cidade.
    const phone = normalizePhoneToE164(term);
    if (phone.ok) {
      query = query.eq("whatsapp", phone.e164);
    } else {
      const safe = term.replace(/[%,]/g, "");
      query = query.or(
        `nome.ilike.%${safe}%,nome_responsavel.ilike.%${safe}%,nome_oficina.ilike.%${safe}%,cidade.ilike.%${safe}%`,
      );
    }
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`list_leads_failed: ${error.message}`);

  return {
    rows: (data ?? []) as LeadListRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getLeadById(
  supabase: SupabaseClient,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<LeadDetail | null> {
  let query = supabase
    .from("leads_oficina")
    .select(
      `id, whatsapp, nome, nome_responsavel, nome_oficina, cidade, status, origem, oficina_id,
       last_message_at, created_at, volume_trocas_mes, ticket_medio, principal_dor,
       melhor_horario_contato, motivo_perda, interesse_declarado_at, converted_at, metadata, deleted_at`,
    )
    .eq("id", id);
  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`get_lead_failed: ${error.message}`);
  if (!data) return null;
  return data as LeadDetail;
}

export async function getLeadConversa(
  supabase: SupabaseClient,
  leadId: string,
): Promise<LeadConversa | null> {
  const { data, error } = await supabase
    .from("conversas")
    .select(
      "id, agent_mode, participant_type, handoff_required, handoff_reason, last_message_at",
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_lead_conversa_failed: ${error.message}`);
  return (data as LeadConversa | null) ?? null;
}

export async function getLeadMessages(
  supabase: SupabaseClient,
  leadId: string,
  limit = 500,
): Promise<LeadMessage[]> {
  const { data, error } = await supabase
    .from("mensagens")
    .select(
      "id, direction, body, created_at, provider_status, provider_error_message",
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`get_lead_messages_failed: ${error.message}`);
  return (data ?? []) as LeadMessage[];
}

export async function getLeadToolCalls(
  supabase: SupabaseClient,
  leadId: string,
  limit = 50,
): Promise<LeadToolCallPreview[]> {
  const { data, error } = await supabase
    .from("agent_tool_calls")
    .select("id, tool_name, created_at, output")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_lead_tool_calls_failed: ${error.message}`);
  return (data ?? []).map((t) => {
    const output = (t.output ?? null) as Record<string, unknown> | null;
    const isError = !!(output && (output.ok === false || "error" in output));
    return {
      id: t.id as string,
      tool_name: t.tool_name as string,
      created_at: t.created_at as string,
      is_error: isError,
    };
  });
}

// ----------------------------------------------------------------------------
// Mutacoes
// ----------------------------------------------------------------------------

// Status que ja sao terminais ou desencadeiam fluxos diferentes: nao podem ser
// revertidos para "perdido" por esta tela.
const TERMINAL_LEAD_STATUSES = new Set<LeadStatus>(["convertido", "perdido"]);

// Status que o admin pode setar diretamente via "change_status". Exclui
// terminais (que tem rotas dedicadas: marcar_perdido, convert_manual, reopen).
const ADMIN_SETTABLE_LEAD_STATUSES = new Set<LeadStatus>([
  "novo",
  "em_conversa",
  "qualificado",
  "interessado",
  "teste_aceito",
]);

export type MarcarLeadPerdidoInput = {
  motivo_perda: string;
};

export async function marcarLeadPerdido(
  supabase: SupabaseClient,
  id: string,
  input: MarcarLeadPerdidoInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail }> {
  const motivo = (input.motivo_perda ?? "").trim();
  if (motivo.length === 0) {
    const err = new Error("Motivo da perda obrigatorio.");
    Object.assign(err, { status: 400 });
    throw err;
  }
  if (motivo.length > 500) {
    const err = new Error("Motivo muito longo (max 500 chars).");
    Object.assign(err, { status: 400 });
    throw err;
  }

  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (TERMINAL_LEAD_STATUSES.has(before.status)) {
    const err = new Error(
      `Lead ja esta em status terminal (${before.status}); nao pode ser marcado como perdido.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { error } = await supabase
    .from("leads_oficina")
    .update({
      status: "perdido",
      motivo_perda: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`marcar_lead_perdido_failed: ${error.message}`);

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("marcar_lead_perdido_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.marcar_perdido",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      before: { status: before.status, motivo_perda: before.motivo_perda },
      after: { status: after.status, motivo_perda: after.motivo_perda },
    },
    ip: ctx.ip,
  });

  return { ok: true, lead: after };
}

export function validateMarcarLeadPerdido(
  input: Partial<MarcarLeadPerdidoInput>,
): { ok: true; data: MarcarLeadPerdidoInput } | { ok: false; field: "motivo_perda"; message: string } {
  if (!input.motivo_perda || typeof input.motivo_perda !== "string") {
    return { ok: false, field: "motivo_perda", message: "Motivo da perda obrigatorio." };
  }
  const motivo = input.motivo_perda.trim();
  if (motivo.length === 0) {
    return { ok: false, field: "motivo_perda", message: "Motivo da perda obrigatorio." };
  }
  if (motivo.length > 500) {
    return { ok: false, field: "motivo_perda", message: "Motivo muito longo (max 500 chars)." };
  }
  return { ok: true, data: { motivo_perda: motivo } };
}

// ----------------------------------------------------------------------------
// Change status (L1) — apenas entre status nao terminais
// ----------------------------------------------------------------------------

export type LeadChangeStatusInput = { status: LeadStatus };

export function validateChangeLeadStatus(
  input: Partial<LeadChangeStatusInput>,
):
  | { ok: true; data: LeadChangeStatusInput }
  | { ok: false; field: "status"; message: string } {
  if (!input.status || typeof input.status !== "string") {
    return { ok: false, field: "status", message: "Status obrigatorio." };
  }
  if (!ADMIN_SETTABLE_LEAD_STATUSES.has(input.status as LeadStatus)) {
    return {
      ok: false,
      field: "status",
      message: `Status "${input.status}" nao pode ser definido por aqui. Use as acoes dedicadas (marcar perdido, converter, reabrir).`,
    };
  }
  return { ok: true, data: { status: input.status as LeadStatus } };
}

export async function changeLeadStatus(
  supabase: SupabaseClient,
  id: string,
  input: LeadChangeStatusInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (TERMINAL_LEAD_STATUSES.has(before.status)) {
    const err = new Error(
      `Lead em status terminal "${before.status}". Use "reabrir" antes de mudar de status.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }
  if (before.status === input.status) {
    return { ok: true, lead: before };
  }

  const { error } = await supabase
    .from("leads_oficina")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`change_lead_status_failed: ${error.message}`);

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("change_lead_status_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.change_status",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      before: { status: before.status },
      after: { status: after.status },
    },
    ip: ctx.ip,
  });

  return { ok: true, lead: after };
}

// ----------------------------------------------------------------------------
// Reabrir lead (L3) — apenas perdido -> em_conversa
// ----------------------------------------------------------------------------

export type LeadReopenInput = Record<string, never>;

export function validateReopenLead(): { ok: true; data: LeadReopenInput } {
  return { ok: true, data: {} };
}

export async function reopenLead(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status !== "perdido") {
    const err = new Error(
      `Lead com status "${before.status}" nao precisa ser reaberto.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { error } = await supabase
    .from("leads_oficina")
    .update({
      status: "em_conversa",
      motivo_perda: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`reopen_lead_failed: ${error.message}`);

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("reopen_lead_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.reopen",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      before: { status: before.status, motivo_perda: before.motivo_perda },
      after: { status: after.status },
    },
    ip: ctx.ip,
  });

  return { ok: true, lead: after };
}

// ----------------------------------------------------------------------------
// Editar dados qualificatorios do lead (L4)
// ----------------------------------------------------------------------------

const LEAD_EDITABLE_TEXT_FIELDS = [
  "nome",
  "nome_responsavel",
  "nome_oficina",
  "cidade",
  "principal_dor",
  "melhor_horario_contato",
] as const;

export type LeadUpdateInput = Partial<{
  nome: string | null;
  nome_responsavel: string | null;
  nome_oficina: string | null;
  cidade: string | null;
  principal_dor: string | null;
  melhor_horario_contato: string | null;
  volume_trocas_mes: number | null;
  ticket_medio: number | null;
}>;

export function validateUpdateLead(
  input: Partial<LeadUpdateInput>,
):
  | { ok: true; data: LeadUpdateInput }
  | { ok: false; field: string; message: string } {
  const out: LeadUpdateInput = {};
  for (const field of LEAD_EDITABLE_TEXT_FIELDS) {
    if (input[field] === undefined) continue;
    const raw = input[field];
    if (raw === null) {
      out[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return { ok: false, field, message: `${field} deve ser texto ou null.` };
    }
    const trimmed = raw.trim();
    if (trimmed.length > 500) {
      return { ok: false, field, message: `${field} muito longo (max 500).` };
    }
    out[field] = trimmed.length === 0 ? null : trimmed;
  }
  if (input.volume_trocas_mes !== undefined) {
    if (input.volume_trocas_mes === null) {
      out.volume_trocas_mes = null;
    } else if (
      typeof input.volume_trocas_mes !== "number" ||
      !Number.isFinite(input.volume_trocas_mes) ||
      input.volume_trocas_mes < 0 ||
      !Number.isInteger(input.volume_trocas_mes)
    ) {
      return {
        ok: false,
        field: "volume_trocas_mes",
        message: "Volume deve ser inteiro >= 0.",
      };
    } else {
      out.volume_trocas_mes = input.volume_trocas_mes;
    }
  }
  if (input.ticket_medio !== undefined) {
    if (input.ticket_medio === null) {
      out.ticket_medio = null;
    } else if (
      typeof input.ticket_medio !== "number" ||
      !Number.isFinite(input.ticket_medio) ||
      input.ticket_medio < 0
    ) {
      return {
        ok: false,
        field: "ticket_medio",
        message: "Ticket medio deve ser numero >= 0.",
      };
    } else {
      out.ticket_medio = input.ticket_medio;
    }
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, field: "_root", message: "Nenhum campo para atualizar." };
  }
  return { ok: true, data: out };
}

export async function updateLead(
  supabase: SupabaseClient,
  id: string,
  input: LeadUpdateInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const patch: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("leads_oficina")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(`update_lead_failed: ${error.message}`);

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("update_lead_disappeared");

  const beforeSnap: Record<string, unknown> = {};
  const afterSnap: Record<string, unknown> = {};
  for (const field of Object.keys(input) as Array<keyof LeadUpdateInput>) {
    beforeSnap[field] = (before as Record<string, unknown>)[field] ?? null;
    afterSnap[field] = (after as Record<string, unknown>)[field] ?? null;
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.update",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: { before: beforeSnap, after: afterSnap },
    ip: ctx.ip,
  });

  return { ok: true, lead: after };
}

// ----------------------------------------------------------------------------
// Trocar WhatsApp (L5) — confirmacao dupla
// ----------------------------------------------------------------------------

export type LeadChangeWhatsappInput = {
  whatsapp: string;
  confirmacao_whatsapp: string;
};

export function validateChangeLeadWhatsapp(
  input: Partial<LeadChangeWhatsappInput>,
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

export async function changeLeadWhatsapp(
  supabase: SupabaseClient,
  id: string,
  input: { whatsapp: string },
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.whatsapp === input.whatsapp) {
    return { ok: true, lead: before };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("leads_oficina")
    .select("id")
    .eq("whatsapp", input.whatsapp)
    .is("deleted_at", null)
    .neq("id", id)
    .limit(1);
  if (existingErr) throw new Error(`change_lead_whatsapp_check_failed: ${existingErr.message}`);
  if (existing && existing.length > 0) {
    const err = new Error("Ja existe outro lead com esse WhatsApp.");
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { error } = await supabase
    .from("leads_oficina")
    .update({ whatsapp: input.whatsapp, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`change_lead_whatsapp_failed: ${error.message}`);

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("change_lead_whatsapp_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.change_whatsapp",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      before: { whatsapp: before.whatsapp },
      after: { whatsapp: after.whatsapp },
    },
    ip: ctx.ip,
  });

  return { ok: true, lead: after };
}

// ----------------------------------------------------------------------------
// Converter lead em oficina manualmente (L2)
// ----------------------------------------------------------------------------

export type LeadConvertManualInput = {
  plano_id: string;
  preco_negociado: number | null;
  dias_lembrete: number;
  status: "ativa" | "pausada";
};

export function validateConvertLeadManual(
  input: Partial<LeadConvertManualInput>,
):
  | { ok: true; data: LeadConvertManualInput }
  | { ok: false; field: keyof LeadConvertManualInput; message: string } {
  if (
    !input.plano_id ||
    typeof input.plano_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.plano_id)
  ) {
    return { ok: false, field: "plano_id", message: "Plano obrigatorio." };
  }
  if (
    input.dias_lembrete === undefined ||
    typeof input.dias_lembrete !== "number" ||
    !Number.isInteger(input.dias_lembrete) ||
    input.dias_lembrete < 1 ||
    input.dias_lembrete > 365
  ) {
    return {
      ok: false,
      field: "dias_lembrete",
      message: "Dias de lembrete deve ser inteiro entre 1 e 365.",
    };
  }
  if (input.status !== "ativa" && input.status !== "pausada") {
    return {
      ok: false,
      field: "status",
      message: "Status inicial deve ser 'ativa' ou 'pausada'.",
    };
  }
  let preco: number | null;
  if (input.preco_negociado === undefined || input.preco_negociado === null) {
    preco = null;
  } else if (
    typeof input.preco_negociado !== "number" ||
    !Number.isFinite(input.preco_negociado) ||
    input.preco_negociado < 0
  ) {
    return {
      ok: false,
      field: "preco_negociado",
      message: "Preco negociado deve ser numero >= 0.",
    };
  } else {
    preco = input.preco_negociado;
  }
  return {
    ok: true,
    data: {
      plano_id: input.plano_id,
      preco_negociado: preco,
      dias_lembrete: input.dias_lembrete,
      status: input.status,
    },
  };
}

export async function convertLeadManual(
  supabase: SupabaseClient,
  id: string,
  input: LeadConvertManualInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lead: LeadDetail; oficinaId: string }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (TERMINAL_LEAD_STATUSES.has(before.status)) {
    const err = new Error(
      `Lead ja esta em status terminal (${before.status}); nao pode ser convertido manualmente.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "convert_lead_to_oficina_manual",
    {
      p_lead_id: id,
      p_plano_id: input.plano_id,
      p_preco_negociado: input.preco_negociado,
      p_dias_lembrete: input.dias_lembrete,
      p_status: input.status,
      p_admin_id: ctx.adminId,
    },
  );
  if (rpcError) {
    const msg = rpcError.message || "";
    let status = 500;
    let userMsg = "Erro ao converter lead.";
    if (/plano_inativo/.test(msg)) {
      status = 400;
      userMsg = "Plano selecionado esta inativo.";
    } else if (/oficina_whatsapp_em_uso/.test(msg)) {
      status = 409;
      userMsg = "Ja existe oficina ativa com esse WhatsApp.";
    } else if (/lead_terminal/.test(msg)) {
      status = 409;
      userMsg = "Lead ja esta em status terminal.";
    } else if (/lead_not_found|lead_deleted/.test(msg)) {
      status = 404;
      userMsg = "Lead nao encontrado.";
    } else if (
      /status_invalido|dias_lembrete_invalido|preco_negociado_invalido/.test(msg)
    ) {
      status = 400;
      userMsg = "Dados invalidos.";
    }
    const err = new Error(userMsg);
    Object.assign(err, { status, cause: msg });
    throw err;
  }

  const result = (rpcData ?? {}) as {
    oficina_id?: string;
    lead_id?: string;
    conversa_id?: string | null;
  };
  if (!result.oficina_id) {
    throw new Error("convert_lead_manual_no_oficina_id");
  }

  const after = await getLeadById(supabase, id);
  if (!after) throw new Error("convert_lead_manual_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.convert_manual",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      input,
      result,
      before: { status: before.status, oficina_id: before.oficina_id },
      after: { status: after.status, oficina_id: after.oficina_id },
    },
    ip: ctx.ip,
  });

  return { ok: true, lead: after, oficinaId: result.oficina_id };
}

// ----------------------------------------------------------------------------
// Soft delete (L6)
// ----------------------------------------------------------------------------

export type LeadSoftDeleteInput = { motivo: string };

export function validateSoftDeleteLead(
  input: Partial<LeadSoftDeleteInput>,
):
  | { ok: true; data: LeadSoftDeleteInput }
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

export async function softDeleteLead(
  supabase: SupabaseClient,
  id: string,
  input: LeadSoftDeleteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; id: string }> {
  const before = await getLeadById(supabase, id);
  if (!before) {
    const err = new Error("lead_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (before.status === "convertido") {
    const err = new Error(
      "Lead convertido nao pode ser deletado (oficina ficaria orfa).",
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("leads_oficina")
    .update({
      deleted_at: nowIso,
      deleted_by: ctx.adminId,
      deleted_reason: input.motivo,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (error) throw new Error(`soft_delete_lead_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lead.soft_delete",
    entidade: "leads_oficina",
    entidade_id: id,
    payload: {
      motivo: input.motivo,
      before: { status: before.status, whatsapp: before.whatsapp },
    },
    ip: ctx.ip,
  });

  return { ok: true, id };
}
