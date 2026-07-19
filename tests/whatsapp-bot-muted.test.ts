import { describe, expect, test } from "vitest";

import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";

// Mock que captura o payload do .update() e resolve .maybeSingle()/.eq().
function makeSupabase(maybeSingleData: unknown) {
  const updates: Array<Record<string, unknown>> = [];
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.update = (payload: Record<string, unknown>) => {
    updates.push(payload);
    return b;
  };
  b.eq = () => b;
  b.maybeSingle = () => Promise.resolve({ data: maybeSingleData, error: null });
  b.then = (onF: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onF);
  return { supabase: { from: () => b } as never, updates };
}

describe("bot_muted (CV7)", () => {
  test("markConversationHandoff seta bot_muted_until no futuro", async () => {
    const { supabase, updates } = makeSupabase(null);
    const repo = new SupabaseWhatsappRepository(supabase);
    await repo.markConversationHandoff({ conversationId: "c1", reason: "quer_humano" });

    expect(updates).toHaveLength(1);
    expect(updates[0].handoff_required).toBe(true);
    const mutedUntil = updates[0].bot_muted_until as string;
    expect(new Date(mutedUntil).getTime()).toBeGreaterThan(Date.now());
  });

  test("isBotMuted = true quando bot_muted_until está no futuro", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const { supabase } = makeSupabase({ bot_muted_until: future });
    const repo = new SupabaseWhatsappRepository(supabase);
    expect(await repo.isBotMuted({ conversationId: "c1" })).toBe(true);
  });

  test("isBotMuted = false quando expirou", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { supabase } = makeSupabase({ bot_muted_until: past });
    const repo = new SupabaseWhatsappRepository(supabase);
    expect(await repo.isBotMuted({ conversationId: "c1" })).toBe(false);
  });

  test("isBotMuted = false quando não há mute", async () => {
    const { supabase } = makeSupabase({ bot_muted_until: null });
    const repo = new SupabaseWhatsappRepository(supabase);
    expect(await repo.isBotMuted({ conversationId: "c1" })).toBe(false);
  });
});
