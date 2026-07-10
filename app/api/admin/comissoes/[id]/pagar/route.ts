import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { marcarComissaoPaga } from "@/lib/admin/comissoes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await marcarComissaoPaga(supabase, id, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao marcar comissao como paga.";
    if (status === 500) console.error("admin/comissoes pagar failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
