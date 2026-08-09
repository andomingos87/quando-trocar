// Deduplicacao de estabelecimentos.
//
// Em cascata, do sinal mais forte para o mais fraco (secao 6.2 do plano tecnico).
// Regra de ouro: sinal forte decide sozinho; sinal fraco NAO descarta — marca como
// suspeita e manda para revisao humana. Descartar errado custa um lead real.

export type ChaveDedupe =
  | { tipo: "cnpj"; valor: string }
  | { tipo: "place_id"; valor: string }
  | { tipo: "telefone"; valor: string };

export type CandidatoDedupe = {
  id: string;
  cnpj?: string | null;
  googlePlaceId?: string | null;
  telefoneE164?: string | null;
  nomeCanonico?: string | null;
  cep?: string | null;
};

export type ResultadoDedupe =
  | { tipo: "novo" }
  | { tipo: "duplicado"; de: string; motivo: ChaveDedupe["tipo"] }
  | { tipo: "suspeita"; de: string; similaridade: number };

/** Limiar de similaridade de nome para levantar suspeita de duplicata. */
export const LIMIAR_SIMILARIDADE = 0.7;

function trigramas(valor: string): Set<string> {
  // Mesma convencao do pg_trgm: dois espacos na frente, um atras.
  const preenchido = `  ${valor.trim()} `;
  const conjunto = new Set<string>();
  for (let i = 0; i < preenchido.length - 2; i += 1) {
    conjunto.add(preenchido.slice(i, i + 3));
  }
  return conjunto;
}

/** Jaccard sobre trigramas — mesma ideia do `similarity()` do pg_trgm. */
export function similaridadeTrigrama(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersecao = 0;
  for (const t of ta) {
    if (tb.has(t)) intersecao += 1;
  }

  const uniao = ta.size + tb.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

/**
 * Compara um candidato contra os registros ja conhecidos.
 *
 * A ordem importa: CNPJ e place_id sao identidade; telefone e quase identidade
 * (oficina raramente divide numero com outra); nome parecido no mesmo CEP e so
 * indicio — dois "Auto Center Sao Joao" na mesma rua existem de verdade.
 */
export function avaliarDuplicata(
  candidato: CandidatoDedupe,
  existentes: readonly CandidatoDedupe[],
): ResultadoDedupe {
  for (const existente of existentes) {
    if (existente.id === candidato.id) continue;

    if (candidato.cnpj && existente.cnpj && candidato.cnpj === existente.cnpj) {
      return { tipo: "duplicado", de: existente.id, motivo: "cnpj" };
    }
    if (
      candidato.googlePlaceId &&
      existente.googlePlaceId &&
      candidato.googlePlaceId === existente.googlePlaceId
    ) {
      return { tipo: "duplicado", de: existente.id, motivo: "place_id" };
    }
    if (
      candidato.telefoneE164 &&
      existente.telefoneE164 &&
      candidato.telefoneE164 === existente.telefoneE164
    ) {
      return { tipo: "duplicado", de: existente.id, motivo: "telefone" };
    }
  }

  let melhor: { id: string; similaridade: number } | null = null;
  for (const existente of existentes) {
    if (existente.id === candidato.id) continue;
    if (!candidato.cep || !existente.cep || candidato.cep !== existente.cep) continue;

    const similaridade = similaridadeTrigrama(
      candidato.nomeCanonico ?? null,
      existente.nomeCanonico ?? null,
    );
    if (similaridade >= LIMIAR_SIMILARIDADE && (!melhor || similaridade > melhor.similaridade)) {
      melhor = { id: existente.id, similaridade };
    }
  }

  if (melhor) {
    return { tipo: "suspeita", de: melhor.id, similaridade: melhor.similaridade };
  }

  return { tipo: "novo" };
}

/**
 * Colapsa duplicatas dentro do proprio lote antes de tocar o banco.
 *
 * O arquivo da RFB traz matriz e filiais como registros distintos, e filiais da mesma
 * rede costumam repetir o telefone da matriz. Sem isso, o upsert insere N vezes o que
 * e um alvo comercial so.
 */
export function colapsarLote<T extends CandidatoDedupe>(
  lote: readonly T[],
): { unicos: T[]; duplicados: Array<{ item: T; de: string; motivo: ChaveDedupe["tipo"] }> } {
  const unicos: T[] = [];
  const duplicados: Array<{ item: T; de: string; motivo: ChaveDedupe["tipo"] }> = [];

  const porCnpj = new Map<string, string>();
  const porPlaceId = new Map<string, string>();
  const porTelefone = new Map<string, string>();

  for (const item of lote) {
    const existenteCnpj = item.cnpj ? porCnpj.get(item.cnpj) : undefined;
    const existentePlace = item.googlePlaceId ? porPlaceId.get(item.googlePlaceId) : undefined;
    const existenteTelefone = item.telefoneE164 ? porTelefone.get(item.telefoneE164) : undefined;

    if (existenteCnpj) {
      duplicados.push({ item, de: existenteCnpj, motivo: "cnpj" });
      continue;
    }
    if (existentePlace) {
      duplicados.push({ item, de: existentePlace, motivo: "place_id" });
      continue;
    }
    if (existenteTelefone) {
      duplicados.push({ item, de: existenteTelefone, motivo: "telefone" });
      continue;
    }

    unicos.push(item);
    if (item.cnpj) porCnpj.set(item.cnpj, item.id);
    if (item.googlePlaceId) porPlaceId.set(item.googlePlaceId, item.id);
    if (item.telefoneE164) porTelefone.set(item.telefoneE164, item.id);
  }

  return { unicos, duplicados };
}
