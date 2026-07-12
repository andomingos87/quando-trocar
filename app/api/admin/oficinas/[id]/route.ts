import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  patchOficina,
  softDeleteOficina,
  type OficinaPatchInput,
} from "@/lib/admin/oficinas";
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

  let body: Partial<OficinaPatchInput>;
  try {
    body = (await request.json()) as Partial<OficinaPatchInput>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const patch: OficinaPatchInput = {};
  if (typeof body.nome === "string") patch.nome = body.nome;
  if (typeof body.whatsapp === "string") patch.whatsapp = body.whatsapp;
  if (body.cidade === null || typeof body.cidade === "string") patch.cidade = body.cidade;
  if (body.responsavel === null || typeof body.responsavel === "string") {
    patch.responsavel = body.responsavel;
  }
  if (typeof body.status === "string") patch.status = body.status;
  if (body.motivo_pausa === null || typeof body.motivo_pausa === "string") {
    patch.motivo_pausa = body.motivo_pausa;
  }
  if (typeof body.plano_id === "string") patch.plano_id = body.plano_id;
  if (body.preco_negociado === null) patch.preco_negociado = null;
  else if (typeof body.preco_negociado === "number") patch.preco_negociado = body.preco_negociado;
  if (body.representante_id === null || typeof body.representante_id === "string") {
    patch.representante_id = body.representante_id;
  }
  if (typeof body.cancelConfirmationName === "string") {
    patch.cancelConfirmationName = body.cancelConfirmationName;
  }

  // Cadastro / fiscal / endereco / observacao (string | null).
  const STRING_FIELDS = [
    "cpf_cnpj",
    "email",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "estado",
    "observacao",
    "mensagem_lembrete_padrao",
  ] as const;
  for (const key of STRING_FIELDS) {
    const v = body[key];
    if (v === null || typeof v === "string") patch[key] = v;
  }

  // Qualificacao (number | null).
  for (const key of ["ticket_medio", "volume_trocas_mes"] as const) {
    const v = body[key];
    if (v === null || typeof v === "number") patch[key] = v;
  }

  // Config de lembrete.
  if (typeof body.dias_lembrete_padrao === "number") {
    patch.dias_lembrete_padrao = body.dias_lembrete_padrao;
  }
  if (typeof body.horario_envio_inicio === "string") {
    patch.horario_envio_inicio = body.horario_envio_inicio;
  }
  if (typeof body.horario_envio_fim === "string") {
    patch.horario_envio_fim = body.horario_envio_fim;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await patchOficina(supabase, id, patch, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao atualizar oficina.";
    if (status === 500) console.error("admin/oficinas PATCH failed", err);
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

  let body: { confirmationName?: unknown };
  try {
    body = (await request.json()) as { confirmationName?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const confirmationName =
    typeof body.confirmationName === "string" ? body.confirmationName : "";

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await softDeleteOficina(
      supabase,
      id,
      { confirmationName },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : "Erro ao excluir oficina.";
    if (status === 500) console.error("admin/oficinas DELETE failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
