import { ArrowRight, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";

const features = [
  "Sem cartão de crédito",
  "Sem contrato",
  "Sem instalação de app",
  "Clientes ilimitados no teste",
  "Suporte direto pelo WhatsApp",
];

export function Preco() {
  return (
    <Section tone="dark" id="preco" className="overflow-hidden text-center">
      <div className="bg-dots pointer-events-none absolute inset-0 text-white/[0.03]" />

      <div className="relative">
        <Reveal className="flex flex-col items-center">
          <Eyebrow tone="white">teste grátis · 30 dias</Eyebrow>
          <SectionTitle className="mx-auto text-white">
            30 dias pra decidir.
            <br />
            <span className="text-brand">Risco zero.</span>
          </SectionTitle>
          <SectionLead className="mx-auto text-white/60">
            Se cliente voltar, a gente continua. Se não, você segue sua vida.
          </SectionLead>
        </Reveal>

        <Reveal
          direction="scale"
          delay={0.15}
          className="relative mx-auto mt-14 max-w-[540px]"
        >
          <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 -rotate-[2.5deg] rounded-full border border-ink bg-brand px-4 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink shadow-[0_6px_0_rgba(0,0,0,0.25)]">
            teste · 30 dias
          </span>

          <div className="relative rounded-3xl border border-ink bg-paper p-8 text-left text-ink shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)] sm:p-12">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
              <div>
                <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-bold leading-tight">
                  A gente faz
                  <br />o cliente voltar.
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
                / primeiros
                <br />
                30 dias
              </span>
            </div>

            <RevealStagger
              as="ul"
              className="border-t border-line pt-2"
              stagger={0.06}
              delay={0.15}
            >
              {features.map((f) => (
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

            <Button href="#cta-final" className="group mt-8 w-full">
              Quero testar na minha oficina
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              Se cliente voltar, a gente conversa sobre continuar. Se não
              voltar, você não paga nada.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
