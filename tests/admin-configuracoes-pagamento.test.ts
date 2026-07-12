import { describe, expect, it } from "vitest";

import {
  validateConfiguracoesPagamentoInput,
  type SecretPresence,
} from "@/lib/admin/configuracoes-pagamento";

const NENHUM: SecretPresence = {
  asaas_api_key_set: false,
  asaas_webhook_token_set: false,
  mp_access_token_set: false,
  mp_webhook_secret_set: false,
};

const MP_PRONTO: SecretPresence = { ...NENHUM, mp_access_token_set: true };
const ASAAS_PRONTO: SecretPresence = { ...NENHUM, asaas_api_key_set: true };

describe("validateConfiguracoesPagamentoInput", () => {
  it("rejeita provedor invalido", () => {
    const r = validateConfiguracoesPagamentoInput(
      { provedor_ativo: "picpay" as never },
      NENHUM,
    );
    expect(r?.field).toBe("provedor_ativo");
  });

  it("rejeita ambiente invalido", () => {
    const r = validateConfiguracoesPagamentoInput(
      { asaas_ambiente: "staging" as never },
      NENHUM,
    );
    expect(r?.field).toBe("asaas_ambiente");
  });

  it("bloqueia ativar ASAAS sem credencial", () => {
    const r = validateConfiguracoesPagamentoInput({ provedor_ativo: "asaas" }, NENHUM);
    expect(r?.field).toBe("provedor_ativo");
    expect(r?.message).toMatch(/ASAAS/i);
  });

  it("permite ativar ASAAS quando a key vem no mesmo payload", () => {
    const r = validateConfiguracoesPagamentoInput(
      { provedor_ativo: "asaas", asaas_api_key: "key_123" },
      NENHUM,
    );
    expect(r).toBeNull();
  });

  it("permite ativar ASAAS quando ja existe key no cofre", () => {
    const r = validateConfiguracoesPagamentoInput({ provedor_ativo: "asaas" }, ASAAS_PRONTO);
    expect(r).toBeNull();
  });

  it("bloqueia ativar Mercado Pago sem token", () => {
    const r = validateConfiguracoesPagamentoInput({ provedor_ativo: "mercado_pago" }, NENHUM);
    expect(r?.field).toBe("provedor_ativo");
  });

  it("permite ativar Mercado Pago com token presente", () => {
    const r = validateConfiguracoesPagamentoInput({ provedor_ativo: "mercado_pago" }, MP_PRONTO);
    expect(r).toBeNull();
  });

  it("permite so trocar ambiente sem mexer no provedor", () => {
    const r = validateConfiguracoesPagamentoInput({ asaas_ambiente: "producao" }, NENHUM);
    expect(r).toBeNull();
  });
});
