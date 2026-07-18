import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Leads atribuidos ao representante (ADR-0025, regras §18.7). O lead e uma
// OFICINA prospectada — o contato dele e o contato comercial legitimo do rep
// (nao e cliente final). SEGURANCA: `representanteId` vem da sessao, nunca do
// request.

export type LeadStatus =
  | "novo"
  | "em_conversa"
  | "qualificado"
  | "interessado"
  | "teste_aceito"
  | "convertido"
  | "perdido";

// Status que ainda estao "em aberto" no funil (nem convertido, nem perdido).
export const LEAD_STATUS_EM_ABERTO: LeadStatus[] = [
  "novo",
  "em_conversa",
  "qualificado",
  "interessado",
  "teste_aceito",
];

export type LeadDoRepresentante = {
  id: string;
  nomeOficina: string | null;
  responsavel: string | null;
  whatsapp: string;
  cidade: string | null;
  status: LeadStatus;
  emAberto: boolean;
  convertido: boolean;
  lastMessageAt: string | null;
  createdAt: string;
};

export async function listLeadsDoRepresentante(
  supabase: SupabaseClient,
  representanteId: string,
): Promise<LeadDoRepresentante[]> {
  const { data, error } = await supabase
    .from("leads_oficina")
    .select(
      `id, nome, nome_oficina, nome_responsavel, whatsapp, cidade, status,
       oficina_id, last_message_at, created_at`,
    )
    .eq("representante_id", representanteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`list_leads_do_representante_failed: ${error.message}`);

  return (data ?? []).map((l) => {
    const status = l.status as LeadStatus;
    return {
      id: l.id as string,
      nomeOficina:
        (l.nome_oficina as string | null) ?? (l.nome as string | null) ?? null,
      responsavel:
        (l.nome_responsavel as string | null) ?? (l.nome as string | null) ?? null,
      whatsapp: l.whatsapp as string,
      cidade: (l.cidade as string | null) ?? null,
      status,
      emAberto: LEAD_STATUS_EM_ABERTO.includes(status),
      convertido: status === "convertido" || l.oficina_id !== null,
      lastMessageAt: (l.last_message_at as string | null) ?? null,
      createdAt: l.created_at as string,
    };
  });
}
