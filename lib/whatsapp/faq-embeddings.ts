import OpenAI from "openai";

import type { FaqVendasRecord } from "./types";

// Busca semântica na FAQ (CV5, QTR-14). Gera embeddings da pergunta do usuário
// e das FAQs (OpenAI text-embedding-3-small, 1536 dims) e acha a FAQ mais
// parecida por similaridade de cosseno. TODO o caminho é best-effort: sem chave,
// sem modelo, erro ou timeout → null → o caller cai no match por keyword atual.

export const FAQ_EMBEDDING_MODEL_DEFAULT = "text-embedding-3-small";
export const FAQ_EMBEDDING_DIMENSIONS = 1536;
// Similaridade de cosseno mínima para considerar a FAQ um match. Calibrado para
// pegar paráfrase ("quanto sai por mês?" ~ "quanto custa?") sem casar frases
// não relacionadas. Ajustável sem deploy só mudando a env, se preciso.
export const FAQ_SIMILARITY_THRESHOLD_DEFAULT = 0.5;

const EMBEDDING_TIMEOUT_MS = 3000;

export interface FaqEmbedder {
  // Devolve o vetor do texto, ou null quando não deve/não conseguiu gerar.
  embed(text: string): Promise<number[] | null>;
}

// Forma textual canônica de um vetor pgvector ("[a,b,c]"). Usada no store
// (backfill do admin) e na RPC de busca semântica.
export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// Texto canônico embutido por FAQ: pergunta + palavras-chave + resposta. Inclui
// as keywords porque elas carregam sinônimos que o admin cadastrou de propósito.
export function faqEmbeddingText(faq: {
  pergunta: string;
  resposta: string;
  palavras_chave?: string[];
}): string {
  const keywords = (faq.palavras_chave ?? []).join(", ");
  return [faq.pergunta, keywords, faq.resposta]
    .filter((part) => part && part.trim().length > 0)
    .join("\n");
}

export class OpenAiFaqEmbedder implements FaqEmbedder {
  private openai: OpenAI | null;
  private model: string;

  constructor(input?: { openai?: OpenAI; model?: string }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null);
    this.model =
      input?.model ??
      process.env.OPENAI_MODEL_EMBEDDING ??
      FAQ_EMBEDDING_MODEL_DEFAULT;
  }

  async embed(text: string): Promise<number[] | null> {
    const trimmed = text.trim();
    if (!this.openai || trimmed.length === 0) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
    try {
      const response = await this.openai.embeddings.create(
        {
          model: this.model,
          input: trimmed,
          dimensions: FAQ_EMBEDDING_DIMENSIONS,
        },
        { signal: controller.signal },
      );
      const vector = response.data?.[0]?.embedding;
      return Array.isArray(vector) && vector.length > 0 ? vector : null;
    } catch {
      // Rede, timeout (abort), sem cota etc. → null (best-effort).
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type SemanticFaqRepository = {
  matchFaqByEmbedding(input: {
    embedding: number[];
    threshold: number;
    limit: number;
  }): Promise<FaqVendasRecord[]>;
};

// Resolve a FAQ mais parecida semanticamente com a mensagem. Best-effort:
// qualquer degrau ausente (sem embedder, sem repo, embed nulo, nenhum match
// acima do threshold, ou erro) devolve null e o caller usa o match por keyword.
export async function resolveSemanticFaqMatch(input: {
  message: string;
  embedder: FaqEmbedder | undefined;
  repository: SemanticFaqRepository | undefined;
  threshold?: number;
  limit?: number;
}): Promise<FaqVendasRecord | null> {
  if (!input.embedder || !input.repository) return null;
  try {
    const embedding = await input.embedder.embed(input.message);
    if (!embedding) return null;
    const matches = await input.repository.matchFaqByEmbedding({
      embedding,
      threshold: input.threshold ?? FAQ_SIMILARITY_THRESHOLD_DEFAULT,
      limit: input.limit ?? 3,
    });
    return matches[0] ?? null;
  } catch {
    return null;
  }
}
