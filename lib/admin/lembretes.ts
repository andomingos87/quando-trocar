import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeClienteNome, normalizeServico, normalizeVeiculo } from "./normalize";
import { maskWhatsapp } from "./pii";

// ADR-0001: transicao iniciada pelo admin humano, nao por LLM.

export type LembreteStatus =
  | "pendente"
  | "enfileirado"
  | "enviado"
  | "respondido"
  | "agendado"
  | "sem_resposta"
  | "cancelado"
  | "erro_envio";

export type LembreteListRow = {
  id: string;
  oficina_id: string | null;
  oficina_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_whatsapp_mascarado: string;
  veiculo_descricao: string | null;
  servico_tipo: string | null;
  status: LembreteStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  attempts: number | null;
  last_error: string | null;
  updated_at: string;
  created_at: string;
};

export type LembreteListFilters = {
  status?: LembreteStatus | "todas";
  oficina_id?: string;
  periodo?: "ultimos_7d" | "proximos_7d" | "mes_atual";
  busca?: string;
  page?: number;
  pageSize?: number;
};

export type LembreteListResult = {
  rows: LembreteListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type LembreteDetail = LembreteListRow & {
  whatsapp_message_id: string | null;
  provider_status: string | null;
  provider_error_code: string | null;
  last_attempt_at: string | null;
  cliente_whatsapp: string | null;
  veiculo_id: string | null;
  veiculo_placa: string | null;
  servico_id: string | null;
  servico_descricao: string | null;
  servico_valor: number | null;
  servico_data: string | null;
};

export type LembreteOutboundMessage = {
  id: string;
  status: string;
  message_kind: string;
  template_name: string | null;
  body: string | null;
  attempts: number | null;
  provider_error_code: string | null;
  provider_error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 50;

function periodoToRange(periodo: LembreteListFilters["periodo"]): {
  gte?: string;
  lte?: string;
} {
  if (!periodo) return {};
  const now = new Date();
  if (periodo === "ultimos_7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { gte: start.toISOString(), lte: now.toISOString() };
  }
  if (periodo === "proximos_7d") {
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { gte: now.toISOString(), lte: end.toISOString() };
  }
  if (periodo === "mes_atual") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }
  return {};
}

export async function listLembretes(
  supabase: SupabaseClient,
  filters: LembreteListFilters = {},
): Promise<LembreteListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("lembretes")
    .select(
      `id, oficina_id, cliente_id, veiculo_id, servico_id, status, scheduled_at, sent_at,
       attempts, last_error, created_at, updated_at,
       oficinas:oficina_id (nome),
       clientes_finais:cliente_id (nome, whatsapp),
       veiculos:veiculo_id (descricao, placa),
       servicos:servico_id (tipo)`,
      { count: "exact" },
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);

  const range = periodoToRange(filters.periodo);
  if (range.gte) query = query.gte("scheduled_at", range.gte);
  if (range.lte) query = query.lte("scheduled_at", range.lte);

  const { data, count, error } = await query;
  if (error) throw new Error(`list_lembretes_failed: ${error.message}`);

  let rows = (data ?? []).map((l) => {
    const oficinaRaw = l.oficinas as { nome: string } | { nome: string }[] | null;
    const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;
    const clienteRaw = l.clientes_finais as
      | { nome: string; whatsapp: string }
      | { nome: string; whatsapp: string }[]
      | null;
    const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] ?? null : clienteRaw;
    const veiculoRaw = l.veiculos as
      | { descricao: string; placa: string }
      | { descricao: string; placa: string }[]
      | null;
    const veiculo = Array.isArray(veiculoRaw) ? veiculoRaw[0] ?? null : veiculoRaw;
    const servicoRaw = l.servicos as { tipo: string } | { tipo: string }[] | null;
    const servico = Array.isArray(servicoRaw) ? servicoRaw[0] ?? null : servicoRaw;

    return {
      id: l.id as string,
      oficina_id: (l.oficina_id ?? null) as string | null,
      oficina_nome: oficina?.nome ?? null,
      cliente_id: (l.cliente_id ?? null) as string | null,
      cliente_nome: normalizeClienteNome(cliente?.nome ?? null),
      cliente_whatsapp_mascarado: maskWhatsapp(cliente?.whatsapp ?? null),
      veiculo_descricao: normalizeVeiculo(veiculo?.descricao ?? veiculo?.placa ?? null),
      servico_tipo: normalizeServico(servico?.tipo ?? null),
      status: l.status as LembreteStatus,
      scheduled_at: (l.scheduled_at ?? null) as string | null,
      sent_at: (l.sent_at ?? null) as string | null,
      attempts: (l.attempts ?? null) as number | null,
      last_error: (l.last_error ?? null) as string | null,
      updated_at: l.updated_at as string,
      created_at: l.created_at as string,
    };
  });

  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.veiculo_descricao ?? "").toLowerCase().includes(term) ||
        (r.servico_tipo ?? "").toLowerCase().includes(term) ||
        (r.oficina_nome ?? "").toLowerCase().includes(term),
    );
  }

  return { rows, total: count ?? 0, page, pageSize };
}

