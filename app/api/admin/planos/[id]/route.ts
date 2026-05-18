import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  deactivatePlano,
  type PlanoUpdate,
  updatePlano,
} from "@/lib/admin/planos";
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
    return NextResponse.json(
      { ok: false, message: "ID invalido." },
      { status: 400 },
    );
  }

  let body: Partial<PlanoUpdate>;
  try {
    body = (await request.json()) as Partial<PlanoUpdate>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  const patch: PlanoUpdate = {};
  if (typeof body.nome === "string") patch.nome = body.nome;
  if (typeof body.preco_base === "number") patch.preco_base = body.preco_base;
  if (body.descricao === null || typeof body.descricao === "string") {
    patch.descricao = body.descricao;
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const plano = await updatePlano(supabase, id, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, plano });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar plano.";
    if (status === 500) console.error("admin/planos PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, message: "ID invalido." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await deactivatePlano(supabase, id, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao desativar plano.";
    if (status === 500) console.error("admin/planos DELETE failed", err);
    return NextResponse.json(
      {
        ok: false,
        message,
        oficinasVinculadas: (err as { oficinasVinculadas?: number })
          .oficinasVinculadas,
      },
      { status },
    );
  }
}
