import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import { createFaq, listFaqs, type FaqVendasInput } from "@/lib/admin/faq";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();
    const faqs = await listFaqs(supabase);
    return NextResponse.json({ ok: true, faqs });
  } catch (err) {
    console.error("admin/faq GET failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao listar FAQs." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Partial<FaqVendasInput>;
  try {
    body = (await request.json()) as Partial<FaqVendasInput>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const faq = await createFaq(
      supabase,
      {
        pergunta: body.pergunta as string,
        resposta: body.resposta as string,
        palavras_chave: Array.isArray(body.palavras_chave)
          ? (body.palavras_chave as string[])
          : [],
        ativo: typeof body.ativo === "boolean" ? body.ativo : true,
        ordem: typeof body.ordem === "number" ? body.ordem : 0,
      },
      { adminId: auth.admin.adminId, ip },
    );
    return NextResponse.json({ ok: true, faq }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error && status !== 500 ? err.message : "Erro ao criar FAQ.";
    if (status === 500) console.error("admin/faq POST failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
