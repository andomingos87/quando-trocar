import { describe, expect, test, vi } from "vitest";

import {
  faqEmbeddingText,
  resolveSemanticFaqMatch,
  toPgVectorLiteral,
  type FaqEmbedder,
} from "@/lib/whatsapp/faq-embeddings";
import { classifySalesMessage } from "@/lib/whatsapp/sales-agent";
import type { FaqVendasRecord } from "@/lib/whatsapp/types";

const PRICE_FAQ: FaqVendasRecord = {
  id: "faq-preco",
  pergunta: "Quanto custa?",
  resposta: "O plano parte de um valor baixo, o comercial fecha com você.",
  palavras_chave: ["custa", "preco"],
  ordem: 1,
};

describe("faq-embeddings helpers", () => {
  test("toPgVectorLiteral produz a forma canônica [a,b,c]", () => {
    expect(toPgVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  test("faqEmbeddingText junta pergunta, keywords e resposta", () => {
    const text = faqEmbeddingText(PRICE_FAQ);
    expect(text).toContain("Quanto custa?");
    expect(text).toContain("custa, preco");
    expect(text).toContain("comercial");
  });
});

describe("resolveSemanticFaqMatch — best-effort", () => {
  const embedder: FaqEmbedder = { embed: vi.fn(async () => [0.1, 0.2]) };
  const repository = {
    matchFaqByEmbedding: vi.fn(async () => [PRICE_FAQ]),
  };

  test("devolve a FAQ mais similar quando embedder e repo respondem", async () => {
    const result = await resolveSemanticFaqMatch({
      message: "quanto sai por mes?",
      embedder,
      repository,
    });
    expect(result?.id).toBe("faq-preco");
  });

  test("sem embedder → null (cai no keyword)", async () => {
    const result = await resolveSemanticFaqMatch({
      message: "quanto sai por mes?",
      embedder: undefined,
      repository,
    });
    expect(result).toBeNull();
  });

  test("embed nulo → null", async () => {
    const result = await resolveSemanticFaqMatch({
      message: "quanto sai por mes?",
      embedder: { embed: vi.fn(async () => null) },
      repository,
    });
    expect(result).toBeNull();
  });

  test("nenhum match acima do threshold → null", async () => {
    const result = await resolveSemanticFaqMatch({
      message: "quanto sai por mes?",
      embedder,
      repository: { matchFaqByEmbedding: vi.fn(async () => []) },
    });
    expect(result).toBeNull();
  });

  test("erro no repo → null (não propaga)", async () => {
    const result = await resolveSemanticFaqMatch({
      message: "quanto sai por mes?",
      embedder,
      repository: {
        matchFaqByEmbedding: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    expect(result).toBeNull();
  });
});

describe("classifySalesMessage — fallback semântico (CV5)", () => {
  const faqs: FaqVendasRecord[] = [PRICE_FAQ];

  test("usa preMatchedFaqId como pergunta_faq quando a keyword não casa", () => {
    // "quanto sai por mes" não contém a keyword "custa" nem "preco".
    const classification = classifySalesMessage(
      "quanto sai por mes",
      faqs,
      "faq-preco",
    );
    expect(classification.intent).toBe("pergunta_faq");
    expect(classification.faqId).toBe("faq-preco");
  });

  test("sem preMatchedFaqId, paráfrase sem keyword cai em fora_escopo (comportamento antigo)", () => {
    const classification = classifySalesMessage("quanto sai por mes", faqs);
    expect(classification.intent).toBe("fora_escopo");
  });

  test("preMatchedFaqId inexistente é ignorado", () => {
    const classification = classifySalesMessage(
      "quanto sai por mes",
      faqs,
      "faq-inexistente",
    );
    expect(classification.intent).toBe("fora_escopo");
  });
});
