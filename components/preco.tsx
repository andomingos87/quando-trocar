import { ArrowRight, Check } from "lucide-react";
import { LandingCta } from "./landing-cta";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";
import { LANDING_OFFER } from "@/lib/landing-offer";

export function Preco() {
  return (
    <Section tone="dark" id="preco" className="overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 text-white/[0.03]" />

      <div className="relative">
        <Reveal>
          <Eyebrow tone="white">oferta clara desde o início</Eyebrow>
          <SectionTitle className="text-white">
            Teste por {LANDING_OFFER.trialDays} dias.
            <br /><span className="text-brand">Depois, R$ {LANDING_OFFER.monthlyPrice} por mês.</span>
          </SectionTitle>
          <SectionLead className="text-white/65">
            Durante o teste, você usa o Quando Trocar sem cartão e sem cobrança.
            Ao final, o serviço é pausado até você confirmar a assinatura pelo WhatsApp.
          </SectionLead>
        </Reveal>

        <Reveal
          direction="scale"
          delay={0.15}
          className="relative mx-auto mt-14 max-w-[540px]"
        >
          <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 -rotate-[2.5deg] rounded-full border border-ink bg-brand px-4 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink shadow-lg">
            teste · {LANDING_OFFER.trialDays} dias
          </span>

          <div className="relative rounded-3xl border border-ink bg-paper p-8 text-left text-ink shadow-2xl sm:p-12">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
              <div>
                <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-bold leading-tight">
                  Quando Trocar
                  <br />mensal
                </h3>
              </div>
              <div className="font-mono text-right text-[10.5px] uppercase tracking-[0.18em] text-muted">
                plano
                <br />
                único
              </div>
            </div>

            <div className="flex items-baseline gap-3 py-6">
              <span className="font-display text-[clamp(3rem,8vw,4.5rem)] font-bold leading-none tracking-tighter text-brand">
                R$ 0
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                / primeiros<br />{LANDING_OFFER.trialDays} dias
              </span>
            </div>

            <RevealStagger
              as="ul"
              className="border-t border-line pt-2"
              stagger={0.06}
              delay={0.15}
            >
              {LANDING_OFFER.benefits.map((f) => (
                <RevealItem
                  as="li"
                  key={f}
                  className="flex items-center gap-3 border-b border-line py-3 text-[15px] last:border-b-0"
                >
                  <span className="flex size-5 flex-none items-center justify-center rounded-full bg-ink text-white">
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                  {f}
                </RevealItem>
              ))}
            </RevealStagger>

            <LandingCta source="landing_oferta" className="group mt-8 w-full">
              {LANDING_OFFER.ctaLabel}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </LandingCta>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              Para continuar depois do teste, confirme {LANDING_OFFER.monthlyPriceLabel} pelo WhatsApp.
              Sem confirmação, nada é cobrado e o serviço fica pausado.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
