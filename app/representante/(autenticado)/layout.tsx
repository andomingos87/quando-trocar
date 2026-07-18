import Image from "next/image";
import type { ReactNode } from "react";

import { requireRepresentante } from "@/lib/representante/api-guard";
import { RepBottomNav } from "./rep-bottom-nav";
import { RepSidebar } from "./rep-sidebar";
import { RepUserMenu } from "./rep-user-menu";

export const dynamic = "force-dynamic";

export default async function RepresentanteAuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Guard: valida sessao E re-verifica ativo/deletado a cada request (ADR-0025).
  const rep = await requireRepresentante();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-deep text-paper md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <Image
            src="/logo_qt_byperfect_white.png"
            alt="Quando Trocar"
            width={140}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </div>
        <p className="px-5 pb-3 text-[10px] font-medium uppercase tracking-widest text-paper/50">
          Portal do representante
        </p>
        <div className="flex-1 overflow-y-auto">
          <RepSidebar />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Image
              src="/logo_qt_byperfect.png"
              alt="Quando Trocar"
              width={120}
              height={28}
              className="h-7 w-auto"
            />
          </div>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-muted md:block">
            Portal do representante
          </span>
          <RepUserMenu nome={rep.nome} codigo={rep.codigo} />
        </header>
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 sm:py-8 md:pb-8">{children}</main>
      </div>
      <RepBottomNav />
    </div>
  );
}
