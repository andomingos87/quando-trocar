import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type OficinasCounts = {
  ativas: number;
  em_teste: number;
  em_risco: number;
};

function startOfMonthIso(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

export async function getMrrEstimado(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("oficinas")
    .select("preco_negociado, planos:plano_id (preco_base)")
    .eq("status", "ativa");
  if (error) throw new Error(`mrr_failed: ${error.message}`);
  let total = 0;
  for (const row of data ?? []) {
    const planoRaw = (row as { planos: unknown }).planos;
    const plano = Array.isArray(planoRaw) ? planoRaw[0] : planoRaw;
    const negociado = (row as { preco_negociado: number | null }).preco_negociado;
    const base = (plano as { preco_base?: number } | null)?.preco_base ?? null;
    if (negociado !== null && negociado !== undefined) total += Number(negociado);
    else if (base !== null && base !== undefined) total += Number(base);
  }
  return total;
}

export async function getOficinasCounts(
  supabase: SupabaseClient,
): Promise<OficinasCounts> {
  const [{ count: ativas }, { count: emTeste }, { count: emRisco }] = await Promise.all([
    supabase
      .from("oficinas")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativa"),
    supabase
      .from("oficinas")
      .select("id", { count: "exact", head: true })
      .eq("plano", "teste"),
    supabase
      .from("oficinas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pausada")
      .eq("motivo_pausa", "inadimplencia"),
  ]);
  return {
    ativas: ativas ?? 0,
    em_teste: emTeste ?? 0,
    em_risco: emRisco ?? 0,
  };
}

export async function getNovasOficinasMes(
  supabase: SupabaseClient,
): Promise<number> {
  const since = startOfMonthIso();
  const { count, error } = await supabase
    .from("oficinas")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) throw new Error(`novas_oficinas_mes_failed: ${error.message}`);
  return count ?? 0;
}

export async function getReceitaRecebidaMes(
  supabase: SupabaseClient,
): Promise<number> {
  const since = startOfMonthIso();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("valor")
    .eq("status", "pago")
    .gte("paid_at", since);
  if (error) throw new Error(`receita_mes_failed: ${error.message}`);
  let total = 0;
  for (const p of data ?? []) {
    if (p.valor != null) total += Number(p.valor);
  }
  return total;
}

export async function getPagamentosPendentes(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (error) throw new Error(`pagamentos_pendentes_failed: ${error.message}`);
  return count ?? 0;
}

export async function getPagamentosFalhosMes(
  supabase: SupabaseClient,
): Promise<number> {
  const since = startOfMonthIso();
  const { count, error } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("status", "falhou")
    .gte("created_at", since);
  if (error) throw new Error(`pagamentos_falhos_failed: ${error.message}`);
  return count ?? 0;
}

export type AtividadeView = {
  id: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  admin_label: string;
  ip: string | null;
  created_at: string;
};

export async function getAtividadesRecentes(
  supabase: SupabaseClient,
  limit = 20,
): Promise<AtividadeView[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, acao, entidade, entidade_id, admin_id, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`atividades_failed: ${error.message}`);

  const adminIds = Array.from(
    new Set((data ?? []).map((a) => a.admin_id).filter((v): v is string => Boolean(v))),
  );
  const admins = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: rows } = await supabase
      .from("admin_users")
      .select("id, nome")
      .in("id", adminIds);
    for (const r of rows ?? []) {
      admins.set(r.id, r.nome);
    }
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    acao: a.acao,
    entidade: a.entidade,
    entidade_id: a.entidade_id,
    admin_label: a.admin_id ? admins.get(a.admin_id) ?? "Admin" : "Sistema",
    ip: a.ip,
    created_at: a.created_at,
  }));
}

// Helper para teste unitario sem network: calcula MRR a partir de rows in-memory.
export function calcMrrFromRows(
  rows: Array<{ status: string; preco_negociado: number | null; preco_base: number | null }>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status !== "ativa") continue;
    if (row.preco_negociado !== null && row.preco_negociado !== undefined) {
      total += Number(row.preco_negociado);
    } else if (row.preco_base !== null && row.preco_base !== undefined) {
      total += Number(row.preco_base);
    }
  }
  return total;
}
