"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminNavItem } from "./nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, item: AdminNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminNav({
  items,
  onNavigate,
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex-1 px-2 pb-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "block rounded-lg border-l-2 px-3 py-2 text-sm transition",
                  active
                    ? "border-brand bg-brand/15 text-paper"
                    : "border-transparent text-paper/70 hover:bg-ink/40 hover:text-paper",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
