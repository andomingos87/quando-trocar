import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";
import {
  isValidCep,
  isValidCpfCnpj,
  isValidEmail,
  isValidUf,
  onlyDigits,
} from "./documento-br";
import { normalizePhoneToE164 } from "./phone";

export type OficinaStatus = "ativa" | "pausada" | "cancelada";
export type OficinaOrigem = "landing_whatsapp" | "manual" | "importacao";
export type MotivoPausa = "inadimplencia" | "voluntaria" | "admin";

export type OficinaListRow = {
  id: string;
  nome: string;
  responsavel: string | null;
  whatsapp_principal: string;
  email: string | null;
  cpf_cnpj: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacao: string | null;
  ticket_medio: number | null;
  volume_trocas_mes: number | null;
  status: OficinaStatus;
  origem: OficinaOrigem;
  motivo_pausa: MotivoPausa | null;
  plano_id: string | null;
  plano_nome: string | null;
  preco_base: number | null;
  preco_negociado: number | null;
  preco_efetivo: number | null;
  proximo_vencimento: string | null;
  representante_id: string | null;
  representante_nome: string | null;
  cobranca_pronta: boolean;
  ultima_atividade_em: string | null;
  created_at: string;
};

export type OficinaListFilters = {
  status?: OficinaStatus | "todas";
  plano_id?: string;
  origem?: OficinaOrigem;
  motivo_pausa?: MotivoPausa;
  representante_id?: string;
  cobranca?: "pronta" | "sem_documento";
  busca?: string;
  sort?: OficinaSortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type OficinaSortKey =
  | "created_at"
  | "nome"
  | "cidade"
  | "status"
  | "proximo_vencimento";

const SORTABLE: Record<OficinaSortKey, string> = {
  created_at: "created_at",
  nome: "nome",
  cidade: "cidade",
  status: "status",
  proximo_vencimento: "proximo_vencimento",
};

export type OficinaListResult = {
  rows: OficinaListRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: OficinaSortKey;
  dir: "asc" | "desc";
};

/** Configuracao operacional de lembrete, editavel so na pagina de detalhe. */
export type OficinaLembreteConfig = {
  timezone: string;
  dias_lembrete_padrao: number;
  horario_envio_inicio: string;
  horario_envio_fim: string;
  mensagem_lembrete_padrao: string | null;
};

export type OficinaDetail = OficinaListRow &
  OficinaLembreteConfig & {
    asaas_customer_id: string | null;
    updated_at: string | null;
  };

export type OficinaCadastroInput = Partial<{
  cpf_cnpj: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  estado: string | null;
  ticket_medio: number | null;
  volume_trocas_mes: number | null;
  observacao: string | null;
}>;

export type OficinaCreateInput = {
  nome: string;
  whatsapp: string;
  cidade: string;
  plano_id: string;
  preco_negociado?: number | null;
  status?: "ativa" | "pausada";
  observacao?: string | null;
  responsavel?: string | null;
  representante_id?: string | null;
} & OficinaCadastroInput;

export type OficinaPatchInput = Partial<{
  nome: string;
  whatsapp: string;
  cidade: string | null;
  responsavel: string | null;
  status: OficinaStatus;
  motivo_pausa: MotivoPausa | null;
  plano_id: string;
  preco_negociado: number | null;
  representante_id: string | null;
  // Config de lembrete (pagina de detalhe)
  dias_lembrete_padrao: number;
  horario_envio_inicio: string;
  horario_envio_fim: string;
  mensagem_lembrete_padrao: string | null;
  cancelConfirmationName: string;
}> &
  OficinaCadastroInput;

const DEFAULT_PAGE_SIZE = 50;

const JOINS = "planos:plano_id (nome, preco_base), representantes:representante_id (nome)";
const SCALAR_LIST =
  "id, nome, responsavel, whatsapp_principal, email, cpf_cnpj, cep, logradouro, numero, complemento, bairro, cidade, estado, observacao, ticket_medio, volume_trocas_mes, status, origem, motivo_pausa, plano_id, preco_negociado, proximo_vencimento, representante_id, created_at";
const LIST_SELECT = `${SCALAR_LIST}, ${JOINS}`;
const DETAIL_SELECT = `${SCALAR_LIST}, asaas_customer_id, timezone, dias_lembrete_padrao, horario_envio_inicio, horario_envio_fim, mensagem_lembrete_padrao, updated_at, ${JOINS}`;

function precoEfetivo(plano: { preco_base: number | null }, preco_negociado: number | null): number | null {
  if (preco_negociado !== null && preco_negociado !== undefined) return Number(preco_negociado);
  if (plano.preco_base !== null && plano.preco_base !== undefined) return Number(plano.preco_base);
  return null;
}

type OficinaRawRow = {
  id: string;
  nome: string;
  responsavel: string | null;
  whatsapp_principal: string;
  email: string | null;
  cpf_cnpj: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacao: string | null;
  ticket_medio: number | string | null;
  volume_trocas_mes: number | null;
  status: OficinaStatus;
  origem: OficinaOrigem;
  motivo_pausa: MotivoPausa | null;
  plano_id: string | null;
  preco_negociado: number | string | null;
  proximo_vencimento: string | null;
  representante_id: string | null;
  created_at: string;
  planos?: unknown;
  representantes?: unknown;
};

function mapListRow(o: OficinaRawRow, ultimaAtividade: string | null): OficinaListRow {
  const planoRaw = o.planos as
    | { nome: string; preco_base: number }
    | { nome: string; preco_base: number }[]
    | null;
  const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;
  const repRaw = o.representantes;
  const rep = Array.isArray(repRaw) ? repRaw[0] ?? null : repRaw;
  const precoNeg = o.preco_negociado !== null ? Number(o.preco_negociado) : null;
  return {
    id: o.id,
    nome: o.nome,
    responsavel: o.responsavel,
    whatsapp_principal: o.whatsapp_principal,
    email: o.email,
    cpf_cnpj: o.cpf_cnpj,
    cep: o.cep,
    logradouro: o.logradouro,
    numero: o.numero,
    complemento: o.complemento,
    bairro: o.bairro,
    cidade: o.cidade,
    estado: o.estado,
    observacao: o.observacao,
    ticket_medio: o.ticket_medio !== null ? Number(o.ticket_medio) : null,
    volume_trocas_mes: o.volume_trocas_mes !== null ? Number(o.volume_trocas_mes) : null,
    status: o.status,
    origem: o.origem,
    motivo_pausa: o.motivo_pausa,
    plano_id: o.plano_id,
    plano_nome: plano?.nome ?? null,
    preco_base: plano ? Number(plano.preco_base) : null,
    preco_negociado: precoNeg,
    preco_efetivo: precoEfetivo({ preco_base: plano?.preco_base ?? null }, precoNeg),
    proximo_vencimento: o.proximo_vencimento,
    representante_id: o.representante_id ?? null,
    representante_nome: (rep as { nome?: string } | null)?.nome ?? null,
    cobranca_pronta: Boolean(o.cpf_cnpj?.trim()),
    ultima_atividade_em: ultimaAtividade,
    created_at: o.created_at,
  };
}

export async function listOficinas(
  supabase: SupabaseClient,
  filters: OficinaListFilters = {},
): Promise<OficinaListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort: OficinaSortKey = filters.sort && SORTABLE[filters.sort] ? filters.sort : "created_at";
  const dir: "asc" | "desc" = filters.dir === "asc" ? "asc" : "desc";

  let query = supabase
    .from("oficinas")
    .select(LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order(SORTABLE[sort], { ascending: dir === "asc" })
    .range(from, to);

  if (filters.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }
  if (filters.plano_id) query = query.eq("plano_id", filters.plano_id);
  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.motivo_pausa) query = query.eq("motivo_pausa", filters.motivo_pausa);
  if (filters.representante_id) query = query.eq("representante_id", filters.representante_id);
  if (filters.cobranca === "pronta") {
    query = query.not("cpf_cnpj", "is", null).neq("cpf_cnpj", "");
  } else if (filters.cobranca === "sem_documento") {
    query = query.or("cpf_cnpj.is.null,cpf_cnpj.eq.");
  }
  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim();
    const safe = term.replace(/[%,]/g, "");
    query = query.or(
      `nome.ilike.%${safe}%,whatsapp_principal.ilike.%${safe}%,cidade.ilike.%${safe}%,cpf_cnpj.ilike.%${safe}%,email.ilike.%${safe}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`list_oficinas_failed: ${error.message}`);

  const oficinaIds = (data ?? []).map((o) => o.id);
  const ultimaAtividade = new Map<string, string>();
  if (oficinaIds.length > 0) {
    const { data: msgs, error: msgsError } = await supabase
      .from("mensagens")
      .select("oficina_id, created_at")
      .in("oficina_id", oficinaIds)
      .order("created_at", { ascending: false })
      .limit(500);
    if (msgsError) {
      throw new Error(`list_oficinas_msgs_failed: ${msgsError.message}`);
    }
    for (const m of msgs ?? []) {
      if (!m.oficina_id) continue;
      if (!ultimaAtividade.has(m.oficina_id)) {
        ultimaAtividade.set(m.oficina_id, m.created_at as string);
      }
    }
  }

  const rows: OficinaListRow[] = (data ?? []).map((o) =>
    mapListRow(o as unknown as OficinaRawRow, ultimaAtividade.get((o as { id: string }).id) ?? null),
  );

  return { rows, total: count ?? 0, page, pageSize, sort, dir };
}

export async function getOficinaById(
  supabase: SupabaseClient,
  id: string,
): Promise<OficinaDetail | null> {
  const { data, error } = await supabase
    .from("oficinas")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`get_oficina_failed: ${error.message}`);
  if (!data) return null;

  const { data: msgs } = await supabase
    .from("mensagens")
    .select("created_at")
    .eq("oficina_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const ultima = (msgs?.[0]?.created_at as string | undefined) ?? null;

  const raw = data as unknown as OficinaRawRow & {
    asaas_customer_id: string | null;
    timezone: string | null;
    dias_lembrete_padrao: number | null;
    horario_envio_inicio: string | null;
    horario_envio_fim: string | null;
    mensagem_lembrete_padrao: string | null;
    updated_at: string | null;
  };

  return {
    ...mapListRow(raw, ultima),
    asaas_customer_id: raw.asaas_customer_id ?? null,
    timezone: raw.timezone ?? "America/Sao_Paulo",
    dias_lembrete_padrao: raw.dias_lembrete_padrao ?? 90,
    horario_envio_inicio: (raw.horario_envio_inicio ?? "08:00:00").slice(0, 5),
    horario_envio_fim: (raw.horario_envio_fim ?? "18:00:00").slice(0, 5),
    mensagem_lembrete_padrao: raw.mensagem_lembrete_padrao ?? null,
    updated_at: raw.updated_at ?? null,
  };
}

export type OficinaMetrics30d = {
  clientes_finais: number;
  lembretes_enviados: number;
  retornos_concluidos: number;
  receita_gerada: number;
};

export async function getOficinaMetrics30d(
  supabase: SupabaseClient,
  oficinaId: string,
): Promise<OficinaMetrics30d> {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [{ count: clientes }, { count: enviados }, { count: retornos }, receita] =
    await Promise.all([
      supabase
        .from("clientes_finais")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaId)
        .gte("created_at", sinceIso),
      supabase
        .from("lembretes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaId)
        .in("status", ["enviado", "respondido", "agendado", "sem_resposta"])
        .gte("sent_at", sinceIso),
      supabase
        .from("lembretes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaId)
        .eq("status", "agendado")
        .gte("updated_at", sinceIso),
      supabase
        .from("servicos")
        .select("valor")
        .eq("oficina_id", oficinaId)
        .gte("data_servico", sinceDate),
    ]);

  let receitaTotal = 0;
  for (const s of receita.data ?? []) {
    if (s?.valor != null) receitaTotal += Number(s.valor);
  }

  return {
    clientes_finais: clientes ?? 0,
    lembretes_enviados: enviados ?? 0,
    retornos_concluidos: retornos ?? 0,
    receita_gerada: receitaTotal,
  };
}

export type RecentMessagePreview = {
  id: string;
  direction: "inbound" | "outbound";
  created_at: string;
  cliente_nome_mascarado: string;
  cliente_whatsapp_mascarado: string;
  body_truncado: string;
};

export async function getRecentMessagesMasked(
  supabase: SupabaseClient,
  oficinaId: string,
  limit = 10,
): Promise<RecentMessagePreview[]> {
  const { maskName, maskWhatsapp, truncateMessage } = await import("./pii");
  const { data, error } = await supabase
    .from("mensagens")
    .select("id, direction, body, created_at, cliente_id, clientes_finais:cliente_id (nome, whatsapp)")
    .eq("oficina_id", oficinaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_recent_messages_failed: ${error.message}`);
  return (data ?? []).map((m) => {
    const clienteRaw = m.clientes_finais as
      | { nome: string; whatsapp: string }
      | { nome: string; whatsapp: string }[]
      | null;
    const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] ?? null : clienteRaw;
    return {
      id: m.id,
      direction: m.direction,
      created_at: m.created_at,
      cliente_nome_mascarado: maskName(cliente?.nome ?? null),
      cliente_whatsapp_mascarado: maskWhatsapp(cliente?.whatsapp ?? null),
      body_truncado: truncateMessage(m.body, 80),
    };
  });
}

