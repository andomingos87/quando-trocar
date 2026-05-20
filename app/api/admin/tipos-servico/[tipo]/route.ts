import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { getRequestIp } from "@/lib/admin/request-ip";
import {
  isTipoServicoKey,
  updateTipoServico,
  type TipoServicoUpdate,
} from "@/lib/admin/tipos-servico";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tipo: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { tipo } = await ctx.params;
  if (!isTipoServicoKey(tipo)) {
    return NextResponse.json(
      { ok: false, message: "Tipo de servico invalido." },
      { status: 400 },
    );
  }

  let body: Partial<TipoServicoUpdate>;
  try {
    body = (await request.json()) as Partial<TipoServicoUpdate>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  const patch: TipoServicoUpdate = {};
  if (typeof body.label === "string") patch.label = body.label;
  if (typeof body.dias_lembrete === "number") patch.dias_lembrete = body.dias_lembrete;
  if (typeof body.template_name === "string") patch.template_name = body.template_name;
  if (typeof body.template_language === "string") {
    patch.template_language = body.template_language;
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const updated = await updateTipoServico(supabase, tipo, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, tipo: updated });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar tipo de servico.";
    if (status === 500) console.error("admin/tipos-servico PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
