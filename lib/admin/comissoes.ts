import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

// ADR-0019: comissao de representantes. A regra vigente (global + override do
// representante) e congelada como snapshot na linha de `comissoes` no momento
// em que o pagamento confirma — mudar a configuracao depois nao altera
// comissoes ja geradas.

export type ComissaoTipo = "percentual" | "fixo";
export type ComissaoBase = "valor_pago" | "preco_tabela";
export type ComissaoStatus = "prevista" | "paga" | "cancelada";

export type ConfiguracoesComissaoRow = {
  id: string;
  comissao_tipo: ComissaoTipo;
  comissao_valor: number;
  comissao_duracao_meses: number | null;
  comissao_base: ComissaoBase;
  updated_at: string;
};

export type ConfiguracoesComissaoUpdate = {
  comissao_tipo?: ComissaoTipo;
  comissao_valor?: number;
  comissao_duracao_meses?: number | null;
  comissao_base?: ComissaoBase;
};

export type ConfiguracoesComissaoValidationError = {
  field: keyof ConfiguracoesComissaoUpdate;
  message: string;
};

export function validateConfiguracoesComissaoInput(
  input: ConfiguracoesComissaoUpdate,
): ConfiguracoesComissaoValidationError | null {
  if (input.comissao_tipo !== undefined) {
    if (input.comissao_tipo !== "percentual" && input.comissao_tipo !== "fixo") {
      return { field: "comissao_tipo", message: "Tipo deve ser 'percentual' ou 'fixo'." };
    }
  }
  if (input.comissao_valor !== undefined) {
    const v = input.comissao_valor;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { field: "comissao_valor", message: "Valor deve ser numero >= 0." };
    }
  }
  if (input.comissao_duracao_meses !== undefined && input.comissao_duracao_meses !== null) {
    const d = input.comissao_duracao_meses;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 1) {
      return {
        field: "comissao_duracao_meses",
        message: "Duracao deve ser inteiro >= 1 (ou vazio para vitalicia).",
      };
    }
  }
  if (input.comissao_base !== undefined) {
    if (input.comissao_base !== "valor_pago" && input.comissao_base !== "preco_tabela") {
      return {
        field: "comissao_base",
        message: "Base deve ser 'valor_pago' ou 'preco_tabela'.",
      };
    }
  }
  return null;
}

