import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { patchOficina, type OficinaPatchInput } from "@/lib/admin/oficinas";
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

  let body: Partial<OficinaPatchInput>;
  try {
    body = (await request.json()) as Partial<OficinaPatchInput>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const patch: OficinaPatchInput = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (body.motivo_pausa === null || typeof body.motivo_pausa === "string") {
    patch.motivo_pausa = body.motivo_pausa;
  }
  if (typeof body.plano_id === "string") patch.plano_id = body.plano_id;
  if (body.preco_negociado === null) patch.preco_negociado = null;
  else if (typeof body.preco_negociado === "number") patch.preco_negociado = body.preco_negociado;
  if (typeof body.cancelConfirmationName === "string") {
    patch.cancelConfirmationName = body.cancelConfirmationName;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await patchOficina(supabase, id, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar oficina.";
    if (status === 500) console.error("admin/oficinas PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
