import { WhatsappIcon } from "./ui/whatsapp-icon";
import { Button } from "./ui/button";
import { Eyebrow, SectionLead, SectionTitle } from "./section";
import { Reveal } from "./reveal";
import { LandingCta } from "./landing-cta";
import { LANDING_OFFER } from "@/lib/landing-offer";

export function CtaFinal() {
  return (
    <section
      id="cta-final"
      className="relative isolate overflow-hidden bg-brand px-5 py-24 text-white sm:px-8 md:py-32"
    >
      {/* gradient base — amber impulse from logo's "CAR" */}
      <div className="pointer-events-none absolute inset-0 bg-brand" />

      {/* blueprint grid — spans full width, fades toward edges */}
      <div className="bg-blueprint bg-blueprint-fade pointer-events-none absolute inset-0" />

      {/* diagonal warning stripes — subtle, bottom band */}
      <div className="bg-stripes-soft pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-40" />

      {/* radial glow from top */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,color-mix(in_srgb,var(--color-paper)_28%,transparent),transparent_65%)]" />

      {/* inner vignette */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_color-mix(in_srgb,var(--color-ink)_22%,transparent)]" />

      {/* grain */}
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay" />

      {/* corner tick marks — full-section */}
      <CornerTicks />

      <Reveal className="relative mx-auto max-w-[820px] text-left">
        <Eyebrow tone="ink">tá esperando o quê?</Eyebrow>
        <SectionTitle className="text-white">
          Você já tem cliente.
          <br />
          Só precisa{" "}
          <span className="underline-brand-dark text-ink">
            lembrar ele de voltar.
          </span>
        </SectionTitle>
        <SectionLead className="text-white/90">
          Comece sem cartão e sem cobrança automática. Depois dos {LANDING_OFFER.trialDays} dias,
          continue por {LANDING_OFFER.monthlyPriceLabel} ou deixe o serviço pausado.
        </SectionLead>

        <div className="mt-12 flex flex-wrap gap-3">
          <LandingCta source="landing_cta_final" variant="white" className="group">
            <WhatsappIcon className="size-5 text-wa-green transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]" />
            {LANDING_OFFER.ctaLabel}
          </LandingCta>
          <Button
            href="#como"
            variant="ghost"
            className="border-white/70 text-white hover:bg-white hover:text-brand-dark"
          >
            Ver como funciona
          </Button>
        </div>

        <p className="mt-8 font-mono text-[11.5px] uppercase tracking-[0.14em] text-white/85">
          Sem cartão · sem fidelidade · cancele quando quiser
        </p>
      </Reveal>
    </section>
  );
}

function CornerTicks() {
  const base =
    "pointer-events-none absolute size-7 border-white/35 sm:size-10";
  return (
    <>
      <span className={`${base} left-5 top-5 border-l border-t sm:left-8 sm:top-8`} />
      <span
        className={`${base} right-5 top-5 border-r border-t sm:right-8 sm:top-8`}
      />
      <span
        className={`${base} bottom-5 left-5 border-b border-l sm:bottom-8 sm:left-8`}
      />
      <span
        className={`${base} bottom-5 right-5 border-b border-r sm:bottom-8 sm:right-8`}
      />
    </>
  );
}
