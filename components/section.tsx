import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark" | "gray" | "brand";

const toneClass: Record<Tone, string> = {
  light: "bg-paper text-ink",
  dark: "bg-ink text-white",
  gray: "bg-paper-soft text-ink",
  brand: "bg-brand text-white",
};

export function Section({
  tone = "light",
  id,
  className,
  children,
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative px-5 py-20 sm:px-8 md:py-28",
        toneClass[tone],
        className,
      )}
    >
      <div className="relative mx-auto max-w-[1080px]">{children}</div>
    </section>
  );
}

export function Eyebrow({
  tone = "brand",
  children,
}: {
  tone?: "brand" | "ink" | "white";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]",
        tone === "ink" && "text-ink",
        tone === "brand" && "text-brand",
        tone === "white" && "text-white/70",
      )}
    >
      <span
        className={cn(
          "h-px w-6",
          tone === "ink" && "bg-ink",
          tone === "brand" && "bg-brand",
          tone === "white" && "bg-white/40",
        )}
      />
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-display max-w-[780px] text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.02]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function SectionLead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-5 max-w-[620px] text-[clamp(1rem,1.3vw,1.1rem)] leading-relaxed text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
