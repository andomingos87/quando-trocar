import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { LEAD_STATUS_EM_ABERTO } from "./leads";
import {
  getComissaoPagaAcumulada,
  getComissaoResumoMesDoRepresentante,
} from "./comissoes";

// Resumo da visao geral do representante (ADR-0025). Todos os numeros escopados
// por `representanteId` da sessao.
export type RepresentanteDashboard = {
  oficinasAtivas: number;
  leadsEmAberto: number;
  comissaoPrevistaMes: number;
  comissaoPagaAcumulada: number;
};

export async function getRepresentanteDashboard(
  supabase: SupabaseClient,
  representanteId: string,
  now: Date = new Date(),
): Promise<RepresentanteDashboard> {
  const [oficinasAtivasRes, leadsEmAbertoRes, resumoMes, pagaAcumulada] =
    await Promise.all([
      supabase
        .from("oficinas")
        .select("id", { count: "exact", head: true })
        .eq("representante_id", representanteId)
        .eq("status", "ativa")
        .is("deleted_at", null),
      supabase
        .from("leads_oficina")
        .select("id", { count: "exact", head: true })
        .eq("representante_id", representanteId)
        .is("deleted_at", null)
        .in("status", LEAD_STATUS_EM_ABERTO),
      getComissaoResumoMesDoRepresentante(supabase, representanteId, now),
      getComissaoPagaAcumulada(supabase, representanteId),
    ]);

  if (oficinasAtivasRes.error) {
    throw new Error(`dashboard_oficinas_ativas_failed: ${oficinasAtivasRes.error.message}`);
  }
  if (leadsEmAbertoRes.error) {
    throw new Error(`dashboard_leads_em_aberto_failed: ${leadsEmAbertoRes.error.message}`);
  }

  return {
    oficinasAtivas: oficinasAtivasRes.count ?? 0,
    leadsEmAberto: leadsEmAbertoRes.count ?? 0,
    comissaoPrevistaMes: resumoMes.previstoMes,
    comissaoPagaAcumulada: pagaAcumulada,
  };
}
