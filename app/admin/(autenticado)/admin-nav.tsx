"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_STANDALONE,
  type AdminNavGroup,
  type AdminNavItem,
} from "./nav-items";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-nav:collapsed-groups";

function isActive(pathname: string, item: AdminNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function groupHasActive(pathname: string, group: AdminNavGroup) {
  return group.items.some((item) => isActive(pathname, item));
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";

  // Grupo que contém a rota atual — usado para abrir automaticamente.
  const activeGroupId = useMemo(
    () => ADMIN_NAV_GROUPS.find((group) => groupHasActive(pathname, group))?.id ?? null,
    [pathname],
  );

  // Grupos explicitamente fechados pelo usuário (persistido em localStorage).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Restaura o estado salvo depois da montagem (evita mismatch de hidratação).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // localStorage indisponível — segue com todos os grupos abertos.
    }
  }, []);

  // Ao navegar para um grupo, garante que ele fique aberto.
  useEffect(() => {
    if (!activeGroupId) return;
    setCollapsed((prev) => {
      if (!prev[activeGroupId]) return prev;
      const next = { ...prev, [activeGroupId]: false };
      persist(next);
      return next;
    });
  }, [activeGroupId]);

  function persist(next: Record<string, boolean>) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora erros de persistência
    }
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persist(next);
      return next;
    });
  }

  return (
    <nav className="flex-1 px-2 pb-4">
      {ADMIN_NAV_STANDALONE.length > 0 ? (
        <ul className="space-y-1">
          {ADMIN_NAV_STANDALONE.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                active={isActive(pathname, item)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-3">
        {ADMIN_NAV_GROUPS.map((group) => {
          const open = !collapsed[group.id];
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-paper/40 transition hover:text-paper/70"
              >
                <span>{group.label}</span>
                <Chevron open={open} />
              </button>
              {open ? (
                <ul className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        item={item}
                        active={isActive(pathname, item)}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-lg border-l-2 px-3 py-2 text-sm transition",
        active
          ? "border-brand bg-brand/15 text-paper"
          : "border-transparent text-paper/70 hover:bg-ink/40 hover:text-paper",
      )}
    >
      {item.label}
    </Link>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0 transition-transform", open ? "rotate-0" : "-rotate-90")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
