import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  bulkSoftDeleteOficinas,
  createOficinaManual,
  validateOficinaCreate,
} from "@/lib/admin/oficinas";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const validation = validateOficinaCreate((body ?? {}) as Record<string, unknown>);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.error.message, field: validation.error.field },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await createOficinaManual(supabase, validation.data, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao criar oficina.";
    if (status === 500) console.error("admin/oficinas POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}

/**
 * Exclusão em massa (soft delete) — recebe { ids: string[], confirm: true }.
 * Confirmação deliberada acontece na UI (digitar "EXCLUIR"); aqui só exigimos
 * o flag `confirm` para não apagar por acidente.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { ids?: unknown; confirm?: unknown };
  try {
    body = (await request.json()) as { ids?: unknown; confirm?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Selecione ao menos uma oficina." },
      { status: 400 },
    );
  }
  if (!ids.every(isUuid)) {
    return NextResponse.json(
      { ok: false, message: "ID invalido na selecao." },
      { status: 400 },
    );
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { ok: false, message: "Confirmacao obrigatoria." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await bulkSoftDeleteOficinas(supabase, ids, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao excluir oficinas.";
    if (status === 500) console.error("admin/oficinas bulk DELETE failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
