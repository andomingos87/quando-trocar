"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Megaphone, User } from "lucide-react";

import { cn } from "@/lib/utils";

function initialsFrom(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RepUserMenu({ nome, codigo }: { nome: string; codigo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/representante/auth/logout", { method: "POST" });
    } finally {
      router.replace("/representante/entrar");
      router.refresh();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 transition hover:border-line hover:bg-paper-soft",
          open && "border-line bg-paper-soft",
        )}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep ring-1 ring-brand/30"
          aria-hidden
        >
          {initialsFrom(nome)}
        </span>
        <span className="hidden min-w-0 flex-col text-left sm:flex">
          <span className="truncate text-sm font-medium text-ink">{nome}</span>
          <span className="truncate text-[11px] font-medium tabular-nums text-muted">
            #REP-{codigo}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={cn("hidden text-muted transition sm:block", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Menu do representante"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-lg ring-1 ring-ink/5"
        >
          <div className="border-b border-line-soft bg-paper-soft px-4 py-3 sm:hidden">
            <p className="truncate text-sm font-medium text-ink">{nome}</p>
            <p className="truncate text-[11px] font-medium tabular-nums text-muted">
              #REP-{codigo}
            </p>
          </div>
          <nav className="py-1.5 text-sm">
            <Link
              href="/representante/novidades"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2 text-ink transition hover:bg-paper-soft"
            >
              <Megaphone size={16} className="shrink-0 text-muted" aria-hidden />
              Novidades
            </Link>
            <Link
              href="/representante/perfil"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2 text-ink transition hover:bg-paper-soft"
            >
              <User size={16} className="shrink-0 text-muted" aria-hidden />
              Perfil
            </Link>
          </nav>
          <div className="border-t border-line-soft py-1.5">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red transition hover:bg-red-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={16} className="shrink-0" aria-hidden />
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
