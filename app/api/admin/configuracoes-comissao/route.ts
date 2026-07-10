import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  getConfiguracoesComissao,
  updateConfiguracoesComissao,
  type ConfiguracoesComissaoUpdate,
} from "@/lib/admin/comissoes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const configuracoes = await getConfiguracoesComissao(supabase);
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    console.error("admin/configuracoes-comissao GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao carregar configuracoes de comissao." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: ConfiguracoesComissaoUpdate;
  try {
    body = (await request.json()) as ConfiguracoesComissaoUpdate;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const configuracoes = await updateConfiguracoesComissao(supabase, body, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao salvar configuracoes de comissao.";
    if (status === 500) console.error("admin/configuracoes-comissao PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
