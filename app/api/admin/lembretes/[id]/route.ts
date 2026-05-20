// ADR-0001: cancelar lembrete e iniciativa do admin humano. O LLM nao
// escreve em lembretes.status; transicoes automaticas vem do worker/webhook.
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  cancelarLembrete,
  validateCancelarLembrete,
} from "@/lib/admin/lembretes";
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

  let body: { acao?: string; motivo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  if (body.acao !== "cancelar") {
    return NextResponse.json(
      { ok: false, message: "Acao desconhecida." },
      { status: 400 },
    );
  }

  const validation = validateCancelarLembrete({ motivo: body.motivo });
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.message, field: validation.field },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await cancelarLembrete(supabase, id, validation.data, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao cancelar lembrete.";
    if (status === 500) console.error("admin/lembretes PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
