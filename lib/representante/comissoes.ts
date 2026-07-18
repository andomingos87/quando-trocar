import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type ComissaoStatus, listComissoes } from "@/lib/admin/comissoes";

// Wrapper read-only de comissoes para o portal do representante (ADR-0025).
// REUTILIZA `listComissoes` do admin (ja escopavel), mas INJETA o
// `representanteId` da sessao — o chamador nunca passa `representante_id`. Isso
// garante que um rep so ve as proprias comissoes, mesmo compartilhando a funcao.

// Filtros que o rep pode aplicar. Note a AUSENCIA de `representante_id`: ele e
// sempre da sessao, nao do request.
export type RepresentanteComissaoFilters = {
  status?: ComissaoStatus;
  mes?: string; // "YYYY-MM"
  page?: number;
  pageSize?: number;
};

export async function listComissoesDoRepresentante(
  supabase: SupabaseClient,
  representanteId: string,
  filters: RepresentanteComissaoFilters = {},
) {
  return listComissoes(supabase, {
    status: filters.status,
    mes: filters.mes,
    page: filters.page,
    pageSize: filters.pageSize,
    representante_id: representanteId,
  });
}

// Resumo do mes corrente para ESTE representante (previsto + pago). Diferente do
// `getComissaoResumoMes` do admin, que e global.
export async function getComissaoResumoMesDoRepresentante(
  supabase: SupabaseClient,
  representanteId: string,
  now: Date = new Date(),
): Promise<{ previstoMes: number; pagoMes: number }> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const { data, error } = await supabase
    .from("comissoes")
    .select("valor, status")
    .eq("representante_id", representanteId)
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) throw new Error(`comissao_resumo_mes_representante_failed: ${error.message}`);

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

// Comissao paga ACUMULADA (todo o periodo) para este representante.
export async function getComissaoPagaAcumulada(
  supabase: SupabaseClient,
  representanteId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("comissoes")
    .select("valor")
    .eq("representante_id", representanteId)
    .eq("status", "paga");
  if (error) throw new Error(`comissao_paga_acumulada_failed: ${error.message}`);
  const total = (data ?? []).reduce((acc, r) => acc + Number(r.valor), 0);
  return Math.round(total * 100) / 100;
}
