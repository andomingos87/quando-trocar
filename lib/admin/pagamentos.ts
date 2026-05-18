import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PagamentoListFilters = {
  status?: "pendente" | "pago" | "falhou" | "cancelado";
  oficina_id?: string;
  periodo?: "7d" | "30d" | "90d";
  page?: number;
  pageSize?: number;
};

export type PagamentoRow = {
  id: string;
  oficina_id: string;
  oficina_nome: string | null;
  valor: number;
  status: string;
  vencimento: string | null;
  paid_at: string | null;
  tentativa: number;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 50;

function periodoToIso(periodo: PagamentoListFilters["periodo"]): string | undefined {
  if (!periodo) return undefined;
  const days = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function listPagamentos(
  supabase: SupabaseClient,
  filters: PagamentoListFilters = {},
): Promise<{ rows: PagamentoRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("pagamentos")
    .select(
      `id, oficina_id, valor, status, vencimento, paid_at, tentativa, mp_payment_id, mp_preference_id, created_at,
       oficinas:oficina_id (nome)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);
  const sinceIso = periodoToIso(filters.periodo);
  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { data, count, error } = await query;
  if (error) throw new Error(`list_pagamentos_failed: ${error.message}`);

  return {
    rows: (data ?? []).map((r) => {
      const oficinaRaw = (r as { oficinas?: unknown }).oficinas;
      const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] : oficinaRaw;
      return {
        id: r.id,
        oficina_id: r.oficina_id,
        oficina_nome: (oficina as { nome?: string } | null)?.nome ?? null,
        valor: Number(r.valor),
        status: r.status,
        vencimento: r.vencimento,
        paid_at: r.paid_at,
        tentativa: r.tentativa,
        mp_payment_id: r.mp_payment_id,
        mp_preference_id: r.mp_preference_id,
        created_at: r.created_at,
      };
    }),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function cancelarPagamentoPendente(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; justificativa: string; ip: string | null },
): Promise<{ ok: true }> {
  const { data: pagamento } = await supabase
    .from("pagamentos")
    .select("id, status, oficina_id")
    .eq("id", id)
    .maybeSingle();
  if (!pagamento) {
    const err = new Error("pagamento_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (pagamento.status !== "pendente") {
    const err = new Error("Somente pagamentos pendentes podem ser cancelados.");
    Object.assign(err, { status: 400 });
    throw err;
  }
  const { error } = await supabase
    .from("pagamentos")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`cancel_pagamento_failed: ${error.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "pagamento.cancelado_manual",
    entidade: "pagamentos",
    entidade_id: id,
    payload: { justificativa: ctx.justificativa, oficina_id: pagamento.oficina_id },
    ip: ctx.ip,
  });

  return { ok: true };
}
