import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolveHandoffResult = {
  ok: true;
  id: string;
  previousAgentMode: string | null;
  agentMode: string | null;
};

export async function resolverHandoff(
  supabase: SupabaseClient,
  conversaId: string,
  ctx: { adminId: string; ip: string | null },
): Promise<ResolveHandoffResult> {
  const { data: before, error: beforeErr } = await supabase
    .from("conversas")
    .select("id, agent_mode, handoff_required, handoff_reason")
    .eq("id", conversaId)
    .maybeSingle();
  if (beforeErr)
    throw new Error(`resolver_handoff_lookup_failed: ${beforeErr.message}`);
  if (!before) {
    const err = new Error("Conversa nao encontrada.") as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }

  const previousAgentMode = (before.agent_mode as string | null) ?? null;
  const nextAgentMode =
    previousAgentMode === "suporte" ? "operacao" : previousAgentMode;

  const update: Record<string, unknown> = {
    handoff_required: false,
    handoff_reason: null,
    updated_at: new Date().toISOString(),
  };
  if (nextAgentMode !== previousAgentMode) {
    update.agent_mode = nextAgentMode;
  }

  const { error: updErr } = await supabase
    .from("conversas")
    .update(update)
    .eq("id", conversaId);
  if (updErr)
    throw new Error(`resolver_handoff_update_failed: ${updErr.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "conversa.handoff_resolved",
    entidade: "conversas",
    entidade_id: conversaId,
    payload: {
      before: {
        agent_mode: previousAgentMode,
        handoff_required: before.handoff_required,
        handoff_reason: before.handoff_reason,
      },
      after: { agent_mode: nextAgentMode },
    },
    ip: ctx.ip,
  });

  return {
    ok: true,
    id: conversaId,
    previousAgentMode,
    agentMode: nextAgentMode,
  };
}
