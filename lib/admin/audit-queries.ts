import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditFilters = {
  admin_id?: string;
  entidade?: string;
  acao?: string;
  data_inicio?: string;
  data_fim?: string;
  entidade_id?: string;
  page?: number;
  pageSize?: number;
};

export type AuditEntryView = {
  id: string;
  admin_id: string | null;
  admin_label: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  payload: unknown;
  ip: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 50;

export async function listAuditEntries(
  supabase: SupabaseClient,
  filters: AuditFilters = {},
): Promise<{ rows: AuditEntryView[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("admin_audit_log")
    .select("id, admin_id, acao, entidade, entidade_id, payload, ip, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.admin_id) query = query.eq("admin_id", filters.admin_id);
  if (filters.entidade) query = query.eq("entidade", filters.entidade);
  if (filters.acao) query = query.eq("acao", filters.acao);
  if (filters.entidade_id) query = query.eq("entidade_id", filters.entidade_id);
  if (filters.data_inicio) query = query.gte("created_at", filters.data_inicio);
  if (filters.data_fim) query = query.lte("created_at", filters.data_fim);

  const { data, count, error } = await query;
  if (error) throw new Error(`list_audit_failed: ${error.message}`);

  const adminIds = Array.from(
    new Set(
      (data ?? [])
        .map((r) => r.admin_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const admins = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: rows } = await supabase
      .from("admin_users")
      .select("id, nome")
      .in("id", adminIds);
    for (const r of rows ?? []) admins.set(r.id, r.nome);
  }

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      admin_id: r.admin_id,
      admin_label: r.admin_id ? admins.get(r.admin_id) ?? "Admin" : "Sistema",
      acao: r.acao,
      entidade: r.entidade,
      entidade_id: r.entidade_id,
      payload: r.payload,
      ip: r.ip,
      created_at: r.created_at,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listKnownAcoes(
  supabase: SupabaseClient,
  limit = 100,
): Promise<string[]> {
  const { data } = await supabase
    .from("admin_audit_log")
    .select("acao")
    .limit(limit);
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.acao);
  return Array.from(set).sort();
}

export async function listKnownEntidades(
  supabase: SupabaseClient,
  limit = 100,
): Promise<string[]> {
  const { data } = await supabase
    .from("admin_audit_log")
    .select("entidade")
    .limit(limit);
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.entidade);
  return Array.from(set).sort();
}
