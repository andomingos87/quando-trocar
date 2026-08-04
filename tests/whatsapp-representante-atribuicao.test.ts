import { describe, expect, test } from "vitest";

import {
  REATRIBUICAO_INATIVIDADE_DIAS,
  SupabaseWhatsappRepository,
  podeAtribuirRepresentante,
} from "@/lib/whatsapp/repository";

// Atribuicao de representante (ADR-0019 + regras §18.9):
//   - lead sem dono -> atribui;
//   - lead com dono e ativo/avancado -> NAO troca (protege o rep, inclusive
//     quando o lead abre o link de outro representante);
//   - lead parado ha REATRIBUICAO_INATIVIDADE_DIAS -> volta a ser atribuivel.

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-08-03T12:00:00Z");

function iso(diasAtras: number) {
  return new Date(AGORA.getTime() - diasAtras * DIA).toISOString();
}

describe("podeAtribuirRepresentante", () => {
  test("lead inexistente ou sem representante e atribuivel", () => {
    expect(podeAtribuirRepresentante(null, AGORA)).toBe(true);
    expect(
      podeAtribuirRepresentante(
        {
          representante_id: null,
          representante_atribuido_em: null,
          status: "em_conversa",
          last_message_at: iso(1),
        },
        AGORA,
      ),
    ).toBe(true);
  });

  test("lead atribuido e ativo nao troca de dono (o link do outro rep nao rouba)", () => {
    expect(
      podeAtribuirRepresentante(
        {
          representante_id: "rep-a",
          representante_atribuido_em: iso(2),
          status: "em_conversa",
          last_message_at: iso(1),
        },
        AGORA,
      ),
    ).toBe(false);
  });

  test("lead que avancou no funil nunca e reatribuido automaticamente", () => {
    for (const status of ["qualificado", "interessado", "teste_aceito", "convertido"] as const) {
      expect(
        podeAtribuirRepresentante(
          {
            representante_id: "rep-a",
            representante_atribuido_em: iso(400),
            status,
            last_message_at: iso(400),
          },
          AGORA,
        ),
      ).toBe(false);
    }
  });

  test("lead parado alem da janela volta a ser atribuivel", () => {
    const base = {
      representante_id: "rep-a",
      status: "em_conversa" as const,
    };
    expect(
      podeAtribuirRepresentante(
        {
          ...base,
          representante_atribuido_em: iso(REATRIBUICAO_INATIVIDADE_DIAS + 1),
          last_message_at: iso(REATRIBUICAO_INATIVIDADE_DIAS + 1),
        },
        AGORA,
      ),
    ).toBe(true);
    // um dia a menos ainda esta dentro da janela
    expect(
      podeAtribuirRepresentante(
        {
          ...base,
          representante_atribuido_em: iso(REATRIBUICAO_INATIVIDADE_DIAS - 1),
          last_message_at: iso(REATRIBUICAO_INATIVIDADE_DIAS - 1),
        },
        AGORA,
      ),
    ).toBe(false);
    // atribuicao antiga, mas conversa recente = lead vivo, nao reatribui
    expect(
      podeAtribuirRepresentante(
        { ...base, representante_atribuido_em: iso(400), last_message_at: iso(3) },
        AGORA,
      ),
    ).toBe(false);
    // lead perdido e parado pode ser retrabalhado por outro rep
    expect(
      podeAtribuirRepresentante(
        {
          representante_id: "rep-a",
          representante_atribuido_em: iso(400),
          status: "perdido",
          last_message_at: iso(400),
        },
        AGORA,
      ),
    ).toBe(true);
  });

  test("lead legado sem data de atribuicao e conservado com o rep atual", () => {
    expect(
      podeAtribuirRepresentante(
        {
          representante_id: "rep-a",
          representante_atribuido_em: null,
          status: "em_conversa",
          last_message_at: iso(400),
        },
        AGORA,
      ),
    ).toBe(false);
  });
});

