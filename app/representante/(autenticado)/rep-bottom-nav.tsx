"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { REP_NAV, type RepNavItem } from "./nav-items";

function isActive(pathname: string, item: RepNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Barra inferior fixa — so mobile. Mostra os itens `primary`; o resto vive no
// menu do topo. O rep opera o portal no celular (mobile-first).
export function RepBottomNav() {
  const pathname = usePathname() ?? "";
  const items = REP_NAV.filter((i) => i.primary);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition",
              active ? "text-brand-dark" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
