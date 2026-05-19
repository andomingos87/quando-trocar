import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";
import { normalizePhoneToE164 } from "./phone";

export type AdminUserRow = {
  id: string;
  nome: string;
  whatsapp: string;
  ativo: boolean;
  ultimo_acesso_em: string | null;
  created_at: string;
};

export async function listAdmins(supabase: SupabaseClient): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, nome, whatsapp, ativo, ultimo_acesso_em, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`list_admins_failed: ${error.message}`);
  return data ?? [];
}

export type AdminProfile = {
  id: string;
  nome: string;
  whatsapp: string;
};

export async function getAdminProfile(
  supabase: SupabaseClient,
  adminId: string,
): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, nome, whatsapp")
    .eq("id", adminId)
    .maybeSingle();
  if (error) throw new Error(`get_admin_profile_failed: ${error.message}`);
  return data ?? null;
}

export type AdminInviteInput = { nome: string; whatsapp: string };

export type AdminValidationError =
  | { field: "nome"; message: string }
  | { field: "whatsapp"; message: string };

export function validateAdminInvite(
  input: Partial<AdminInviteInput>,
): { ok: true; data: AdminInviteInput } | { ok: false; error: AdminValidationError } {
  if (!input.nome || input.nome.trim().length === 0) {
    return { ok: false, error: { field: "nome", message: "Nome obrigatorio." } };
  }
  if (input.nome.length > 120) {
    return { ok: false, error: { field: "nome", message: "Nome muito longo (max 120)." } };
  }
  if (!input.whatsapp || typeof input.whatsapp !== "string") {
    return { ok: false, error: { field: "whatsapp", message: "WhatsApp obrigatorio." } };
  }
  const phone = normalizePhoneToE164(input.whatsapp);
  if (!phone.ok) {
    return { ok: false, error: { field: "whatsapp", message: "WhatsApp invalido." } };
  }
  return { ok: true, data: { nome: input.nome.trim(), whatsapp: phone.e164 } };
}

export async function inviteAdmin(
  supabase: SupabaseClient,
  input: AdminInviteInput,
  ctx: { adminId: string; ip: string | null },
): Promise<{ id: string }> {
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("whatsapp", input.whatsapp)
    .maybeSingle();
  if (existing) {
    const err = new Error("Ja existe admin com este WhatsApp.");
    Object.assign(err, { status: 409 });
    throw err;
  }

  return withAdminAudit(
    supabase,
    (result: { id: string }) => ({
      adminId: ctx.adminId,
      acao: "admin.invite",
      entidade: "admin_users",
      entidadeId: result.id,
      ip: ctx.ip,
      payload: { nome: input.nome, whatsapp: input.whatsapp },
    }),
    async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .insert({ nome: input.nome, whatsapp: input.whatsapp, ativo: true })
        .select("id")
        .single();
      if (error) throw new Error(`invite_admin_failed: ${error.message}`);
      return { id: data.id };
    },
  );
}

export async function setAdminAtivo(
  supabase: SupabaseClient,
  id: string,
  ativo: boolean,
  ctx: { selfAdminId: string; ip: string | null },
): Promise<{ id: string; ativo: boolean }> {
  if (id === ctx.selfAdminId && !ativo) {
    const err = new Error("Voce nao pode desativar a si mesmo.");
    Object.assign(err, { status: 400 });
    throw err;
  }

  const { data: existing } = await supabase
    .from("admin_users")
    .select("id, ativo")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    const err = new Error("admin_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (existing.ativo === ativo) {
    return { id, ativo };
  }

  await withAdminAudit(
    supabase,
    {
      adminId: ctx.selfAdminId,
      acao: ativo ? "admin.activate" : "admin.deactivate",
      entidade: "admin_users",
      entidadeId: id,
      ip: ctx.ip,
      payload: { before: { ativo: existing.ativo }, after: { ativo } },
    },
    async () => {
      const { error } = await supabase
        .from("admin_users")
        .update({ ativo })
        .eq("id", id);
      if (error) throw new Error(`set_admin_ativo_failed: ${error.message}`);
    },
  );

  return { id, ativo };
}

export async function deleteAdminIfNoAudit(
  supabase: SupabaseClient,
  id: string,
  ctx: { selfAdminId: string; ip: string | null },
): Promise<{ deleted: true } | { deleted: false; reason: "has_audit" | "self" }> {
  if (id === ctx.selfAdminId) {
    return { deleted: false, reason: "self" };
  }
  const { count } = await supabase
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", id);
  if ((count ?? 0) > 0) {
    return { deleted: false, reason: "has_audit" };
  }
  await withAdminAudit(
    supabase,
    {
      adminId: ctx.selfAdminId,
      acao: "admin.delete",
      entidade: "admin_users",
      entidadeId: id,
      ip: ctx.ip,
      payload: null,
    },
    async () => {
      const { error } = await supabase.from("admin_users").delete().eq("id", id);
      if (error) throw new Error(`delete_admin_failed: ${error.message}`);
    },
  );
  return { deleted: true };
}
