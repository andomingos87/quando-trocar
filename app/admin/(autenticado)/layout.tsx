import Image from "next/image";
import type { ReactNode } from "react";

import { getAdminProfile } from "@/lib/admin/admins";
import { requireAdmin } from "@/lib/admin/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "./admin-nav";
import { AdminUserMenu } from "./admin-user-menu";
import { MobileMenu } from "./mobile-menu";
import { ADMIN_NAV_ITEMS } from "./nav-items";
import { SidebarFooter } from "./sidebar-footer";

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const profile = await getAdminProfile(supabase, session.adminId);

  const nome = profile?.nome ?? "Admin";
  const whatsapp = profile?.whatsapp ?? session.whatsapp;

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
          Painel admin
        </p>
        <div className="flex-1 overflow-y-auto">
          <AdminNav items={ADMIN_NAV_ITEMS} />
        </div>
        <SidebarFooter />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <MobileMenu />
            <span className="text-xs font-medium uppercase tracking-widest text-muted sm:hidden">
              Admin
            </span>
          </div>
          <AdminUserMenu nome={nome} whatsapp={whatsapp} />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
