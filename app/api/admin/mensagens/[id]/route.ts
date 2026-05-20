// ADR-0001: reenfileiramento de outbound message e decisao humana. A rota
// apenas vira a flag de status; o worker existente e quem chama o WhatsApp
// Cloud API. Isso evita duplicidade e mantem retries observaveis pelo mesmo
// caminho normal.
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { retryOutboundMessage } from "@/lib/admin/mensagens";
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

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  let body: { acao?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  if (body.acao !== "retry") {
    return NextResponse.json(
      { ok: false, message: "Acao desconhecida." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await retryOutboundMessage(supabase, id, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao reenfileirar mensagem.";
    if (status === 500) console.error("admin/mensagens POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
