import { describe, expect, test } from "vitest";

import {
  SERVICE_CONFIRMATION_PARAM_NAMES,
  SERVICE_CONFIRMATION_APPROVED_BODY,
  buildServiceConfirmationParams,
  productLabelForConfirmation,
  renderServiceConfirmation,
  sanitizeTemplateParam,
} from "@/lib/whatsapp/service-confirmation";
import type { TipoServico } from "@/lib/whatsapp/types";

// A frase literal que a transcrição do áudio real produziu e que foi
// persistida em `servicos.descricao` (QTR-35, servico_id
// 8458d728-0614-40b8-b240-94dadf77666b). É o texto que NÃO pode chegar ao
// cliente final por nenhum caminho.
const FALA_SUJA =
  "ele tem, ele acabou de trocar um amortecedor da Perfect, ele tem uma BMW e na data de .";

describe("productLabelForConfirmation", () => {
  test("nunca devolve o texto livre da oficina — nem para revisao/outro", () => {
    const tipos: TipoServico[] = ["troca_oleo", "amortecedor", "revisao", "outro"];
    for (const tipoServico of tipos) {
      const label = productLabelForConfirmation({ tipoServico });
      expect(label).not.toContain("acabou");
      expect(label).not.toBe(FALA_SUJA);
      expect(label.length).toBeLessThanOrEqual(20);
    }
  });

  test("rótulos fechados por tipo de serviço", () => {
    expect(productLabelForConfirmation({ tipoServico: "troca_oleo" })).toBe("óleo");
    expect(productLabelForConfirmation({ tipoServico: "amortecedor" })).toBe(
      "amortecedor",
    );
    // Antes do QTR-35 estes dois caíam no `default` e devolviam `input.servico`.
    expect(productLabelForConfirmation({ tipoServico: "revisao" })).toBe("revisão");
    expect(productLabelForConfirmation({ tipoServico: "outro" })).toBe("revisão");
  });
});

describe("sanitizeTemplateParam", () => {
  test("colapsa espaços e remove newline/tab (a Cloud API rejeita)", () => {
    expect(sanitizeTemplateParam("Gol\nG5", { maxLength: 40 })).toBe("Gol G5");
    expect(sanitizeTemplateParam("Civic\t\t2018", { maxLength: 40 })).toBe(
      "Civic 2018",
    );
    expect(sanitizeTemplateParam("  BMW   320i  ", { maxLength: 40 })).toBe(
      "BMW 320i",
    );
  });

  test("recusa vazio, branco e valor acima do limite", () => {
    expect(sanitizeTemplateParam("", { maxLength: 40 })).toBeNull();
    expect(sanitizeTemplateParam("   ", { maxLength: 40 })).toBeNull();
    expect(sanitizeTemplateParam(null, { maxLength: 40 })).toBeNull();
    expect(sanitizeTemplateParam(undefined, { maxLength: 40 })).toBeNull();
    expect(sanitizeTemplateParam(FALA_SUJA, { maxLength: 40 })).toBeNull();
  });
});

describe("buildServiceConfirmationParams", () => {
  const base = {
    customerName: "Leonardo Viana",
    workshopName: "Oficina Marsili",
    vehicleDescription: "BMW",
    productLabel: "amortecedor",
  };

  test("caminho feliz respeita a ordem dos nomes de variável", () => {
    const result = buildServiceConfirmationParams(base);
    expect(result).toEqual({
      ok: true,
      params: ["Leonardo Viana", "amortecedor", "BMW", "Oficina Marsili"],
    });
    expect(SERVICE_CONFIRMATION_PARAM_NAMES).toEqual([
      "nome",
      "produto",
      "carro",
      "oficina",
    ]);
  });

  test("revisao/outro com fala transcrita: produto sai rótulo, fala não aparece", () => {
    for (const tipoServico of ["revisao", "outro"] as TipoServico[]) {
      const result = buildServiceConfirmationParams({
        ...base,
        productLabel: productLabelForConfirmation({ tipoServico }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.params[1]).toBe("revisão");
      for (const param of result.params) {
        expect(param).not.toContain("acabou de trocar");
      }
    }
  });

  test("veículo corrompido pela extração bloqueia o envio", () => {
    // Valor real gravado em veiculos.descricao antes da correção manual.
    const result = buildServiceConfirmationParams({
      ...base,
      vehicleDescription: "Nome Dele É Leonardo\nele tem uma BMW e na data de hoje",
    });
    expect(result).toEqual({ ok: false, invalidParam: "carro" });
  });

  test("aponta o campo culpado", () => {
    expect(buildServiceConfirmationParams({ ...base, customerName: "" })).toEqual({
      ok: false,
      invalidParam: "nome",
    });
    expect(
      buildServiceConfirmationParams({ ...base, productLabel: FALA_SUJA }),
    ).toEqual({ ok: false, invalidParam: "produto" });
    expect(buildServiceConfirmationParams({ ...base, workshopName: "  " })).toEqual({
      ok: false,
      invalidParam: "oficina",
    });
  });

  test("nenhum parâmetro aprovado contém newline (limite da Cloud API)", () => {
    const result = buildServiceConfirmationParams({
      ...base,
      customerName: "Leonardo\nViana",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const param of result.params) {
      expect(param).not.toMatch(/[\r\n\t]/);
    }
  });
});

describe("renderServiceConfirmation", () => {
  test("espelha o body aprovado na Meta e não inventa uma copy de CTA", () => {
    const rendered = renderServiceConfirmation({
      customerName: "Leonardo Viana",
      productLabel: "amortecedor",
      vehicleDescription: "BMW",
      workshopName: "Oficina Marsili",
    });

    expect(rendered).toBe(
      SERVICE_CONFIRMATION_APPROVED_BODY
        .replaceAll("{{nome}}", "Leonardo Viana")
        .replaceAll("{{produto}}", "amortecedor")
        .replaceAll("{{carro}}", "BMW")
        .replaceAll("{{oficina}}", "Oficina Marsili"),
    );
    expect(rendered).not.toContain("Precisa falar com");
    expect(rendered).not.toContain("botão abaixo");
  });
});
