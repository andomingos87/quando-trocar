import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "default" | "sucesso" | "atencao" | "erro" | "brand";

const RINGS: Record<Tone, string> = {
  default: "ring-line",
  sucesso: "ring-cyan/50",
  atencao: "ring-orange/50",
  erro: "ring-red/40",
  brand: "ring-brand/40",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-5 ring-1",
        RINGS[tone],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-line-soft px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function CardValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-2xl font-semibold tabular-nums text-ink", className)}>
      {children}
    </p>
  );
}

export function CardHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-xs text-muted", className)}>{children}</p>
  );
}
