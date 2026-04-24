"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "right" | "down" | "left" | "scale" | "fade";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "true";
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "true";
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className,
  as = "div",
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  amount?: number;
  as?: "div" | "section" | "li" | "article" | "span";
}) {
  const ref = useReveal<HTMLElement>();
  const Tag = as as "div";
  const style: CSSProperties = {
    transitionDuration: `${duration}s`,
    transitionDelay: `${delay}s`,
  };
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal={direction}
      className={cn("reveal", className)}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function RevealStagger({
  children,
  className,
  stagger = 0.1,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  amount?: number;
  as?: "div" | "section" | "ul" | "ol";
}) {
  const ref = useReveal<HTMLElement>();
  const Tag = as as "div";
  const style = {
    "--reveal-stagger": `${stagger}s`,
    "--reveal-delay": `${delay}s`,
  } as CSSProperties;
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal-stagger=""
      className={cn("reveal-stagger", className)}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "span";
}) {
  const Tag = as as "div";
  return (
    <Tag data-reveal-item="" className={cn("reveal-item", className)}>
      {children}
    </Tag>
  );
}
