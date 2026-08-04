"use client";

import { useEffect, useState } from "react";
import { WhatsappIcon } from "./ui/whatsapp-icon";
import { cn } from "@/lib/utils";
import {
  LANDING_OFFER,
  buildLandingWhatsappLink,
  shouldShowFloatingCta,
} from "@/lib/landing-offer";

// `repSufixo` chega por prop porque o cookie de indicacao e httpOnly: quem le e
// o server (app/page.tsx), nunca este componente.
export function FloatingCta({ repSufixo }: { repSufixo?: string | null }) {
  const [visibility, setVisibility] = useState({
    heroCtaVisible: true,
    offerCtaVisible: false,
    finalCtaVisible: false,
  });

  useEffect(() => {
    const targets = [
      ["landing_hero", "heroCtaVisible"],
      ["landing_oferta", "offerCtaVisible"],
      ["landing_cta_final", "finalCtaVisible"],
    ] as const;
    const observers = targets.flatMap(([source, key]) => {
      const element = document.querySelector(`[data-landing-cta='${source}']`);
      if (!element) return [];
      const observer = new IntersectionObserver(
        ([entry]) => setVisibility((current) => ({ ...current, [key]: entry.isIntersecting })),
        { threshold: 0.25 },
      );
      observer.observe(element);
      return [observer];
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const visible = shouldShowFloatingCta(visibility);

  return (
    <a
      href={buildLandingWhatsappLink("landing_floating_mobile", undefined, repSufixo)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${LANDING_OFFER.ctaLabel} no WhatsApp`}
      data-landing-cta="landing_floating_mobile"
      className={cn(
        "group fixed inset-x-3 z-40 flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-brand px-5 py-3 text-[14px] font-semibold text-white shadow-xl transition-all duration-300 md:hidden",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))] hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-5 opacity-0",
      )}
    >
      <WhatsappIcon className="size-5" />
      {LANDING_OFFER.ctaLabel}
    </a>
  );
}
