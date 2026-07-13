import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneDemo } from "@/components/phone-demo";
import { LandingCta } from "@/components/landing-cta";
import { LANDING_OFFER } from "@/lib/landing-offer";

export function Hero() {
  return (
    <section
      data-section="hero"
      className="relative overflow-hidden"
    >
      <div className="bg-grain absolute inset-0 -z-10 opacity-40" />
      <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-brand)_10%,transparent)_0%,transparent_70%)]" />

      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-12 pt-10 sm:px-8 md:grid-cols-[1.05fr_1fr] md:gap-16 md:pt-20 md:pb-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand-soft/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-brand-deep">
            <span className="size-1.5 rounded-full bg-brand" />
            {LANDING_OFFER.trialDays} dias grátis para oficinas
          </span>

          <h1 className="font-display mt-6 text-[clamp(2.5rem,6.2vw,4.75rem)] font-bold leading-[0.98]">
            Seu cliente não esquece da troca.
            <br />
            Ele esquece de <span className="text-brand">voltar pra você.</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[clamp(1rem,1.4vw,1.1875rem)] leading-relaxed text-muted">
            Registre o serviço pelo WhatsApp. O Quando Trocar calcula a próxima
            data e lembra o cliente na hora certa — com o nome da sua oficina.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <LandingCta source="landing_hero">
              {LANDING_OFFER.ctaLabel}
              <ArrowRight className="size-4" />
            </LandingCta>
            <Button href="#como" variant="ghost" className="px-5 py-3.5">
              Ver como funciona
            </Button>
          </div>

          <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
            <Check className="size-4 text-brand-deep" strokeWidth={3} />
            {LANDING_OFFER.microcopy}
          </p>
        </div>

        <PhoneDemo />
      </div>
    </section>
  );
}
