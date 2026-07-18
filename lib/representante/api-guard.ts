import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  clearRepresentanteSessionCookie,
  getRepresentanteFromCookie,
} from "./session";
import {
  type RepresentanteAtivo,
  getActiveRepresentanteById,
} from "./representante";

// Guard do portal do representante (ADR-0025). Alem de validar o JWT do cookie,
// RE-VERIFICA no banco `ativo`/`deleted_at` a CADA requisicao — a autorizacao
// nao pode depender so do claim assinado, porque um rep pode ser desativado no
// meio da sessao. Sessao invalida limpa o cookie.

// Server component: redireciona para /representante/entrar se nao autenticado.
export async function requireRepresentante(): Promise<RepresentanteAtivo> {
  const claims = await getRepresentanteFromCookie();
  if (!claims) {
    redirect("/representante/entrar");
  }
  const supabase = createSupabaseAdminClient();
  const rep = await getActiveRepresentanteById(supabase, claims.representanteId);
  if (!rep) {
    await clearRepresentanteSessionCookie();
    redirect("/representante/entrar");
  }
  return rep;
}

export type RequireRepresentanteApiResult =
  | { ok: true; representante: RepresentanteAtivo }
  | { ok: false; response: NextResponse };

// Route handler: retorna 401 JSON em vez de redirecionar.
export async function requireRepresentanteApi(): Promise<RequireRepresentanteApiResult> {
  const claims = await getRepresentanteFromCookie();
  if (!claims) {
    return unauthorized();
  }
  const supabase = createSupabaseAdminClient();
  const rep = await getActiveRepresentanteById(supabase, claims.representanteId);
  if (!rep) {
    await clearRepresentanteSessionCookie();
    return unauthorized();
  }
  return { ok: true, representante: rep };
}

function unauthorized(): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, message: "Nao autenticado." },
      { status: 401 },
    ),
  };
}
