import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Analytics de anúncios (Meta Ads via Windsor.ai) x funil real do CRM. A
// agregação pesada roda na RPC `get_ads_analytics` (SQL); aqui só tipamos.
// Ver migration ads_analytics.

export type AdsAnalyticsOverview = {
  gasto: number;
  resultadosMeta: number;
  leads: number;
  qualificados: number;
  convertidos: number;
  custoPorLead: number | null;
  custoPorQualificado: number | null;
  cac: number | null;
};

export type AdsAnalyticsCampanha = {
  adId: string;
  adNome: string | null;
  campanhaId: string | null;
  campanhaNome: string;
  gasto: number;
  resultadosMeta: number;
  leads: number;
  qualificados: number;
  convertidos: number;
  custoPorLead: number | null;
  custoPorQualificado: number | null;
};

export type AdsAnalytics = {
  periodoDias: number;
  overview: AdsAnalyticsOverview;
  porCampanha: AdsAnalyticsCampanha[];
};

export async function getAdsAnalytics(
  supabase: SupabaseClient,
  days = 30,
): Promise<AdsAnalytics> {
  const { data, error } = await supabase.rpc("get_ads_analytics", { p_days: days });
  if (error) throw new Error(`ads_analytics_failed: ${error.message}`);
  return data as AdsAnalytics;
}

export async function hasAnyAdInsightsSynced(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("ad_insights_daily")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`ad_insights_daily_check_failed: ${error.message}`);
  return (count ?? 0) > 0;
}

export function formatBRL(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
