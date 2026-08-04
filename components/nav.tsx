import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingCta } from "@/components/landing-cta";
import { LANDING_OFFER } from "@/lib/landing-offer";

const links = [
  { href: "#como", label: "Como funciona" },
  { href: "#beneficios", label: "Benefícios" },
  { href: "#preco", label: "Oferta" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-3 sm:px-8 sm:py-4">
        <Link
          href="/"
          className="group flex items-center transition-opacity hover:opacity-90"
          aria-label="Quando Trocar"
        >
          <Image
            src="/logo-qt.png"
            alt="Quando Trocar"
            width={1441}
            height={403}
            sizes="180px"
            className="h-10 w-auto sm:h-11"
            priority
          />
        </Link>
        <div className="flex-1" />
        <div className="hidden gap-7 text-[13.5px] text-muted lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative py-1 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mx-4 hidden h-5 w-px bg-line lg:block" />
        <LandingCta
          source="landing_nav"
          className="group rounded-xl px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] shadow-none hover:shadow-none sm:px-5 sm:text-[12px]"
        >
          <span className="hidden sm:inline">{LANDING_OFFER.ctaLabel}</span>
          <span className="sm:hidden">{LANDING_OFFER.trialDays} dias grátis</span>
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </LandingCta>
      </div>
    </nav>
  );
}
