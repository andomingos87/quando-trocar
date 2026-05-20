import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { deactivateFaq, updateFaq, type FaqVendasUpdate } from "@/lib/admin/faq";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  let body: Partial<FaqVendasUpdate>;
  try {
    body = (await request.json()) as Partial<FaqVendasUpdate>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const patch: FaqVendasUpdate = {};
  if (typeof body.pergunta === "string") patch.pergunta = body.pergunta;
  if (typeof body.resposta === "string") patch.resposta = body.resposta;
  if (Array.isArray(body.palavras_chave)) {
    patch.palavras_chave = body.palavras_chave as string[];
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (typeof body.ordem === "number") patch.ordem = body.ordem;

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const faq = await updateFaq(supabase, id, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, faq });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar FAQ.";
    if (status === 500) console.error("admin/faq PATCH failed", err);
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
    const result = await deactivateFaq(supabase, id, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao desativar FAQ.";
    if (status === 500) console.error("admin/faq DELETE failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
