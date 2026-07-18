import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Carteira do representante (ADR-0025, regras §18.7). Lista as OFICINAS que o
// rep trouxe + numeros AGREGADOS de tracao. NUNCA retorna PII de cliente final
// (nome/WhatsApp): so contagens. O contato da propria oficina (responsavel,
// WhatsApp da oficina) e o contato comercial legitimo do rep e pode aparecer.
//
// SEGURANCA: `representanteId` vem SEMPRE da sessao (guard), nunca do request.
// Nao ha RLS por tenant (ADR-0003 estado real) — o escopo e este filtro.

export type OficinaStatus = "ativa" | "pausada" | "cancelada";

export type CarteiraOficina = {
  id: string;
  nome: string;
  cidade: string | null;
  status: OficinaStatus;
  responsavel: string | null;
  whatsapp: string;
  planoNome: string | null;
  precoMensal: number | null;
  ativaDesde: string;
  proximoVencimento: string | null;
  clientesFinaisCount: number;
  lembretesEnviados: number;
  lembretesRespondidos: number;
};

// Status de lembrete que ja passaram pela etapa de envio (tracao real).
const LEMBRETE_ENVIADO_STATUS = ["enviado", "respondido", "sem_resposta"];

export async function listOficinasDoRepresentante(
  supabase: SupabaseClient,
  representanteId: string,
): Promise<CarteiraOficina[]> {
  const { data, error } = await supabase
    .from("oficinas")
    .select(
      `id, nome, cidade, status, responsavel, whatsapp_principal,
       preco_negociado, created_at, proximo_vencimento,
       planos:plano_id (nome, preco_base)`,
    )
    .eq("representante_id", representanteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`list_oficinas_do_representante_failed: ${error.message}`);

  const oficinas = data ?? [];
  if (oficinas.length === 0) return [];

  const ids = oficinas.map((o) => o.id as string);

  // Agregados em bulk (mesmo padrao de listRepresentantes). So contagens —
  // nenhum campo de PII de cliente final e selecionado.
  const [clientesRes, lembretesRes] = await Promise.all([
    supabase
      .from("clientes_finais")
      .select("oficina_id")
      .in("oficina_id", ids)
      .is("deleted_at", null),
    supabase
      .from("lembretes")
      .select("oficina_id, status")
      .in("oficina_id", ids),
  ]);
  if (clientesRes.error) {
    throw new Error(`carteira_clientes_count_failed: ${clientesRes.error.message}`);
  }
  if (lembretesRes.error) {
    throw new Error(`carteira_lembretes_count_failed: ${lembretesRes.error.message}`);
  }

  const clientesCount = new Map<string, number>();
  for (const c of clientesRes.data ?? []) {
    const key = c.oficina_id as string;
    clientesCount.set(key, (clientesCount.get(key) ?? 0) + 1);
  }
  const enviadosCount = new Map<string, number>();
  const respondidosCount = new Map<string, number>();
  for (const l of lembretesRes.data ?? []) {
    const key = l.oficina_id as string;
    if (LEMBRETE_ENVIADO_STATUS.includes(l.status as string)) {
      enviadosCount.set(key, (enviadosCount.get(key) ?? 0) + 1);
    }
    if (l.status === "respondido") {
      respondidosCount.set(key, (respondidosCount.get(key) ?? 0) + 1);
    }
  }

  return oficinas.map((o) => {
    const planoRaw = (o as { planos?: unknown }).planos;
    const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;
    const precoBase = (plano as { preco_base?: number | string } | null)?.preco_base;
    const precoNegociado = (o as { preco_negociado?: number | string | null }).preco_negociado;
    const precoMensal =
      precoNegociado !== null && precoNegociado !== undefined
        ? Number(precoNegociado)
        : precoBase !== null && precoBase !== undefined
          ? Number(precoBase)
          : null;
    const id = o.id as string;
    return {
      id,
      nome: o.nome as string,
      cidade: (o.cidade as string | null) ?? null,
      status: o.status as OficinaStatus,
      responsavel: (o.responsavel as string | null) ?? null,
      whatsapp: o.whatsapp_principal as string,
      planoNome: (plano as { nome?: string } | null)?.nome ?? null,
      precoMensal,
      ativaDesde: o.created_at as string,
      proximoVencimento: (o.proximo_vencimento as string | null) ?? null,
      clientesFinaisCount: clientesCount.get(id) ?? 0,
      lembretesEnviados: enviadosCount.get(id) ?? 0,
      lembretesRespondidos: respondidosCount.get(id) ?? 0,
    };
  });
}
