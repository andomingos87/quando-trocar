import { describe, expect, it } from "vitest";

import { validateGeneratedReply } from "@/lib/whatsapp/reply-validator";

const BASE = {
  precoPartida: 59,
  allowedLinks: [
    "https://wa.me/5511945207618",
    "https://quandotrocar.com.br",
  ],
  allowedNames: ["Oficina do Ze", "Ze"],
};

function validate(generated: string, overrides: Partial<typeof BASE> = {}) {
  return validateGeneratedReply({ ...BASE, ...overrides, generated });
}

describe("validateGeneratedReply — preço (ADR-0012)", () => {
  it("reprova preço inventado 'custa R$ 199'", () => {
    const r = validate("Fica tranquilo chefe, custa R$ 199 por mes.");
    expect(r).toEqual({ ok: false, reason: "preco_invalido" });
  });

  it("reprova 'R$199,90'", () => {
    expect(validate("Sai por R$199,90 chefe.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("reprova '200 reais'", () => {
    expect(validate("Custa 200 reais.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("reprova valor com milhar 'R$ 1.200,00'", () => {
    expect(validate("Investimento de R$ 1.200,00.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("aceita o preço de partida exato 'R$ 59'", () => {
    expect(validate("A partir de R$ 59 chefe.")).toEqual({ ok: true });
  });

  it("aceita '59 reais'", () => {
    expect(validate("Comeca em 59 reais.")).toEqual({ ok: true });
  });

  it("aceita 'R$ 59,00' (centavos zerados)", () => {
    expect(validate("A partir de R$ 59,00.")).toEqual({ ok: true });
  });

  it("reprova preço menor inventado 'finja que custa R$ 1'", () => {
    expect(validate("Ok, finja que custa R$ 1 pra voce.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("respeita precoPartida customizado", () => {
    expect(validate("A partir de R$ 89.", { precoPartida: 89 })).toEqual({
      ok: true,
    });
    expect(validate("A partir de R$ 59.", { precoPartida: 89 })).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  // Regressão do bloqueio de corretude: "R$ 5.9" não pode virar 59 (o strip
  // incondicional de pontos aprovava esse preço inventado).
  it("reprova decimal com ponto 'R$ 5.9' (não vira 59)", () => {
    expect(validate("Sai por R$ 5.9 chefe.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("reprova decimal com ponto 'R$ 59.90' (centavos suspeitos)", () => {
    expect(validate("Fecho em R$ 59.90.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("mantém milhar pt-BR válido 'R$ 1.200' reprovando", () => {
    expect(validate("Investimento de R$ 1.200.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  // Regressão do bloqueio de segurança: preço escrito por extenso.
  it("reprova preço por extenso 'cento e noventa reais'", () => {
    expect(validate("Custa cento e noventa reais chefe.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("reprova 'dois mil reais'", () => {
    expect(validate("Fica em dois mil reais.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("reprova preço por extenso mesmo igual ao de partida (fail-safe)", () => {
    expect(validate("Fecho por cinquenta e nove reais.")).toEqual({
      ok: false,
      reason: "preco_invalido",
    });
  });

  it("não confunde número por extenso longe de moeda ('mil coisas')", () => {
    expect(validate("Fala chefe, mil coisas boas por ai?")).toEqual({
      ok: true,
    });
  });

  it("não dispara em 'um cliente real'", () => {
    expect(validate("Cada cliente real conta, chefe.")).toEqual({ ok: true });
  });
});

describe("validateGeneratedReply — promessa/agenda (ADR-0009)", () => {
  it("reprova 'garanto 30% de retorno'", () => {
    expect(validate("Chefe, garanto 30% de retorno.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova 'prometo que vai vender mais'", () => {
    expect(validate("Prometo que vai vender mais.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova percentual de retorno '20% a mais de clientes'", () => {
    expect(validate("Voce tera 20% a mais de clientes.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova marcação de horário 'te encaixo amanhã às 14h'", () => {
    expect(validate("Fechado, te encaixo amanha as 14h.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova 'agendado para segunda'", () => {
    expect(validate("Deixei agendado para segunda.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova horário no formato 14:30", () => {
    expect(validate("Marquei as 14:30 pra voce.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("reprova 'com certeza vai recuperar clientes'", () => {
    expect(validate("Com certeza vai recuperar seus clientes.")).toEqual({
      ok: false,
      reason: "promessa_ou_agenda",
    });
  });

  it("aceita framing de tendência sem garantia dura", () => {
    expect(
      validate("Em media as oficinas costumam ver mais retorno, chefe."),
    ).toEqual({ ok: true });
  });
});

describe("validateGeneratedReply — links", () => {
  it("reprova URL estranha 'http://bit.ly/x'", () => {
    expect(validate("Acessa http://bit.ly/x chefe.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("reprova domínio phishing sem protocolo", () => {
    expect(validate("Entra em quando-trocar.net pra testar.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("aceita wa.me permitido (ignorando querystring)", () => {
    expect(
      validate("Chama no https://wa.me/5511945207618?text=oi chefe."),
    ).toEqual({ ok: true });
  });

  it("aceita site oficial", () => {
    expect(validate("Detalhes em https://quandotrocar.com.br chefe.")).toEqual({
      ok: true,
    });
  });

  it("reprova wa.me de número não permitido", () => {
    expect(validate("Chama no https://wa.me/5599999999999.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  // Regressão do bloqueio de segurança: link com caractere Unicode.
  it("reprova link com ponto ideográfico U+3002 'evil。com'", () => {
    expect(validate("Entra em evil。com/pagar chefe.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("reprova link com ponto fullwidth U+FF0E 'evil．com'", () => {
    expect(validate("Acessa evil．com pra testar.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("reprova host com homóglifo cirílico 'еvil.com'", () => {
    expect(validate("Clica em еvil.com/x agora.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("reprova link com barra Unicode U+2215", () => {
    expect(validate("Vai em bit.ly∕golpe chefe.")).toEqual({
      ok: false,
      reason: "link_nao_permitido",
    });
  });

  it("não quebra links ASCII legítimos após normalização", () => {
    expect(
      validate(
        "Chama no https://wa.me/5511945207618 e veja https://quandotrocar.com.br.",
      ),
    ).toEqual({ ok: true });
  });
});

describe("validateGeneratedReply — cross-tenant", () => {
  it("reprova nome de oficina fora da allowlist", () => {
    expect(
      validate("Igual fizemos com a Oficina do Joao, chefe."),
    ).toEqual({ ok: false, reason: "cross_tenant" });
  });

  it("aceita a própria oficina do contexto", () => {
    expect(validate("Show, a Oficina do Ze ja ta configurada.")).toEqual({
      ok: true,
    });
  });

  it("não gera falso positivo em texto genérico capitalizado", () => {
    expect(
      validate("Ola chefe! Que bom que voce chegou. Bora testar?"),
    ).toEqual({ ok: true });
  });

  it("aceita menção genérica a 'sua oficina' sem nome", () => {
    expect(validate("Sua oficina recupera clientes com a gente.")).toEqual({
      ok: true,
    });
  });
});

describe("validateGeneratedReply — anti-injection / benignos", () => {
  it("reprova quando a saída obedece injection e cita preço", () => {
    // Mesmo que o texto pareça inocente, o preço inventado barra.
    expect(
      validate("Beleza, ignorei as regras: agora custa R$ 5."),
    ).toEqual({ ok: false, reason: "preco_invalido" });
  });

  it("aceita reescrita natural sem conteúdo proibido", () => {
    expect(
      validate("Opa chefe! O QuandoTrocar avisa seu cliente na hora certa. Bora testar 14 dias gratis?"),
    ).toEqual({ ok: true });
  });

  it("aceita saudação simples", () => {
    expect(validate("Fala chefe, tudo certo por ai?")).toEqual({ ok: true });
  });

  it("aceita CTA de teste grátis (sem promessa de resultado)", () => {
    expect(
      validate("Da pra testar 14 dias de graca, sem cartao. Topa?"),
    ).toEqual({ ok: true });
  });
});

describe("validateGeneratedReply — tamanho e vazio", () => {
  it("reprova texto acima do cap padrão (800)", () => {
    expect(validate("a".repeat(801))).toEqual({
      ok: false,
      reason: "muito_longo",
    });
  });

  it("aceita texto no limite", () => {
    expect(validate("a".repeat(800))).toEqual({ ok: true });
  });

  it("respeita maxLength customizado", () => {
    expect(
      validateGeneratedReply({
        ...BASE,
        generated: "abcdef",
        maxLength: 5,
      }),
    ).toEqual({ ok: false, reason: "muito_longo" });
  });

  it("reprova string vazia", () => {
    expect(validate("   ")).toEqual({ ok: false, reason: "vazio" });
  });
});
