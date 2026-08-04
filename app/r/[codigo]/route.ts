import { NextResponse, type NextRequest } from "next/server";

import {
  gerarClickToken,
  normalizeCodigoIndicacao,
  readIndicacao,
  setIndicacaoCookie,
} from "@/lib/representante/indicacao";
import {
  registrarClique,
  resolveRepresentanteDoLinkPorCodigo,
} from "@/lib/representante/indicacao-cliques";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Link de indicacao do representante: https://<site>/r/<CODIGO>
//
// Fluxo: valida o codigo -> registra o clique -> grava o cookie `qt_ref`
// (30 dias) -> 302 para a landing. Redirect no servidor: funciona sem JS e o
// cookie e httpOnly (o visitante nao consegue forjar indicacao).
//
// FIRST-TOUCH STICKY: se o visitante ja esta na janela de outro representante,
// o cookie NAO e sobrescrito. O clique do segundo rep e registrado com
// `atribuiu = false` (ele ve o esforco no portal, mas o lead nao e dele).
// Reabrir o proprio link renova a janela.

export const dynamic = "force-dynamic";

// Destino sempre interno: nunca redireciona para host externo (open redirect).
function resolveDestino(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/r/")) return "/";
  return raw;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo: rawCodigo } = await params;
  const url = new URL(request.url);
  const destino = new URL(resolveDestino(url.searchParams.get("next")), url.origin);

  const codigo = normalizeCodigoIndicacao(decodeURIComponent(rawCodigo));
  // Codigo malformado ou inexistente cai na landing sem cookie e sem pista de
  // que o codigo existe ou nao (nao enumera representantes).
  if (!codigo) return NextResponse.redirect(destino, { status: 302 });

  const supabase = createSupabaseAdminClient();
  const representante = await resolveRepresentanteDoLinkPorCodigo(supabase, codigo);
  if (!representante) return NextResponse.redirect(destino, { status: 302 });

  const atual = await readIndicacao();
  const jaEDeOutroRep = Boolean(atual && atual.codigo !== representante.codigo);
  const clickToken = gerarClickToken();

  await registrarClique(supabase, {
    representanteId: representante.id,
    codigo: representante.codigo,
    clickToken,
    atribuiu: !jaEDeOutroRep,
    referer: request.headers.get("referer"),
    utmSource: url.searchParams.get("utm_source"),
    utmMedium: url.searchParams.get("utm_medium"),
    utmCampaign: url.searchParams.get("utm_campaign"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  if (!jaEDeOutroRep) {
    await setIndicacaoCookie({
      codigo: representante.codigo,
      clickToken,
      ts: Math.floor(Date.now() / 1000),
    });
  }

  // O param `ref` some da URL final: o cookie e o carregador da indicacao, e a
  // landing fica limpa para compartilhamento.
  destino.searchParams.delete("ref");
  return NextResponse.redirect(destino, { status: 302 });
}
