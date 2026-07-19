import { describe, expect, test } from "vitest";

import { validateGeneratedReply } from "@/lib/whatsapp/reply-validator";

// CV8 (ADR-0026): red-team da moldura gerada do concierge do cliente final.
// A allowlist inclui o wa.me da oficina; requireHandoffLink exige a ponte.
const WA = "https://wa.me/5541999998888";
const NAMES = ["Auto Center Silva"];

function validate(generated: string, requireHandoffLink = true) {
  return validateGeneratedReply({
    generated,
    precoPartida: 59,
    allowedLinks: [WA],
    allowedNames: NAMES,
    requireHandoffLink,
  });
}

describe("requireHandoffLink (ponte da oficina)", () => {
  test("aprova quando a ponte wa.me está presente", () => {
    const reply = `Aqui é o assistente da Auto Center Silva 🙂 Qualquer dúvida, fala direto com eles 👉 ${WA}`;
    expect(validate(reply)).toEqual({ ok: true });
  });

  test("reprova quando o rewrite engole a ponte", () => {
    const reply = "Aqui é o assistente da oficina, qualquer coisa é só chamar.";
    expect(validate(reply)).toEqual({ ok: false, reason: "sem_ponte_oficina" });
  });

  test("sem requireHandoffLink, ausência de ponte não reprova (outros modos)", () => {
    const reply = "Por nada! A gente te avisa na próxima troca.";
    expect(validate(reply, false)).toEqual({ ok: true });
  });
});

describe("red-team cliente final: preço / agenda continuam vetados", () => {
  test("cliente pede preço → reply que cota preço é reprovado (mesmo com ponte)", () => {
    const reply = `A troca custa R$ 120, chefe. Fala com a oficina 👉 ${WA}`;
    expect(validate(reply)).toEqual({ ok: false, reason: "preco_invalido" });
  });

  test("cliente pede horário → reply que marca agenda é reprovado", () => {
    const reply = `Te encaixo amanhã as 14h. Qualquer coisa 👉 ${WA}`;
    expect(validate(reply)).toEqual({ ok: false, reason: "promessa_ou_agenda" });
  });

  test("promessa de resultado é reprovada", () => {
    const reply = `Garanto que seu carro vai ficar novo. Fala com eles 👉 ${WA}`;
    expect(validate(reply)).toEqual({ ok: false, reason: "promessa_ou_agenda" });
  });

  test("link de outra empresa (fora da allowlist) é reprovado", () => {
    const reply = `Fala com a gente em https://wa.me/5511000000000 ou ${WA}`;
    expect(validate(reply)).toEqual({ ok: false, reason: "link_nao_permitido" });
  });
});
