import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Métricas da camada conversacional (CV7). A agregação pesada roda na RPC
// `get_conversational_metrics` (SQL); aqui só tipamos e complementamos com o
// status de qualidade do número.

export type ConversationalMetrics = {
  periodoDias: number;
  geracao: {
    total: number;
    enviadaGerada: number;
    enviadaEnlatada: number;
    reprovada: number;
  };
  porIntent: Array<{ intent: string; total: number }>;
  handoffEventos: number;
  conversasEmHandoff: number;
  conversasTotal: number;
  mensagens: { inbound: number; outbound: number };
};

export type PhoneStatus = {
  displayPhoneNumber: string;
  qualityRating: string | null;
  event: string | null;
  currentLimit: string | null;
  updatedAt: string;
};

export async function getConversationalMetrics(
  supabase: SupabaseClient,
  days = 7,
): Promise<ConversationalMetrics> {
  const { data, error } = await supabase.rpc("get_conversational_metrics", {
    p_days: days,
  });
  if (error) throw new Error(`conversational_metrics_failed: ${error.message}`);
  return data as ConversationalMetrics;
}

export async function getLatestPhoneStatus(
  supabase: SupabaseClient,
): Promise<PhoneStatus | null> {
  const { data, error } = await supabase
    .from("meta_phone_status")
    .select("display_phone_number, quality_rating, event, current_limit, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`phone_status_failed: ${error.message}`);
  if (!data) return null;
  return {
    displayPhoneNumber: data.display_phone_number,
    qualityRating: data.quality_rating,
    event: data.event,
    currentLimit: data.current_limit,
    updatedAt: data.updated_at,
  };
}

// Percentual seguro (evita divisão por zero).
export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