// Mock de leads_oficina + representantes. O SELECT de existencia e o UPSERT
// batem na mesma tabela; `representantes` responde a resolucao do codigo.
function makeSupabase(
  existing: Record<string, unknown> | null,
  representanteId: string | null = "rep-b",
) {
  let upsertPayload: Record<string, unknown> | null = null;

  const supabase = {
    from: (table: string) => {
      if (table === "representantes") {
        const chain = {
          select: () => chain,
          ilike: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: representanteId ? { id: representanteId } : null,
              error: null,
            }),
        } as Record<string, unknown>;
        return chain;
      }
      if (table !== "leads_oficina") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: existing, error: null }),
          }),
        }),
        upsert: (payload: Record<string, unknown>) => {
          upsertPayload = payload;
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "lead-1", status: "em_conversa", nome: null, metadata: {} },
                  error: null,
                }),
            }),
          };
        },
      };
    },
  } as never;

  return { supabase, getUpsertPayload: () => upsertPayload };
}

describe("upsertLead — canal e janela da atribuicao", () => {
  test("codigo com click token grava atribuicao via site_link", async () => {
    const { supabase, getUpsertPayload } = makeSupabase(null);
    await new SupabaseWhatsappRepository(supabase).upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      representanteCodigo: "CARLOS",
      representanteClickToken: "K7F2QX",
    });

    const payload = getUpsertPayload()!;
    expect(payload).toMatchObject({
      representante_id: "rep-b",
      representante_atribuido_via: "site_link",
      representante_click_token: "K7F2QX",
    });
    expect(payload.representante_atribuido_em).toEqual(expect.any(String));
  });

  test("codigo sem click token = link wa.me direto (wa_prefill)", async () => {
    const { supabase, getUpsertPayload } = makeSupabase(null);
    await new SupabaseWhatsappRepository(supabase).upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      representanteCodigo: "CARLOS",
    });

    expect(getUpsertPayload()).toMatchObject({
      representante_id: "rep-b",
      representante_atribuido_via: "wa_prefill",
      representante_click_token: null,
    });
  });

  test("lead ativo de outro rep nao e roubado por um codigo novo", async () => {
    const { supabase, getUpsertPayload } = makeSupabase({
      id: "lead-1",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      metadata: {},
      representante_id: "rep-a",
      representante_atribuido_em: iso(5),
      last_message_at: iso(1),
      ad_attributed_at: null,
    });

    await new SupabaseWhatsappRepository(supabase).upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      representanteCodigo: "OUTROREP",
      representanteClickToken: "K7F2QX",
    });

    const payload = getUpsertPayload()!;
    expect(payload.representante_id).toBeUndefined();
    expect(payload.representante_atribuido_via).toBeUndefined();
  });

  test("lead parado alem da janela e reatribuido ao rep do novo link", async () => {
    const { supabase, getUpsertPayload } = makeSupabase({
      id: "lead-1",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      metadata: {},
      representante_id: "rep-a",
      representante_atribuido_em: iso(REATRIBUICAO_INATIVIDADE_DIAS + 10),
      last_message_at: iso(REATRIBUICAO_INATIVIDADE_DIAS + 10),
      ad_attributed_at: null,
    });

    await new SupabaseWhatsappRepository(supabase).upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      representanteCodigo: "OUTROREP",
      representanteClickToken: "K7F2QX",
    });

    expect(getUpsertPayload()).toMatchObject({
      representante_id: "rep-b",
      representante_atribuido_via: "site_link",
    });
  });

  test("codigo que nao resolve para rep ativo e ignorado", async () => {
    const { supabase, getUpsertPayload } = makeSupabase(null, null);
    await new SupabaseWhatsappRepository(supabase).upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "landing_page",
      status: "em_conversa",
      representanteCodigo: "INEXISTENTE",
      representanteClickToken: "K7F2QX",
    });

    expect(getUpsertPayload()!.representante_id).toBeUndefined();
  });
});