export async function getConfiguracoesComissao(
  supabase: SupabaseClient,
): Promise<ConfiguracoesComissaoRow> {
  const { data, error } = await supabase
    .from("configuracoes_comissao")
    .select("id, comissao_tipo, comissao_valor, comissao_duracao_meses, comissao_base, updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_configuracoes_comissao_failed: ${error.message}`);
  if (!data) throw new Error("configuracoes_comissao_not_seeded");
  return {
    ...data,
    comissao_valor: Number(data.comissao_valor),
  };
}

export async function updateConfiguracoesComissao(
  supabase: SupabaseClient,
  input: ConfiguracoesComissaoUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<ConfiguracoesComissaoRow> {
  const validation = validateConfiguracoesComissaoInput(input);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  const before = await getConfiguracoesComissao(supabase);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: ctx.adminId,
  };
  if (input.comissao_tipo !== undefined) patch.comissao_tipo = input.comissao_tipo;
  if (input.comissao_valor !== undefined) patch.comissao_valor = input.comissao_valor;
  if (input.comissao_duracao_meses !== undefined) {
    patch.comissao_duracao_meses = input.comissao_duracao_meses;
  }
  if (input.comissao_base !== undefined) patch.comissao_base = input.comissao_base;

  return withAdminAudit(
    supabase,
    (after: ConfiguracoesComissaoRow) => ({
      adminId: ctx.adminId,
      acao: "configuracoes_comissao.update",
      entidade: "configuracoes_comissao",
      entidadeId: before.id,
      ip: ctx.ip,
      payload: { before, after },
    }),
    async () => {
      const { data, error } = await supabase
        .from("configuracoes_comissao")
        .update(patch)
        .eq("id", before.id)
        .select(
          "id, comissao_tipo, comissao_valor, comissao_duracao_meses, comissao_base, updated_at",
        )
        .single();
      if (error) throw new Error(`update_configuracoes_comissao_failed: ${error.message}`);
      return { ...data, comissao_valor: Number(data.comissao_valor) };
    },
  );
}

// ----------------------------------------------------------------------------
// Resolucao da regra vigente (override do representante ?? default global)
// ----------------------------------------------------------------------------

export type RepresentanteComissaoOverride = {
  comissao_tipo: ComissaoTipo | null;
  comissao_valor: number | null;
  comissao_duracao_meses: number | null;
};

export type RegraComissao = {
  tipo: ComissaoTipo;
  valor: number;
  duracaoMeses: number | null;
  base: ComissaoBase;
};

export function resolverRegraComissao(
  config: Pick<
    ConfiguracoesComissaoRow,
    "comissao_tipo" | "comissao_valor" | "comissao_duracao_meses" | "comissao_base"
  >,
  representante: RepresentanteComissaoOverride,
): RegraComissao {
  // Override atomico: tipo+valor andam juntos (constraint no banco).
  const temOverride =
    representante.comissao_tipo !== null && representante.comissao_valor !== null;
  return {
    tipo: temOverride ? representante.comissao_tipo! : config.comissao_tipo,
    valor: temOverride ? Number(representante.comissao_valor) : Number(config.comissao_valor),
    duracaoMeses: representante.comissao_duracao_meses ?? config.comissao_duracao_meses,
    base: config.comissao_base,
  };
}

export function calcularValorComissao(regra: RegraComissao, baseValor: number): number {
  if (regra.tipo === "fixo") return Math.round(regra.valor * 100) / 100;
  return Math.round(baseValor * (regra.valor / 100) * 100) / 100;
}

// ----------------------------------------------------------------------------
// Geracao (chamada pelo webhook MP quando pagamento confirma)
// ----------------------------------------------------------------------------

export type GerarComissaoResult =
  | { ok: true; comissaoId: string; valor: number }
  | {
      ok: false;
      reason:
        | "pagamento_not_found"
        | "pagamento_nao_pago"
        | "sem_representante"
        | "representante_inativo"
        | "ja_existe"
        | "duracao_expirada"
        | "valor_zero";
    };

export async function gerarComissaoParaPagamento(
  supabase: SupabaseClient,
  pagamentoId: string,
): Promise<GerarComissaoResult> {
  const { data: pagamento, error: pagError } = await supabase
    .from("pagamentos")
    .select("id, oficina_id, valor, status, paid_at")
    .eq("id", pagamentoId)
    .maybeSingle();
  if (pagError) throw new Error(`gerar_comissao_pagamento_failed: ${pagError.message}`);
  if (!pagamento) return { ok: false, reason: "pagamento_not_found" };
  if (pagamento.status !== "pago") return { ok: false, reason: "pagamento_nao_pago" };

  // Idempotencia: comissao ja gerada para este pagamento?
  const { data: existente } = await supabase
    .from("comissoes")
    .select("id")
    .eq("pagamento_id", pagamentoId)
    .maybeSingle();
  if (existente) return { ok: false, reason: "ja_existe" };

  const { data: oficina, error: ofError } = await supabase
    .from("oficinas")
    .select(
      `id, representante_id, preco_negociado, plano_id,
       planos:plano_id (preco_base)`,
    )
    .eq("id", pagamento.oficina_id)
    .maybeSingle();
  if (ofError) throw new Error(`gerar_comissao_oficina_failed: ${ofError.message}`);
  if (!oficina?.representante_id) return { ok: false, reason: "sem_representante" };

  const { data: representante } = await supabase
    .from("representantes")
    .select("id, ativo, deleted_at, comissao_tipo, comissao_valor, comissao_duracao_meses")
    .eq("id", oficina.representante_id)
    .maybeSingle();
  if (!representante || !representante.ativo || representante.deleted_at) {
    return { ok: false, reason: "representante_inativo" };
  }

  const config = await getConfiguracoesComissao(supabase);
  const regra = resolverRegraComissao(config, {
    comissao_tipo: (representante.comissao_tipo as ComissaoTipo | null) ?? null,
    comissao_valor:
      representante.comissao_valor === null ? null : Number(representante.comissao_valor),
    comissao_duracao_meses: representante.comissao_duracao_meses,
  });

  // Duracao: so os N primeiros pagamentos pagos da oficina geram comissao.
  if (regra.duracaoMeses !== null) {
    const { count } = await supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("oficina_id", pagamento.oficina_id)
      .eq("status", "pago")
      .neq("id", pagamentoId);
    if ((count ?? 0) >= regra.duracaoMeses) {
      return { ok: false, reason: "duracao_expirada" };
    }
  }

  const planoRaw = (oficina as { planos?: unknown }).planos;
  const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;
  const precoBase = (plano as { preco_base?: number | string } | null)?.preco_base;
  const baseValor =
    regra.base === "preco_tabela" && precoBase !== null && precoBase !== undefined
      ? Number(precoBase)
      : Number(pagamento.valor);

  const valor = calcularValorComissao(regra, baseValor);
  if (valor <= 0) return { ok: false, reason: "valor_zero" };

  const { data: inserted, error: insertError } = await supabase
    .from("comissoes")
    .insert({
      representante_id: oficina.representante_id,
      oficina_id: pagamento.oficina_id,
      pagamento_id: pagamentoId,
      base_valor: baseValor,
      tipo: regra.tipo,
      taxa_aplicada: regra.valor,
      valor,
      status: "prevista",
    })
    .select("id")
    .single();
  if (insertError) {
    // Corrida com outro webhook: UNIQUE(pagamento_id) segura a duplicata.
    if (insertError.code === "23505") return { ok: false, reason: "ja_existe" };
    throw new Error(`insert_comissao_failed: ${insertError.message}`);
  }

  return { ok: true, comissaoId: inserted.id, valor };
}

// ----------------------------------------------------------------------------
// Extrato e payout (painel admin)
// ----------------------------------------------------------------------------

export type ComissaoListFilters = {
  representante_id?: string;
  status?: ComissaoStatus;
  mes?: string; // "YYYY-MM"
  page?: number;
  pageSize?: number;
};

export type ComissaoRow = {
  id: string;
  representante_id: string;
  representante_nome: string | null;
  oficina_id: string;
  oficina_nome: string | null;
  pagamento_id: string;
  base_valor: number;
  tipo: ComissaoTipo;
  taxa_aplicada: number;
  valor: number;
  status: ComissaoStatus;
  paga_em: string | null;
  cancelada_motivo: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 50;

function mesToRange(mes: string): { fromIso: string; toIso: string } | null {
  const match = mes.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export async function listComissoes(
  supabase: SupabaseClient,
  filters: ComissaoListFilters = {},
): Promise<{
  rows: ComissaoRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPrevisto: number;
  totalPago: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("comissoes")
    .select(
      `id, representante_id, oficina_id, pagamento_id, base_valor, tipo, taxa_aplicada,
       valor, status, paga_em, cancelada_motivo, created_at,
       representantes:representante_id (nome),
       oficinas:oficina_id (nome)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  let totalsQuery = supabase.from("comissoes").select("valor, status");

  if (filters.representante_id) {
    query = query.eq("representante_id", filters.representante_id);
    totalsQuery = totalsQuery.eq("representante_id", filters.representante_id);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.mes) {
    const range = mesToRange(filters.mes);
    if (range) {
      query = query.gte("created_at", range.fromIso).lt("created_at", range.toIso);
      totalsQuery = totalsQuery.gte("created_at", range.fromIso).lt("created_at", range.toIso);
    }
  }

  const [{ data, count, error }, { data: totalsData, error: totalsError }] = await Promise.all([
    query,
    totalsQuery,
  ]);
  if (error) throw new Error(`list_comissoes_failed: ${error.message}`);
  if (totalsError) throw new Error(`list_comissoes_totais_failed: ${totalsError.message}`);

  let totalPrevisto = 0;
  let totalPago = 0;
  for (const r of totalsData ?? []) {
    if (r.status === "prevista") totalPrevisto += Number(r.valor);
    if (r.status === "paga") totalPago += Number(r.valor);
  }

  return {
    rows: (data ?? []).map((r) => {
      const repRaw = (r as { representantes?: unknown }).representantes;
      const rep = Array.isArray(repRaw) ? repRaw[0] : repRaw;
      const ofRaw = (r as { oficinas?: unknown }).oficinas;
      const oficina = Array.isArray(ofRaw) ? ofRaw[0] : ofRaw;
      return {
        id: r.id,
        representante_id: r.representante_id,
        representante_nome: (rep as { nome?: string } | null)?.nome ?? null,
        oficina_id: r.oficina_id,
        oficina_nome: (oficina as { nome?: string } | null)?.nome ?? null,
        pagamento_id: r.pagamento_id,
        base_valor: Number(r.base_valor),
        tipo: r.tipo as ComissaoTipo,
        taxa_aplicada: Number(r.taxa_aplicada),
        valor: Number(r.valor),
        status: r.status as ComissaoStatus,
        paga_em: r.paga_em,
        cancelada_motivo: r.cancelada_motivo,
        created_at: r.created_at,
      };
    }),
    total: count ?? 0,
    page,
    pageSize,
    totalPrevisto: Math.round(totalPrevisto * 100) / 100,
    totalPago: Math.round(totalPago * 100) / 100,
  };
}

export async function marcarComissaoPaga(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true }> {
  const { data: comissao } = await supabase
    .from("comissoes")
    .select("id, status, representante_id, valor")
    .eq("id", id)
    .maybeSingle();
  if (!comissao) {
    const err = new Error("comissao_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (comissao.status !== "prevista") {
    const err = new Error("Somente comissoes previstas podem ser marcadas como pagas.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("comissoes")
    .update({ status: "paga", paga_em: nowIso, updated_at: nowIso })
    .eq("id", id)
    .eq("status", "prevista");
  if (error) throw new Error(`marcar_comissao_paga_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "comissao.marcar_paga",
    entidade: "comissoes",
    entidade_id: id,
    payload: { representante_id: comissao.representante_id, valor: Number(comissao.valor) },
    ip: ctx.ip,
  });

  return { ok: true };
}

export async function marcarComissoesPagasLote(
  supabase: SupabaseClient,
  input: { representante_id: string; mes?: string },
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; quantidade: number; valorTotal: number }> {
  let query = supabase
    .from("comissoes")
    .select("id, valor")
    .eq("representante_id", input.representante_id)
    .eq("status", "prevista");
  if (input.mes) {
    const range = mesToRange(input.mes);
    if (!range) {
      const err = new Error("Mes invalido (formato YYYY-MM).");
      Object.assign(err, { status: 400 });
      throw err;
    }
    query = query.gte("created_at", range.fromIso).lt("created_at", range.toIso);
  }
  const { data: previstas, error: listError } = await query;
  if (listError) throw new Error(`lote_comissoes_list_failed: ${listError.message}`);
  if (!previstas || previstas.length === 0) {
    return { ok: true, quantidade: 0, valorTotal: 0 };
  }

  const ids = previstas.map((c) => c.id);
  const valorTotal =
    Math.round(previstas.reduce((acc, c) => acc + Number(c.valor), 0) * 100) / 100;

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("comissoes")
    .update({ status: "paga", paga_em: nowIso, updated_at: nowIso })
    .in("id", ids)
    .eq("status", "prevista");
  if (error) throw new Error(`lote_comissoes_update_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "comissao.marcar_paga_lote",
    entidade: "comissoes",
    entidade_id: null,
    payload: {
      representante_id: input.representante_id,
      mes: input.mes ?? null,
      quantidade: ids.length,
      valor_total: valorTotal,
      comissao_ids: ids,
    },
    ip: ctx.ip,
  });

  return { ok: true, quantidade: ids.length, valorTotal };
}

export async function cancelarComissao(
  supabase: SupabaseClient,
  id: string,
  input: { motivo: string },
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true }> {
  const motivo = input.motivo?.trim();
  if (!motivo) {
    const err = new Error("Motivo obrigatorio.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  const { data: comissao } = await supabase
    .from("comissoes")
    .select("id, status, representante_id, valor")
    .eq("id", id)
    .maybeSingle();
  if (!comissao) {
    const err = new Error("comissao_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (comissao.status !== "prevista") {
    const err = new Error("Somente comissoes previstas podem ser canceladas.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("comissoes")
    .update({ status: "cancelada", cancelada_motivo: motivo, updated_at: nowIso })
    .eq("id", id)
    .eq("status", "prevista");
  if (error) throw new Error(`cancelar_comissao_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "comissao.cancelar",
    entidade: "comissoes",
    entidade_id: id,
    payload: {
      motivo,
      representante_id: comissao.representante_id,
      valor: Number(comissao.valor),
    },
    ip: ctx.ip,
  });

  return { ok: true };
}

// Card do dashboard: comissao do mes corrente (previsto + pago).
export async function getComissaoResumoMes(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ previstoMes: number; pagoMes: number }> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const { data, error } = await supabase
    .from("comissoes")
    .select("valor, status")
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) throw new Error(`comissao_resumo_mes_failed: ${error.message}`);

  let previsto = 0;
  let pago = 0;
  for (const r of data ?? []) {
    if (r.status === "prevista") previsto += Number(r.valor);
    if (r.status === "paga") pago += Number(r.valor);
  }
  return {
    previstoMes: Math.round(previsto * 100) / 100,
    pagoMes: Math.round(pago * 100) / 100,
  };
}
