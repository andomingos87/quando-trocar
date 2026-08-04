import { NextResponse, type NextRequest } from "next/server";

// Unico papel do middleware: normalizar o link de indicacao do representante.
// Um rep pode compartilhar `/r/CODIGO` (curto) ou qualquer URL do site com
// `?ref=CODIGO` (util em anuncio, bio, QR de material impresso). Aqui o segundo
// formato e redirecionado para o primeiro, para que a validacao do codigo, o
// registro do clique e a gravacao do cookie fiquem num lugar so
// (app/r/[codigo]/route.ts).
//
// Nao roda em /api, /admin, /representante nem em assets (ver `config` abaixo).

const CODIGO_REGEX = /^[A-Za-z0-9][A-Za-z0-9-]{1,29}$/;

export function middleware(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref || !CODIGO_REGEX.test(ref)) return NextResponse.next();

  const destino = new URL(request.nextUrl);
  destino.searchParams.delete("ref");

  const rota = new URL(`/r/${encodeURIComponent(ref.toUpperCase())}`, request.nextUrl.origin);
  // `next` preserva a pagina (e os utm_*) que o visitante pediu.
  rota.searchParams.set("next", `${destino.pathname}${destino.search}`);
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) rota.searchParams.set(key, value);
  }

  return NextResponse.redirect(rota, { status: 302 });
}

export const config = {
  matcher: ["/((?!api|admin|representante|r/|_next|.*\\..*).*)"],
};
