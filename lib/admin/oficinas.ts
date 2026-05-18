import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";
import { normalizePhoneToE164 } from "./phone";

export type OficinaStatus = "ativa" | "pausada" | "cancelada";
export type OficinaOrigem = "landing_whatsapp" | "manual" | "importacao";
export type MotivoPausa = "inadimplencia" | "voluntaria" | "admin";

export type OficinaListRow = {
  id: string;
  nome: string;
  whatsapp_principal: string;
  cidade: string | null;
  status: OficinaStatus;
  origem: OficinaOrigem;
  motivo_pausa: MotivoPausa | null;
  plano_id: string | null;
  plano_nome: string | null;
  preco_base: number | null;
  preco_negociado: number | null;
  preco_efetivo: number | null;
  proximo_vencimento: string | null;
  ultima_atividade_em: string | null;
  created_at: string;
};

export type OficinaListFilters = {
  status?: OficinaStatus | "todas";
  plano_id?: string;
  origem?: OficinaOrigem;
  motivo_pausa?: MotivoPausa;
  busca?: string;
  page?: number;
  pageSize?: number;
};

export type OficinaListResult = {
  rows: OficinaListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type OficinaDetail = OficinaListRow & {
  responsavel: string | null;
};

export type OficinaCreateInput = {
  nome: string;
  whatsapp: string;
  cidade: string;
  plano_id: string;
  preco_negociado?: number | null;
  status?: "ativa" | "pausada";
  observacao?: string | null;
};

export type OficinaPatchInput = Partial<{
  status: OficinaStatus;
  motivo_pausa: MotivoPausa | null;
  plano_id: string;
  preco_negociado: number | null;
  cancelConfirmationName: string;
}>;

const DEFAULT_PAGE_SIZE = 50;

function precoEfetivo(plano: { preco_base: number | null }, preco_negociado: number | null): number | null {
  if (preco_negociado !== null && preco_negociado !== undefined) return Number(preco_negociado);
  if (plano.preco_base !== null && plano.preco_base !== undefined) return Number(plano.preco_base);
  return null;
}

export async function listOficinas(
  supabase: SupabaseClient,
  filters: OficinaListFilters = {},
): Promise<OficinaListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("oficinas")
    .select(
      `id, nome, whatsapp_principal, cidade, status, origem, motivo_pausa, plano_id, preco_negociado, proximo_vencimento, created_at,
       planos:plano_id (nome, preco_base)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }
  if (filters.plano_id) query = query.eq("plano_id", filters.plano_id);
  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.motivo_pausa) query = query.eq("motivo_pausa", filters.motivo_pausa);
  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim();
    const safe = term.replace(/[%,]/g, "");
    query = query.or(
      `nome.ilike.%${safe}%,whatsapp_principal.ilike.%${safe}%,cidade.ilike.%${safe}%`,
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

  const rows: OficinaListRow[] = (data ?? []).map((o) => {
    const planoRaw = o.planos as
      | { nome: string; preco_base: number }
      | { nome: string; preco_base: number }[]
      | null;
    const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;
    return {
      id: o.id,
      nome: o.nome,
      whatsapp_principal: o.whatsapp_principal,
      cidade: o.cidade,
      status: o.status,
      origem: o.origem,
      motivo_pausa: o.motivo_pausa,
      plano_id: o.plano_id,
      plano_nome: plano?.nome ?? null,
      preco_base: plano ? Number(plano.preco_base) : null,
      preco_negociado: o.preco_negociado !== null ? Number(o.preco_negociado) : null,
      preco_efetivo: precoEfetivo(
        { preco_base: plano?.preco_base ?? null },
        o.preco_negociado !== null ? Number(o.preco_negociado) : null,
      ),
      proximo_vencimento: o.proximo_vencimento,
      ultima_atividade_em: ultimaAtividade.get(o.id) ?? null,
      created_at: o.created_at,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export async function getOficinaById(
  supabase: SupabaseClient,
  id: string,
): Promise<OficinaDetail | null> {
  const { data, error } = await supabase
    .from("oficinas")
    .select(
      `id, nome, responsavel, whatsapp_principal, cidade, status, origem, motivo_pausa, plano_id, preco_negociado, proximo_vencimento, created_at,
       planos:plano_id (nome, preco_base)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get_oficina_failed: ${error.message}`);
  if (!data) return null;

  const planoRaw = data.planos as
    | { nome: string; preco_base: number }
    | { nome: string; preco_base: number }[]
    | null;
  const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;

  const { data: msgs } = await supabase
    .from("mensagens")
    .select("created_at")
    .eq("oficina_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const ultima = msgs?.[0]?.created_at as string | undefined;

  return {
    id: data.id,
    nome: data.nome,
    responsavel: data.responsavel,
    whatsapp_principal: data.whatsapp_principal,
    cidade: data.cidade,
    status: data.status,
    origem: data.origem,
    motivo_pausa: data.motivo_pausa,
    plano_id: data.plano_id,
    plano_nome: plano?.nome ?? null,
    preco_base: plano ? Number(plano.preco_base) : null,
    preco_negociado: data.preco_negociado !== null ? Number(data.preco_negociado) : null,
    preco_efetivo: precoEfetivo(
      { preco_base: plano?.preco_base ?? null },
      data.preco_negociado !== null ? Number(data.preco_negociado) : null,
    ),
    proximo_vencimento: data.proximo_vencimento,
    ultima_atividade_em: ultima ?? null,
    created_at: data.created_at,
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

export type RecentAuditEntry = {
  id: string;
  acao: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  admin_id: string | null;
};

export async function getRecentOficinaAudit(
  supabase: SupabaseClient,
  oficinaId: string,
  limit = 10,
): Promise<RecentAuditEntry[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, acao, payload, created_at, admin_id")
    .eq("entidade", "oficinas")
    .eq("entidade_id", oficinaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_oficina_audit_failed: ${error.message}`);
  return (data ?? []) as RecentAuditEntry[];
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

export type OficinaCreateValidationError = {
  field: "nome" | "whatsapp" | "cidade" | "plano_id" | "status";
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
      observacao: input.observacao?.trim() || null,
    },
  };
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
    .neq("status", "cancelada");
  if (existing && existing.length > 0) {
    const err = new Error("Ja existe oficina ativa com esse WhatsApp.");
    Object.assign(err, { status: 409 });
    throw err;
  }

  const status = input.status ?? "ativa";
  const proximoVencimento =
    status === "ativa"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

  return withAdminAudit(
    supabase,
    (result: { id: string }) => ({
      adminId: ctx.adminId,
      acao: "oficina.create_manual",
      entidade: "oficinas",
      entidadeId: result.id,
      ip: ctx.ip,
      payload: {
        input: {
          nome: input.nome,
          whatsapp: input.whatsapp,
          cidade: input.cidade,
          plano_id: input.plano_id,
          preco_negociado: input.preco_negociado,
          status,
          observacao: input.observacao,
        },
        proximo_vencimento: proximoVencimento,
      },
    }),
    async () => {
      const { data, error } = await supabase
        .from("oficinas")
        .insert({
          nome: input.nome,
          whatsapp_principal: input.whatsapp,
          cidade: input.cidade,
          plano_id: input.plano_id,
          preco_negociado: input.preco_negociado,
          status,
          origem: "manual",
          proximo_vencimento: proximoVencimento,
        })
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

  if (
    input.preco_negociado !== undefined &&
    Number(input.preco_negociado) !== Number(before.preco_negociado ?? Number.NaN)
  ) {
    patch.preco_negociado = input.preco_negociado;
    actions.push("oficina.update_preco");
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
