import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Leitura minima do representante para autenticacao/guard (ADR-0025). Sempre
// filtra `ativo = true` e `deleted_at is null`: um representante desativado ou
// excluido no meio da sessao perde o acesso na proxima requisicao.

export type RepresentanteAtivo = {
  id: string;
  nome: string;
  whatsapp: string;
  codigo: string;
};

const ATIVO_COLUMNS = "id, nome, whatsapp, codigo";

export async function getActiveRepresentanteById(
  supabase: SupabaseClient,
  id: string,
): Promise<RepresentanteAtivo | null> {
  const { data, error } = await supabase
    .from("representantes")
    .select(ATIVO_COLUMNS)
    .eq("id", id)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`get_active_representante_by_id_failed: ${error.message}`);
  return data ?? null;
}

export async function getActiveRepresentanteByWhatsapp(
  supabase: SupabaseClient,
  whatsapp: string,
): Promise<RepresentanteAtivo | null> {
  const { data, error } = await supabase
    .from("representantes")
    .select(ATIVO_COLUMNS)
    .eq("whatsapp", whatsapp)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`get_active_representante_by_whatsapp_failed: ${error.message}`);
  return data ?? null;
}
