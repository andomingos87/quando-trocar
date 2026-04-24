"use client";

import { useEffect, useState } from "react";
import { WhatsappIcon } from "./ui/whatsapp-icon";
import { whatsappLink } from "@/lib/config";
import { cn } from "@/lib/utils";

export function FloatingCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-section='hero']");
    const final = document.getElementById("cta-final");
    if (!hero) return;

    const heroObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setVisible(!e.isIntersecting));
      },
      { threshold: 0 },
    );
    heroObs.observe(hero);

    let finalObs: IntersectionObserver | null = null;
    if (final) {
      finalObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setVisible(false);
          });
        },
        { threshold: 0.3 },
      );
      finalObs.observe(final);
    }

    return () => {
      heroObs.disconnect();
      finalObs?.disconnect();
    };
  }, []);

  return (
    <a
      href={whatsappLink("Oi, quero testar o Quando Trocar")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Testar grátis no WhatsApp"
      className={cn(
        "group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-[#25d366] py-3.5 pl-4 pr-5 text-[14px] font-semibold text-white transition-all duration-300",
        "shadow-[0_12px_30px_-8px_rgba(37,211,102,0.55),_0_4px_12px_-2px_rgba(0,0,0,0.15)]",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-8px_rgba(37,211,102,0.65),_0_6px_16px_-2px_rgba(0,0,0,0.2)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-5 opacity-0",
      )}
    >
      <WhatsappIcon className="size-5" />
      Testar grátis
    </a>
  );
}
