import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  createPlano,
  listPlanos,
  type PlanoInput,
} from "@/lib/admin/planos";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const planos = await listPlanos(supabase);
    return NextResponse.json({ ok: true, planos });
  } catch (err) {
    console.error("admin/planos GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao listar planos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Partial<PlanoInput>;
  try {
    body = (await request.json()) as Partial<PlanoInput>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const plano = await createPlano(
      supabase,
      {
        nome: body.nome as string,
        preco_base: Number(body.preco_base),
        descricao: typeof body.descricao === "string" ? body.descricao : null,
        ativo: typeof body.ativo === "boolean" ? body.ativo : true,
      },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json({ ok: true, plano }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao criar plano.";
    if (status === 500) console.error("admin/planos POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
