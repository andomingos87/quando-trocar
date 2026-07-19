import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

// Volante de aprendizado (CV5, QTR-14 / ADR-0023): perguntas que o modo respond
// não soube responder (`dontKnow`). O admin transforma cada uma em FAQ (o bot
// aprende sem deploy) ou marca como ignorada.

export type PerguntaSemRespostaStatus = "aberta" | "resolvida" | "ignorada";

// Uma pergunta agregada por frequência (mesmo texto, várias ocorrências).
export type PerguntaAgrupada = {
  pergunta: string;
  ocorrencias: number;
  agentMode: string;
  ultimaEm: string;
  respostaEnviada: string;
};

type PerguntaRow = {
  pergunta: string;
  agent_mode: string;
  resposta_enviada: string;
  created_at: string;
};

// Normaliza o texto só para AGRUPAR (não altera o que é exibido/salvo).
function groupKey(pergunta: string): string {
  return pergunta.trim().toLowerCase().replace(/\s+/g, " ");
}

// Lista as perguntas abertas agrupadas por texto, ordenadas por frequência
// (mais frequentes primeiro) e depois pela mais recente. Agregação em memória:
// a fila de perguntas sem resposta é pequena por natureza.
export async function listPerguntasAbertas(
  supabase: SupabaseClient,
  { limit = 500 }: { limit?: number } = {},
): Promise<PerguntaAgrupada[]> {
  const { data, error } = await supabase
    .from("perguntas_sem_resposta")
    .select("pergunta, agent_mode, resposta_enviada, created_at")
    .eq("status", "aberta")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`list_perguntas_failed: ${error.message}`);

  const groups = new Map<string, PerguntaAgrupada>();
  for (const row of (data ?? []) as PerguntaRow[]) {
    const key = groupKey(row.pergunta);
    const existing = groups.get(key);
    if (existing) {
      existing.ocorrencias += 1;
      // Mantém a ocorrência mais recente como representativa (data já vem desc).
    } else {
      groups.set(key, {
        pergunta: row.pergunta,
        ocorrencias: 1,
        agentMode: row.agent_mode,
        ultimaEm: row.created_at,
        respostaEnviada: row.resposta_enviada,
      });
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (b.ocorrencias !== a.ocorrencias) return b.ocorrencias - a.ocorrencias;
    return b.ultimaEm.localeCompare(a.ultimaEm);
  });
}

// Marca TODAS as ocorrências abertas de um texto de pergunta como resolvida
// (virou FAQ) ou ignorada. Case-insensitive no texto para casar o agrupamento.
export async function marcarPergunta(
  supabase: SupabaseClient,
  input: { pergunta: string; status: Exclude<PerguntaSemRespostaStatus, "aberta"> },
  ctx: { adminId: string; ip: string | null },
): Promise<{ atualizadas: number }> {
  const pergunta = input.pergunta.trim();
  if (pergunta.length === 0) {
    const err = new Error("pergunta obrigatoria");
    Object.assign(err, { status: 400 });
    throw err;
  }
  if (input.status !== "resolvida" && input.status !== "ignorada") {
    const err = new Error("status invalido");
    Object.assign(err, { status: 400 });
    throw err;
  }

  return withAdminAudit(
    supabase,
    (result: { atualizadas: number }) => ({
      adminId: ctx.adminId,
      acao: `pergunta_sem_resposta.${input.status}`,
      entidade: "perguntas_sem_resposta",
      entidadeId: null,
      ip: ctx.ip,
      payload: { pergunta, ...result },
    }),
    async () => {
      const { data, error } = await supabase
        .from("perguntas_sem_resposta")
        .update({ status: input.status })
        .eq("status", "aberta")
        .ilike("pergunta", pergunta)
        .select("id");
      if (error) throw new Error(`marcar_pergunta_failed: ${error.message}`);
      return { atualizadas: (data ?? []).length };
    },
  );
}
