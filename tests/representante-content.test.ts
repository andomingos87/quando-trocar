import { describe, expect, it } from "vitest";

import { PLAYBOOK } from "@/lib/representante/content/playbook";
import { NOVIDADES, listNovidades } from "@/lib/representante/content/novidades";

function collectText(): string {
  const parts: string[] = [];
  for (const secao of PLAYBOOK) {
    parts.push(secao.titulo, secao.resumo ?? "");
    for (const bloco of secao.blocos) {
      if (bloco.tipo === "qa") {
        for (const qa of bloco.itens) parts.push(qa.pergunta, qa.resposta);
      } else {
        parts.push(...bloco.itens);
      }
    }
  }
  for (const n of NOVIDADES) parts.push(n.titulo, n.corpo);
  return parts.join(" ");
}

describe("representante content", () => {
  it("nao expoe preco/condicao comercial concreta (ADR-0012)", () => {
    const text = collectText();
    // Sem simbolo de moeda e sem valor monetario explicito. Palavras como
    // "mensalidade"/"valor" usadas de forma descritiva sao permitidas; um NUMERO
    // com R$ ou vírgula de centavos, nao.
    expect(text).not.toMatch(/R\$/);
    expect(text).not.toMatch(/\d+[.,]\d{2}/);
  });

  it("listNovidades ordena da mais recente para a mais antiga", () => {
    const ordered = listNovidades();
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1].data >= ordered[i].data).toBe(true);
    }
  });

  it("cada novidade tem id, data YYYY-MM-DD e tag valida", () => {
    const tags = new Set(["produto", "comercial", "aviso"]);
    const ids = new Set<string>();
    for (const n of NOVIDADES) {
      expect(n.id).toBeTruthy();
      expect(ids.has(n.id)).toBe(false);
      ids.add(n.id);
      expect(n.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tags.has(n.tag)).toBe(true);
    }
  });

  it("playbook tem secoes com id unico", () => {
    const ids = new Set<string>();
    for (const secao of PLAYBOOK) {
      expect(secao.id).toBeTruthy();
      expect(ids.has(secao.id)).toBe(false);
      ids.add(secao.id);
      expect(secao.blocos.length).toBeGreaterThan(0);
    }
  });
});
