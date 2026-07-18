import { describe, expect, it } from "vitest";

import {
  buildConviteRepresentante,
  portalRepresentanteUrl,
  type ConviteRepresentanteSource,
} from "@/lib/admin/convite-representante";

const SITE = "https://quandotrocar.com.br";

function rep(overrides: Partial<ConviteRepresentanteSource> = {}): ConviteRepresentanteSource {
  return {
    nome: "Carlos Silva",
    whatsapp: "+5511987654321",
    ativo: true,
    ...overrides,
  };
}

describe("portalRepresentanteUrl", () => {
  it("aponta para /representante", () => {
    expect(portalRepresentanteUrl(SITE)).toBe("https://quandotrocar.com.br/representante");
  });

  it("remove barra final para nao gerar //representante", () => {
    expect(portalRepresentanteUrl("https://quandotrocar.com.br/")).toBe(
      "https://quandotrocar.com.br/representante",
    );
  });
});

describe("buildConviteRepresentante", () => {
  it("monta destino, link do portal e params do template", () => {
    const result = buildConviteRepresentante({ rep: rep(), siteUrl: SITE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.to).toBe("+5511987654321");
    expect(result.payload.portalUrl).toBe("https://quandotrocar.com.br/representante");
    expect(result.payload.bodyParameters).toEqual([
      "Carlos",
      "https://quandotrocar.com.br/representante",
    ]);
    // Template nomeado: os nomes casam com {{nome}}/{{link}} na Meta e
    // alinham 1:1 com os valores.
    expect(result.payload.bodyParameterNames).toEqual(["nome", "link"]);
  });

  it("usa apenas o primeiro nome no corpo do template", () => {
    const result = buildConviteRepresentante({
      rep: rep({ nome: "Maria Aparecida dos Santos" }),
      siteUrl: SITE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.bodyParameters[0]).toBe("Maria");
  });

  it("cai no fallback quando o nome fica vazio", () => {
    const result = buildConviteRepresentante({ rep: rep({ nome: "   " }), siteUrl: SITE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.bodyParameters[0]).toBe("parceiro");
  });

  it("recusa representante inativo (nao acessa o portal)", () => {
    const result = buildConviteRepresentante({ rep: rep({ ativo: false }), siteUrl: SITE });
    expect(result).toEqual({
      ok: false,
      status: 409,
      message: "Representante inativo nao acessa o portal. Ative-o antes de convidar.",
    });
  });

  it("recusa representante sem WhatsApp", () => {
    const result = buildConviteRepresentante({ rep: rep({ whatsapp: "  " }), siteUrl: SITE });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
  });
});
