import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuditInput = {
  adminId: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
};

export type AdminAuditFactory<T> = (result: T) => AdminAuditInput;

// NOTE: this is NOT atomic. Supabase JS does not expose transactions, so the
// audit row is written only AFTER fn() succeeds. If fn() throws, no audit row
// is created. If the audit insert itself fails, fn()'s side effects are kept
// and the failure is rethrown. When stronger atomicity is required, wrap the
// mutation in a Postgres function.
//
// `inputOrFactory` accepts either a static AdminAuditInput or a factory that
// receives fn()'s result — useful when entidadeId or payload is only known
// after the mutation (e.g. create returning new uuid).
export async function withAdminAudit<T>(
  supabase: SupabaseClient,
  inputOrFactory: AdminAuditInput | AdminAuditFactory<T>,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();

  const input =
    typeof inputOrFactory === "function" ? inputOrFactory(result) : inputOrFactory;

  const { error } = await supabase.from("admin_audit_log").insert({
    admin_id: input.adminId,
    acao: input.acao,
    entidade: input.entidade,
    entidade_id: input.entidadeId ?? null,
    payload: input.payload ?? null,
    ip: input.ip ?? null,
  });

  if (error) {
    throw new Error(`admin_audit_insert_failed: ${error.message}`);
  }

  return result;
}
