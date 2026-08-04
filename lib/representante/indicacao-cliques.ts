import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cliques no link de indicacao (/r/<codigo>). Duas leituras distintas:
//   - resolveRepresentanteDoLinkPorCodigo + registrarClique: usadas pela ROTA
//     PUBLICA /r (visitante anonimo, ainda sem lead).
//   - getResumoIndicacao: usada pelo PORTAL, escopada por `representanteId` da
//     sessao (nunca do request), como toda leitura do modulo.
//
// LGPD: IP e user-agent so como hash (nunca em claro). Nao ha PII de cliente
// final aqui — o visitante e anonimo por definicao neste ponto do funil.

export type RepresentanteDoLink = { id: string; codigo: string };

export async function resolveRepresentanteDoLinkPorCodigo(
  supabase: SupabaseClient,
  codigo: string,
): Promise<RepresentanteDoLink | null> {
  const { data, error } = await supabase
    .from("representantes")
    .select("id, codigo")
    .ilike("codigo", codigo)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, codigo: data.codigo as string };
}

function hashOuNull(value: string | null | undefined): string | null {
  if (!value) return null;
  // Sal fixo por ambiente: impede reidentificacao por rainbow table sem
  // impedir a deduplicacao de cliques do mesmo visitante.
  const salt = process.env.REP_SESSION_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export async function registrarClique(
  supabase: SupabaseClient,
  input: {
    representanteId: string;
    codigo: string;
    clickToken: string;
    /** false quando o visitante ja estava na janela de outro rep. */
    atribuiu: boolean;
    referer?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("representante_link_cliques").insert({
    representante_id: input.representanteId,
    codigo: input.codigo,
    click_token: input.clickToken,
    atribuiu: input.atribuiu,
    referer: input.referer ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    ip_hash: hashOuNull(input.ip),
    user_agent_hash: hashOuNull(input.userAgent),
  });
  // Clique e telemetria: nunca deve derrubar o redirect do visitante.
  if (error) console.error("registrar_clique_indicacao_failed", error.message);
}

export type ResumoIndicacao = {
  cliques: number;
  cliquesAtribuidos: number;
  cliques30Dias: number;
  leadsAtribuidos: number;
};

export async function getResumoIndicacao(
  supabase: SupabaseClient,
  representanteId: string,
): Promise<ResumoIndicacao> {
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [cliquesResult, leadsResult] = await Promise.all([
    supabase
      .from("representante_link_cliques")
      .select("atribuiu, created_at")
      .eq("representante_id", representanteId),
    supabase
      .from("leads_oficina")
      .select("id", { count: "exact", head: true })
      .eq("representante_id", representanteId)
      .eq("representante_atribuido_via", "site_link")
      .is("deleted_at", null),
  ]);

  if (cliquesResult.error) {
    throw new Error(`get_resumo_indicacao_failed: ${cliquesResult.error.message}`);
  }

  const cliques = cliquesResult.data ?? [];
  return {
    cliques: cliques.length,
    cliquesAtribuidos: cliques.filter((c) => c.atribuiu === true).length,
    cliques30Dias: cliques.filter((c) => String(c.created_at) >= trintaDiasAtras).length,
    leadsAtribuidos: leadsResult.count ?? 0,
  };
}