export type AuditChange = { field: string; from: string; to: string };

export type RecentAuditEntry = {
  id: string;
  acao: string;
  created_at: string;
  admin_id: string | null;
  admin_nome: string | null;
  changes: AuditChange[];
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  whatsapp_principal: "WhatsApp",
  cidade: "Cidade",
  estado: "UF",
  responsavel: "Responsavel",
  cpf_cnpj: "CPF/CNPJ",
  email: "E-mail",
  cep: "CEP",
  bairro: "Bairro",
  logradouro: "Logradouro",
  numero: "Numero",
  complemento: "Complemento",
  status: "Status",
  motivo_pausa: "Motivo da pausa",
  plano_nome: "Plano",
  preco_negociado: "Preco negociado",
  representante_nome: "Representante",
  ticket_medio: "Ticket medio",
  volume_trocas_mes: "Volume/mes",
  observacao: "Observacao",
  dias_lembrete_padrao: "Cadencia (dias)",
  horario_envio_inicio: "Envio inicio",
  horario_envio_fim: "Envio fim",
  mensagem_lembrete_padrao: "Mensagem padrao",
};

function auditValueToString(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "nao";
  return String(v);
}

/** Extrai as mudancas legiveis (campo: antes -> depois) do payload before/after. */
function diffAuditPayload(payload: unknown): AuditChange[] {
  if (!payload || typeof payload !== "object") return [];
  const { before, after } = payload as { before?: unknown; after?: unknown };
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return [];
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changes: AuditChange[] = [];
  for (const [key, label] of Object.entries(AUDIT_FIELD_LABELS)) {
    const from = b[key] ?? null;
    const to = a[key] ?? null;
    if (auditValueToString(from) !== auditValueToString(to)) {
      changes.push({ field: label, from: auditValueToString(from), to: auditValueToString(to) });
    }
  }
  return changes;
}

