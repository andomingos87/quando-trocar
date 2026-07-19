import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  listPerguntasAbertas,
  marcarPergunta,
} from "@/lib/admin/perguntas-sem-resposta";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const perguntas = await listPerguntasAbertas(supabase);
    return NextResponse.json({ ok: true, perguntas });
  } catch (err) {
    console.error("admin/perguntas-sem-resposta GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao listar perguntas." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { pergunta?: string; status?: string };
  try {
    body = (await request.json()) as { pergunta?: string; status?: string };
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  if (body.status !== "resolvida" && body.status !== "ignorada") {
    return NextResponse.json(
      { ok: false, message: "Status invalido." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await marcarPergunta(
      supabase,
      { pergunta: body.pergunta ?? "", status: body.status },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao atualizar pergunta.";
    if (status === 500) console.error("admin/perguntas-sem-resposta PATCH failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
