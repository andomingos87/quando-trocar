import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone =
  | "sucesso"
  | "info"
  | "atencao"
  | "erro"
  | "inativo"
  | "brand";

const TONES: Record<StatusTone, string> = {
  sucesso: "bg-cyan-soft text-ink ring-1 ring-cyan/40",
  info: "bg-cyan-soft text-ink ring-1 ring-cyan/40",
  atencao: "bg-orange-soft text-[#8a5a00] ring-1 ring-orange/40",
  erro: "bg-red-soft text-red ring-1 ring-red/30",
  inativo: "bg-line-soft text-muted ring-1 ring-line",
  brand: "bg-brand-soft text-brand-deep ring-1 ring-brand/30",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
