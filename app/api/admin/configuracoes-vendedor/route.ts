import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  getConfiguracoesVendedor,
  updateConfiguracoesVendedor,
  type ConfiguracoesVendedorUpdate,
} from "@/lib/admin/configuracoes-vendedor";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const configuracoes = await getConfiguracoesVendedor(supabase);
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    console.error("admin/configuracoes-vendedor GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao carregar configuracoes." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Partial<ConfiguracoesVendedorUpdate>;
  try {
    body = (await request.json()) as Partial<ConfiguracoesVendedorUpdate>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const patch: ConfiguracoesVendedorUpdate = {};
  if (typeof body.taxa_recuperacao_roi === "number") {
    patch.taxa_recuperacao_roi = body.taxa_recuperacao_roi;
  }
  if (typeof body.whatsapp_handoff_comercial === "string") {
    patch.whatsapp_handoff_comercial = body.whatsapp_handoff_comercial.trim();
  }
  if (Array.isArray(body.frases_landing)) {
    patch.frases_landing = body.frases_landing as string[];
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const configuracoes = await updateConfiguracoesVendedor(supabase, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, configuracoes });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar configuracoes.";
    if (status === 500) console.error("admin/configuracoes-vendedor PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