export async function getRecentOficinaAudit(
  supabase: SupabaseClient,
  oficinaId: string,
  limit = 10,
): Promise<RecentAuditEntry[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, acao, payload, created_at, admin_id, admin_users:admin_id (nome)")
    .eq("entidade", "oficinas")
    .eq("entidade_id", oficinaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_oficina_audit_failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const adminRaw = (row as { admin_users?: unknown }).admin_users;
    const admin = Array.isArray(adminRaw) ? adminRaw[0] ?? null : adminRaw;
    return {
      id: row.id as string,
      acao: row.acao as string,
      created_at: row.created_at as string,
      admin_id: (row.admin_id as string | null) ?? null,
      admin_nome: (admin as { nome?: string } | null)?.nome ?? null,
      changes: diffAuditPayload(row.payload),
    };
  });
}

export type RecentPaymentRow = {
  id: string;
  valor: number;
  status: string;
  mp_preference_id: string | null;
  vencimento: string | null;
  created_at: string;
  paid_at: string | null;
};

export async function getRecentOficinaPayments(
  supabase: SupabaseClient,
  oficinaId: string,
  limit = 6,
): Promise<RecentPaymentRow[]> {
  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, valor, status, mp_preference_id, vencimento, created_at, paid_at")
    .eq("oficina_id", oficinaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_oficina_payments_failed: ${error.message}`);
  return (data ?? []).map((p) => ({ ...p, valor: Number(p.valor) }));
}

// ----------------------------------------------------------------------------
// Validacoes e mutacoes
// ----------------------------------------------------------------------------

export type CadastroFieldError = {
  field:
    | "cpf_cnpj"
    | "email"
    | "cep"
    | "estado"
    | "ticket_medio"
    | "volume_trocas_mes";
  message: string;
};

/**
 * Valida e normaliza os campos de cadastro/fiscal compartilhados por create e
 * patch. So inclui no resultado as chaves presentes no input (undefined => nao
 * mexe na coluna). Strings vazias viram null; documentos/CEP guardam so digitos.
 */
function normalizeCadastroFields(
  input: OficinaCadastroInput,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: CadastroFieldError } {
  const data: Record<string, unknown> = {};

  if (input.cpf_cnpj !== undefined) {
    const raw = (input.cpf_cnpj ?? "").trim();
    if (raw === "") data.cpf_cnpj = null;
    else if (!isValidCpfCnpj(raw)) {
      return { ok: false, error: { field: "cpf_cnpj", message: "CPF/CNPJ invalido." } };
    } else data.cpf_cnpj = onlyDigits(raw);
  }

  if (input.email !== undefined) {
    const raw = (input.email ?? "").trim();
    if (raw === "") data.email = null;
    else if (!isValidEmail(raw)) {
      return { ok: false, error: { field: "email", message: "E-mail invalido." } };
    } else data.email = raw.toLowerCase();
  }

  if (input.cep !== undefined) {
    const raw = (input.cep ?? "").trim();
    if (raw === "") data.cep = null;
    else if (!isValidCep(raw)) {
      return { ok: false, error: { field: "cep", message: "CEP invalido (8 digitos)." } };
    } else data.cep = onlyDigits(raw);
  }

  if (input.estado !== undefined) {
    const raw = (input.estado ?? "").trim();
    if (raw === "") data.estado = null;
    else if (!isValidUf(raw)) {
      return { ok: false, error: { field: "estado", message: "UF invalida." } };
    } else data.estado = raw.toUpperCase();
  }

  for (const key of ["logradouro", "numero", "complemento", "bairro", "observacao"] as const) {
    if (input[key] !== undefined) {
      const raw = (input[key] ?? "").trim();
      data[key] = raw === "" ? null : raw;
    }
  }

  if (input.ticket_medio !== undefined) {
    if (input.ticket_medio === null) data.ticket_medio = null;
    else {
      const n = Number(input.ticket_medio);
      if (Number.isNaN(n) || n < 0) {
        return { ok: false, error: { field: "ticket_medio", message: "Ticket medio invalido." } };
      }
      data.ticket_medio = n;
    }
  }

  if (input.volume_trocas_mes !== undefined) {
    if (input.volume_trocas_mes === null) data.volume_trocas_mes = null;
    else {
      const n = Number(input.volume_trocas_mes);
      if (!Number.isInteger(n) || n < 0) {
        return {
          ok: false,
          error: { field: "volume_trocas_mes", message: "Volume de trocas invalido." },
        };
      }
      data.volume_trocas_mes = n;
    }
  }

  return { ok: true, data };
}

export type OficinaCreateValidationError = {
  field: "nome" | "whatsapp" | "cidade" | "plano_id" | "status" | CadastroFieldError["field"];
  message: string;
};

export function validateOficinaCreate(
  input: Partial<OficinaCreateInput>,
): { ok: true; data: OficinaCreateInput } | { ok: false; error: OficinaCreateValidationError } {
  if (!input.nome || input.nome.trim().length === 0) {
    return { ok: false, error: { field: "nome", message: "Nome obrigatorio." } };
  }
  if (!input.whatsapp || typeof input.whatsapp !== "string") {
    return { ok: false, error: { field: "whatsapp", message: "WhatsApp obrigatorio." } };
  }
  const phone = normalizePhoneToE164(input.whatsapp);
  if (!phone.ok) {
    return { ok: false, error: { field: "whatsapp", message: "WhatsApp invalido." } };
  }
  if (!input.cidade || input.cidade.trim().length === 0) {
    return { ok: false, error: { field: "cidade", message: "Cidade obrigatoria." } };
  }
  if (!input.plano_id || typeof input.plano_id !== "string") {
    return { ok: false, error: { field: "plano_id", message: "Plano obrigatorio." } };
  }
  if (input.status && !["ativa", "pausada"].includes(input.status)) {
    return { ok: false, error: { field: "status", message: "Status inicial invalido." } };
  }

  const cadastro = normalizeCadastroFields(input);
  if (!cadastro.ok) return { ok: false, error: cadastro.error };

  return {
    ok: true,
    data: {
      nome: input.nome.trim(),
      whatsapp: phone.e164,
      cidade: input.cidade.trim(),
      plano_id: input.plano_id,
      preco_negociado:
        input.preco_negociado === undefined || input.preco_negociado === null
          ? null
          : Number(input.preco_negociado),
      status: input.status ?? "ativa",
      responsavel: input.responsavel?.trim() || null,
      representante_id: input.representante_id || null,
      ...cadastro.data,
    },
  };
}

// ADR-0019: atribuicao manual so aceita representante ativo e nao excluido.
async function assertRepresentanteAtivo(
  supabase: SupabaseClient,
  representanteId: string,
): Promise<void> {
  const { data } = await supabase
    .from("representantes")
    .select("id, ativo")
    .eq("id", representanteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || !data.ativo) {
    const err = new Error("Representante selecionado esta inativo ou nao existe.");
    Object.assign(err, { status: 400 });
    throw err;
  }
}

export async function createOficinaManual(
  supabase: SupabaseClient,
  input: OficinaCreateInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ id: string }> {
  // Plano ativo?
  const { data: plano } = await supabase
    .from("planos")
    .select("id, ativo")
    .eq("id", input.plano_id)
    .maybeSingle();
  if (!plano || !plano.ativo) {
    const err = new Error("Plano selecionado esta inativo.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  // WhatsApp ja em uso por oficina nao-cancelada?
  const { data: existing } = await supabase
    .from("oficinas")
    .select("id, status")
    .eq("whatsapp_principal", input.whatsapp)
    .neq("status", "cancelada")
    .is("deleted_at", null);
  if (existing && existing.length > 0) {
    const err = new Error("Ja existe oficina ativa com esse WhatsApp.");
    Object.assign(err, { status: 409 });
    throw err;
  }

  if (input.representante_id) {
    await assertRepresentanteAtivo(supabase, input.representante_id);
  }

  const status = input.status ?? "ativa";
  const proximoVencimento =
    status === "ativa"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

  const insertPayload: Record<string, unknown> = {
    nome: input.nome,
    whatsapp_principal: input.whatsapp,
    cidade: input.cidade,
    plano_id: input.plano_id,
    preco_negociado: input.preco_negociado,
    status,
    origem: "manual",
    proximo_vencimento: proximoVencimento,
    representante_id: input.representante_id ?? null,
    responsavel: input.responsavel ?? null,
  };
  const CADASTRO_KEYS = [
    "cpf_cnpj",
    "email",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "estado",
    "observacao",
    "ticket_medio",
    "volume_trocas_mes",
  ] as const;
  for (const key of CADASTRO_KEYS) {
    if (input[key] !== undefined) insertPayload[key] = input[key];
  }

  return withAdminAudit(
    supabase,
    (result: { id: string }) => ({
      adminId: ctx.adminId,
      acao: "oficina.create_manual",
      entidade: "oficinas",
      entidadeId: result.id,
      ip: ctx.ip,
      payload: {
        input: { ...insertPayload, whatsapp: input.whatsapp },
        proximo_vencimento: proximoVencimento,
      },
    }),
    async () => {
      const { data, error } = await supabase
        .from("oficinas")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw new Error(`create_oficina_failed: ${error.message}`);
      return { id: data.id };
    },
  );
}

export type PatchOficinaResult = {
  ok: true;
  oficina: OficinaDetail;
  actions: string[];
};

export async function patchOficina(
  supabase: SupabaseClient,
  id: string,
  input: OficinaPatchInput,
  ctx: { adminId: string; ip: string | null },
): Promise<PatchOficinaResult> {
  const before = await getOficinaById(supabase, id);
  if (!before) {
    const err = new Error("oficina_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  // Regras de status
  if (input.status !== undefined && input.status !== before.status) {
    if (before.status === "cancelada") {
      const err = new Error("Oficina cancelada nao pode ser revertida por esta tela.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (input.status === "pausada" && !input.motivo_pausa) {
      const err = new Error("Motivo da pausa e obrigatorio ao pausar.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (input.status === "cancelada") {
      if (
        !input.cancelConfirmationName ||
        input.cancelConfirmationName.trim() !== before.nome.trim()
      ) {
        const err = new Error("Confirme o nome da oficina para cancelar.");
        Object.assign(err, { status: 400 });
        throw err;
      }
    }
  }

  if (input.plano_id !== undefined && input.plano_id !== before.plano_id) {
    const { data: plano } = await supabase
      .from("planos")
      .select("id, ativo")
      .eq("id", input.plano_id)
      .maybeSingle();
    if (!plano || !plano.ativo) {
      const err = new Error("Plano selecionado esta inativo.");
      Object.assign(err, { status: 400 });
      throw err;
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const actions: string[] = [];

  if (input.status !== undefined && input.status !== before.status) {
    patch.status = input.status;
    if (input.status === "ativa") {
      patch.motivo_pausa = null;
    } else if (input.status === "pausada") {
      patch.motivo_pausa = input.motivo_pausa ?? null;
    } else if (input.status === "cancelada") {
      patch.motivo_pausa = null;
    }
    actions.push("oficina.update_status");
  } else if (
    input.motivo_pausa !== undefined &&
    input.motivo_pausa !== before.motivo_pausa &&
    before.status === "pausada"
  ) {
    patch.motivo_pausa = input.motivo_pausa;
    actions.push("oficina.update_status");
  }

  if (input.plano_id !== undefined && input.plano_id !== before.plano_id) {
    patch.plano_id = input.plano_id;
    actions.push("oficina.update_plano");
  }

  if (input.preco_negociado !== undefined) {
    const next = input.preco_negociado === null ? null : Number(input.preco_negociado);
    const prev = before.preco_negociado === null ? null : Number(before.preco_negociado);
    if (next !== prev) {
      patch.preco_negociado = next;
      actions.push("oficina.update_preco");
    }
  }

  let cadastroChanged = false;

  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (nome.length === 0) {
      const err = new Error("Nome obrigatorio.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (nome !== before.nome) {
      patch.nome = nome;
      cadastroChanged = true;
    }
  }

  if (input.cidade !== undefined) {
    const cidade = input.cidade === null ? null : input.cidade.trim() || null;
    if (cidade !== before.cidade) {
      patch.cidade = cidade;
      cadastroChanged = true;
    }
  }

  if (input.responsavel !== undefined) {
    const responsavel =
      input.responsavel === null ? null : input.responsavel.trim() || null;
    if (responsavel !== before.responsavel) {
      patch.responsavel = responsavel;
      cadastroChanged = true;
    }
  }

  if (input.whatsapp !== undefined) {
    const phone = normalizePhoneToE164(input.whatsapp);
    if (!phone.ok) {
      const err = new Error("WhatsApp invalido.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (phone.e164 !== before.whatsapp_principal) {
      const { data: existing } = await supabase
        .from("oficinas")
        .select("id")
        .eq("whatsapp_principal", phone.e164)
        .neq("id", id)
        .neq("status", "cancelada")
        .is("deleted_at", null);
      if (existing && existing.length > 0) {
        const err = new Error("Ja existe outra oficina ativa com esse WhatsApp.");
        Object.assign(err, { status: 409 });
        throw err;
      }
      patch.whatsapp_principal = phone.e164;
      cadastroChanged = true;
    }
  }

  // Campos fiscais / endereco / qualificacao (normalizados e validados juntos).
  const cadastro = normalizeCadastroFields(input);
  if (!cadastro.ok) {
    const err = new Error(cadastro.error.message);
    Object.assign(err, { status: 400 });
    throw err;
  }
  let fiscalChanged = false;
  const beforeRecord = before as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(cadastro.data)) {
    const next = value ?? null;
    const prev = beforeRecord[key] ?? null;
    if (next !== prev) {
      patch[key] = next;
      if (key === "cpf_cnpj") fiscalChanged = true;
      else cadastroChanged = true;
    }
  }

  if (cadastroChanged) actions.push("oficina.update_cadastro");
  if (fiscalChanged) actions.push("oficina.update_fiscal");

  // Config operacional de lembrete (pagina de detalhe).
  let lembreteChanged = false;
  if (input.dias_lembrete_padrao !== undefined) {
    const n = Number(input.dias_lembrete_padrao);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      const err = new Error("Dias de lembrete deve estar entre 1 e 365.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (n !== before.dias_lembrete_padrao) {
      patch.dias_lembrete_padrao = n;
      lembreteChanged = true;
    }
  }
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  let inicio = before.horario_envio_inicio;
  let fim = before.horario_envio_fim;
  if (input.horario_envio_inicio !== undefined) {
    if (!timeRe.test(input.horario_envio_inicio)) {
      const err = new Error("Horario de inicio invalido (HH:MM).");
      Object.assign(err, { status: 400 });
      throw err;
    }
    inicio = input.horario_envio_inicio;
  }
  if (input.horario_envio_fim !== undefined) {
    if (!timeRe.test(input.horario_envio_fim)) {
      const err = new Error("Horario de fim invalido (HH:MM).");
      Object.assign(err, { status: 400 });
      throw err;
    }
    fim = input.horario_envio_fim;
  }
  if (input.horario_envio_inicio !== undefined || input.horario_envio_fim !== undefined) {
    if (fim <= inicio) {
      const err = new Error("Horario de fim deve ser maior que o de inicio.");
      Object.assign(err, { status: 400 });
      throw err;
    }
    if (inicio !== before.horario_envio_inicio) {
      patch.horario_envio_inicio = inicio;
      lembreteChanged = true;
    }
    if (fim !== before.horario_envio_fim) {
      patch.horario_envio_fim = fim;
      lembreteChanged = true;
    }
  }
  if (input.mensagem_lembrete_padrao !== undefined) {
    const msg = input.mensagem_lembrete_padrao === null
      ? null
      : input.mensagem_lembrete_padrao.trim() || null;
    if (msg !== before.mensagem_lembrete_padrao) {
      patch.mensagem_lembrete_padrao = msg;
      lembreteChanged = true;
    }
  }
  if (lembreteChanged) actions.push("oficina.update_lembrete_config");

  // ADR-0019: atribuicao de representante e auditada em acao propria.
  // Nao gera comissao retroativa — so pagamentos posteriores a atribuicao.
  if (input.representante_id !== undefined) {
    const next = input.representante_id || null;
    if (next !== before.representante_id) {
      if (next) await assertRepresentanteAtivo(supabase, next);
      patch.representante_id = next;
      actions.push("oficina.update_representante");
    }
  }

  if (Object.keys(patch).length === 1) {
    // nada mudou alem de updated_at
    return { ok: true, oficina: before, actions: [] };
  }

  const { error } = await supabase.from("oficinas").update(patch).eq("id", id);
  if (error) throw new Error(`patch_oficina_failed: ${error.message}`);

  const after = await getOficinaById(supabase, id);
  if (!after) throw new Error("patch_oficina_disappeared");

  // Auditoria: 1 entrada por acao distinta.
  for (const acao of actions) {
    await supabase.from("admin_audit_log").insert({
      admin_id: ctx.adminId,
      acao,
      entidade: "oficinas",
      entidade_id: id,
      payload: { before, after },
      ip: ctx.ip,
    });
  }

  return { ok: true, oficina: after, actions };
}

export type SoftDeleteOficinaResult = {
  ok: true;
  id: string;
};

/**
 * Soft delete: marca `deleted_at` para ocultar a oficina de todas as telas do
 * admin, mantendo o registro no banco. Distinto de `status = 'cancelada'`.
 * Exige confirmar o nome (mesma proteção do cancelamento) e é irreversível
 * por esta tela — restauração só via banco.
 */
export async function softDeleteOficina(
  supabase: SupabaseClient,
  id: string,
  input: { confirmationName: string },
  ctx: { adminId: string; ip: string | null },
): Promise<SoftDeleteOficinaResult> {
  const before = await getOficinaById(supabase, id);
  if (!before) {
    const err = new Error("oficina_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  if (!input.confirmationName || input.confirmationName.trim() !== before.nome.trim()) {
    const err = new Error("Confirme o nome da oficina para excluir.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  return withAdminAudit(
    supabase,
    () => ({
      adminId: ctx.adminId,
      acao: "oficina.soft_delete",
      entidade: "oficinas",
      entidadeId: id,
      ip: ctx.ip,
      payload: { before },
    }),
    async () => {
      const { error } = await supabase
        .from("oficinas")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null);
      if (error) throw new Error(`soft_delete_oficina_failed: ${error.message}`);
      return { ok: true as const, id };
    },
  );
}

/** Teto de itens por chamada de exclusão em massa (protege contra payload gigante). */
export const BULK_SOFT_DELETE_MAX = 100;

export type BulkSoftDeleteOficinasResult = {
  ok: true;
  /** Ids únicos recebidos (após dedupe). */
  requested: number;
  /** Quantas oficinas foram efetivamente marcadas como excluídas. */
  deleted: number;
};

/**
 * Soft delete em massa: marca `deleted_at` de várias oficinas de uma vez.
 * Mesma semântica do {@link softDeleteOficina} — oculta de todas as telas do
 * admin, preserva no banco e é irreversível por esta tela. Ids inexistentes ou
 * já excluídos são ignorados (não contam em `deleted`). Cada oficina realmente
 * excluída gera uma entrada de auditoria `oficina.soft_delete` (com `bulk: true`).
 *
 * A confirmação deliberada acontece na UI (digitar "EXCLUIR"); diferente do
 * delete individual, não exige o nome exato de cada oficina.
 */
export async function bulkSoftDeleteOficinas(
  supabase: SupabaseClient,
  ids: string[],
  ctx: { adminId: string; ip: string | null },
): Promise<BulkSoftDeleteOficinasResult> {
  const uniqueIds = Array.from(
    new Set((ids ?? []).map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
  );

  if (uniqueIds.length === 0) {
    const err = new Error("Selecione ao menos uma oficina.");
    Object.assign(err, { status: 400 });
    throw err;
  }
  if (uniqueIds.length > BULK_SOFT_DELETE_MAX) {
    const err = new Error(`Selecione no máximo ${BULK_SOFT_DELETE_MAX} oficinas por vez.`);
    Object.assign(err, { status: 400 });
    throw err;
  }

  // Só apaga (e audita) o que ainda está vivo; guarda o `before` de cada uma.
  const { data: rows, error: fetchError } = await supabase
    .from("oficinas")
    .select("*")
    .in("id", uniqueIds)
    .is("deleted_at", null);
  if (fetchError) throw new Error(`bulk_soft_delete_fetch_failed: ${fetchError.message}`);

  const alive = (rows ?? []) as Array<Record<string, unknown> & { id: string }>;
  if (alive.length === 0) {
    return { ok: true, requested: uniqueIds.length, deleted: 0 };
  }

  const aliveIds = alive.map((r) => r.id);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("oficinas")
    .update({ deleted_at: now, updated_at: now })
    .in("id", aliveIds)
    .is("deleted_at", null);
  if (updateError) throw new Error(`bulk_soft_delete_failed: ${updateError.message}`);

  // Auditoria: uma entrada por oficina (espelha a ação do delete individual).
  const auditRows = alive.map((before) => ({
    admin_id: ctx.adminId,
    acao: "oficina.soft_delete",
    entidade: "oficinas",
    entidade_id: before.id,
    payload: { before, bulk: true },
    ip: ctx.ip,
  }));
  const { error: auditError } = await supabase.from("admin_audit_log").insert(auditRows);
  if (auditError) throw new Error(`admin_audit_insert_failed: ${auditError.message}`);

  return { ok: true, requested: uniqueIds.length, deleted: aliveIds.length };
}