export async function getLembreteById(
  supabase: SupabaseClient,
  id: string,
): Promise<LembreteDetail | null> {
  const { data, error } = await supabase
    .from("lembretes")
    .select(
      `id, oficina_id, cliente_id, veiculo_id, servico_id, status, scheduled_at, sent_at,
       attempts, last_error, created_at, updated_at, whatsapp_message_id,
       provider_status, provider_error_code, last_attempt_at,
       oficinas:oficina_id (nome),
       clientes_finais:cliente_id (nome, whatsapp),
       veiculos:veiculo_id (descricao, placa),
       servicos:servico_id (tipo, descricao, valor, data_servico)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get_lembrete_failed: ${error.message}`);
  if (!data) return null;

  const oficinaRaw = data.oficinas as { nome: string } | { nome: string }[] | null;
  const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;
  const clienteRaw = data.clientes_finais as
    | { nome: string; whatsapp: string }
    | { nome: string; whatsapp: string }[]
    | null;
  const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] ?? null : clienteRaw;
  const veiculoRaw = data.veiculos as
    | { descricao: string; placa: string }
    | { descricao: string; placa: string }[]
    | null;
  const veiculo = Array.isArray(veiculoRaw) ? veiculoRaw[0] ?? null : veiculoRaw;
  const servicoRaw = data.servicos as
    | { tipo: string; descricao: string; valor: number; data_servico: string }
    | { tipo: string; descricao: string; valor: number; data_servico: string }[]
    | null;
  const servico = Array.isArray(servicoRaw) ? servicoRaw[0] ?? null : servicoRaw;

  return {
    id: data.id as string,
    oficina_id: (data.oficina_id ?? null) as string | null,
    oficina_nome: oficina?.nome ?? null,
    cliente_id: (data.cliente_id ?? null) as string | null,
    cliente_nome: normalizeClienteNome(cliente?.nome ?? null),
    cliente_whatsapp: cliente?.whatsapp ?? null,
    cliente_whatsapp_mascarado: maskWhatsapp(cliente?.whatsapp ?? null),
    veiculo_id: (data.veiculo_id ?? null) as string | null,
    veiculo_descricao: normalizeVeiculo(veiculo?.descricao ?? veiculo?.placa ?? null),
    veiculo_placa: veiculo?.placa ?? null,
    servico_id: (data.servico_id ?? null) as string | null,
    servico_tipo: normalizeServico(servico?.tipo ?? null),
    servico_descricao: servico?.descricao ?? null,
    servico_valor: servico?.valor !== undefined ? Number(servico.valor) : null,
    servico_data: servico?.data_servico ?? null,
    status: data.status as LembreteStatus,
    scheduled_at: (data.scheduled_at ?? null) as string | null,
    sent_at: (data.sent_at ?? null) as string | null,
    attempts: (data.attempts ?? null) as number | null,
    last_error: (data.last_error ?? null) as string | null,
    whatsapp_message_id: (data.whatsapp_message_id ?? null) as string | null,
    provider_status: (data.provider_status ?? null) as string | null,
    provider_error_code: (data.provider_error_code ?? null) as string | null,
    last_attempt_at: (data.last_attempt_at ?? null) as string | null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

export async function getLembreteOutboundMessages(
  supabase: SupabaseClient,
  lembreteId: string,
  limit = 20,
): Promise<LembreteOutboundMessage[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select(
      "id, status, message_kind, template_name, body, attempts, provider_error_code, provider_error_message, sent_at, created_at",
    )
    .eq("lembrete_id", lembreteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_lembrete_outbound_failed: ${error.message}`);
  return (data ?? []) as LembreteOutboundMessage[];
}

// ----------------------------------------------------------------------------
// Mutacoes
// ----------------------------------------------------------------------------

// Status que ainda podem ser cancelados por admin.
const CANCELLABLE_STATUSES = new Set<LembreteStatus>([
  "pendente",
  "enfileirado",
  "agendado",
]);

export type CancelarLembreteInput = {
  motivo: string;
};

export function validateCancelarLembrete(
  input: Partial<CancelarLembreteInput>,
): { ok: true; data: CancelarLembreteInput } | { ok: false; field: "motivo"; message: string } {
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

export async function cancelarLembrete(
  supabase: SupabaseClient,
  id: string,
  input: CancelarLembreteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; lembrete: LembreteDetail }> {
  const before = await getLembreteById(supabase, id);
  if (!before) {
    const err = new Error("lembrete_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (!CANCELLABLE_STATUSES.has(before.status)) {
    const err = new Error(
      `Lembrete com status "${before.status}" nao pode ser cancelado.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  const { error } = await supabase
    .from("lembretes")
    .update({
      status: "cancelado",
      last_error: `cancelado_por_admin: ${input.motivo}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`cancelar_lembrete_failed: ${error.message}`);

  const after = await getLembreteById(supabase, id);
  if (!after) throw new Error("cancelar_lembrete_disappeared");

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "lembrete.cancelar",
    entidade: "lembretes",
    entidade_id: id,
    payload: {
      motivo: input.motivo,
      before: { status: before.status, scheduled_at: before.scheduled_at },
      after: { status: after.status },
    },
    ip: ctx.ip,
  });

  return { ok: true, lembrete: after };
}
