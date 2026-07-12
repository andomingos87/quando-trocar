"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shell de modal acessivel: role=dialog + aria-modal, fecha no Esc e no
 * backdrop, trava o scroll do body e foca o dialog ao abrir.
 */
export function Modal({
  title,
  subtitle,
  badge,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div onClick={onClose} className="absolute inset-0 bg-ink-deep/50" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none max-h-[90vh] sm:p-6",
          size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              {badge}
            </div>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted transition hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
