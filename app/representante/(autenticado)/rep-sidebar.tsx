"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { REP_NAV, type RepNavItem } from "./nav-items";

function isActive(pathname: string, item: RepNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function RepSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex-1 space-y-1 px-2 pb-4">
      {REP_NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition",
              active
                ? "border-brand bg-brand/15 text-paper"
                : "border-transparent text-paper/70 hover:bg-ink/40 hover:text-paper",
            )}
          >
            <Icon size={18} strokeWidth={2} aria-hidden className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
