import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  createRepresentante,
  listRepresentantes,
  type RepresentanteInput,
} from "@/lib/admin/representantes";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const representantes = await listRepresentantes(supabase);
    return NextResponse.json({ ok: true, representantes });
  } catch (err) {
    console.error("admin/representantes GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao listar representantes." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: RepresentanteInput;
  try {
    body = (await request.json()) as RepresentanteInput;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const representante = await createRepresentante(supabase, body, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, representante }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao criar representante.";
    if (status === 500) console.error("admin/representantes POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
