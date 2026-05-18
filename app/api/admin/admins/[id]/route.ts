import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { deleteAdminIfNoAudit, setAdminAtivo } from "@/lib/admin/admins";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  let body: { ativo?: unknown };
  try {
    body = (await request.json()) as { ativo?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  if (typeof body.ativo !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "Campo 'ativo' (boolean) obrigatorio." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await setAdminAtivo(supabase, id, body.ativo, {
      selfAdminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar admin.";
    if (status === 500) console.error("admin/admins PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await deleteAdminIfNoAudit(supabase, id, {
      selfAdminId: auth.admin.adminId,
      ip,
    });
    if (result.deleted) {
      return NextResponse.json({ ok: true, deleted: true });
    }
    const message =
      result.reason === "self"
        ? "Voce nao pode excluir a si mesmo."
        : "Admin tem auditoria registrada — apenas desative.";
    return NextResponse.json({ ok: false, message }, { status: 409 });
  } catch (err) {
    console.error("admin/admins DELETE failed", err);
    return NextResponse.json({ ok: false, message: "Erro ao excluir admin." }, { status: 500 });
  }
}
