// Convite do representante para o portal (ADR-0025). Monta o link do portal e os
// parametros do template Meta. Logica PURA e testavel — o envio (WhatsApp) e a
// auditoria ficam na rota. Regra: representante inativo nao acessa o portal
// (login por OTP exige `ativo = true`), entao nao faz sentido convida-lo.

export type ConviteRepresentanteSource = {
  nome: string;
  whatsapp: string;
  ativo: boolean;
};

export type ConviteRepresentantePayload = {
  /** Numero destino no formato armazenado (E.164). */
  to: string;
  /** URL do portal (`/representante`) que redireciona para o login por OTP. */
  portalUrl: string;
  /**
   * Valores do template na ordem posicional: `{{1}}` = primeiro nome,
   * `{{2}}` = link do portal.
   */
  bodyParameters: [string, string];
};

export type ConviteRepresentanteResult =
  | { ok: true; payload: ConviteRepresentantePayload }
  | { ok: false; status: number; message: string };

/** Primeiro nome, com fallback amigavel para o corpo do template. */
function primeiroNome(nome: string): string {
  const first = nome.trim().split(/\s+/)[0];
  return first || "parceiro";
}

/** Remove barras finais para evitar `//representante`. */
export function portalRepresentanteUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/representante`;
}

export function buildConviteRepresentante(input: {
  rep: ConviteRepresentanteSource;
  siteUrl: string;
}): ConviteRepresentanteResult {
  const { rep, siteUrl } = input;

  if (!rep.ativo) {
    return {
      ok: false,
      status: 409,
      message: "Representante inativo nao acessa o portal. Ative-o antes de convidar.",
    };
  }

  const to = rep.whatsapp?.trim();
  if (!to) {
    return {
      ok: false,
      status: 422,
      message: "Representante sem WhatsApp cadastrado.",
    };
  }

  const portalUrl = portalRepresentanteUrl(siteUrl);
  return {
    ok: true,
    payload: {
      to,
      portalUrl,
      bodyParameters: [primeiroNome(rep.nome), portalUrl],
    },
  };
}
