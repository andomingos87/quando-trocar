import { describe, expect, test } from "vitest";

import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";

// Mock mínimo de leads_oficina: primeira chamada é o SELECT de existência
// (.select().eq().maybeSingle()), a segunda é o UPSERT (.upsert().select().single()).
// Capturamos o payload do upsert pra provar a regra first-touch.
function makeSupabase(existing: Record<string, unknown> | null) {
  let upsertPayload: Record<string, unknown> | null = null;

  const supabase = {
    from: (table: string) => {
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

const REFERRAL = {
  ctwaClid: "clid-123",
  sourceId: "ad-999",
  sourceType: "ad",
  sourceUrl: "https://fb.me/x",
  headline: "Teste grátis",
};

describe("upsertLead — atribuição de anúncio é first-touch", () => {
  test("lead novo com referral -> grava atribuição", async () => {
    const { supabase, getUpsertPayload } = makeSupabase(null);
    const repo = new SupabaseWhatsappRepository(supabase);

    await repo.upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
      referral: REFERRAL,
    });

    const payload = getUpsertPayload();
    expect(payload).toMatchObject({
      ad_ctwa_clid: "clid-123",
      ad_id: "ad-999",
      ad_source_type: "ad",
      ad_source_url: "https://fb.me/x",
      ad_headline: "Teste grátis",
    });
    expect(payload!.ad_attributed_at).toEqual(expect.any(String));
  });

  test("lead já atribuído + nova mensagem sem referral -> não perde a atribuição antiga", async () => {
    const { supabase, getUpsertPayload } = makeSupabase({
      id: "lead-1",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
      metadata: {},
      representante_id: null,
      ad_attributed_at: "2026-08-01T10:00:00Z",
    });
    const repo = new SupabaseWhatsappRepository(supabase);

    await repo.upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
      referral: null,
    });

    const payload = getUpsertPayload();
    expect(payload).not.toHaveProperty("ad_ctwa_clid");
    expect(payload).not.toHaveProperty("ad_attributed_at");
  });

  test("lead já atribuído clica em outro anúncio depois -> mantém o primeiro (não sobrescreve)", async () => {
    const { supabase, getUpsertPayload } = makeSupabase({
      id: "lead-1",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
      metadata: {},
      representante_id: null,
      ad_attributed_at: "2026-08-01T10:00:00Z",
    });
    const repo = new SupabaseWhatsappRepository(supabase);

    await repo.upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
      referral: { ...REFERRAL, sourceId: "ad-outro" },
    });

    const payload = getUpsertPayload();
    expect(payload).not.toHaveProperty("ad_id");
  });

  test("sem referral algum -> não grava nenhum campo de atribuição", async () => {
    const { supabase, getUpsertPayload } = makeSupabase(null);
    const repo = new SupabaseWhatsappRepository(supabase);

    await repo.upsertLead({
      whatsapp: "+5541999990000",
      nome: "Lead",
      origem: "manual_whatsapp",
      status: "em_conversa",
    });

    const payload = getUpsertPayload();
    expect(payload).not.toHaveProperty("ad_id");
    expect(payload).not.toHaveProperty("ad_attributed_at");
  });
});
