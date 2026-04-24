import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";

const steps = [
  {
    n: "01",
    title: "Você registra",
    body: "Pelo WhatsApp. Texto, áudio ou foto da nota. 30 segundos.",
    demo: {
      text: '"Roberto, Gol 2014, 45 mil km, 20W50. Anota aí."',
      side: "me" as const,
    },
  },
  {
    n: "02",
    title: "A gente agenda",
    body: "Calculamos quando o cliente precisa voltar. Você não faz nada.",
    demo: {
      text: "✓ Anotado. Próxima troca: ~set/2026. Monitorando km.",
      side: "them" as const,
    },
  },
  {
    n: "03",
    title: "Cliente volta",
    body: "Na hora certa, o bot convida o cliente. Ele agenda. Volta pra você.",
    demo: {
      text: "Oi Roberto, tá na hora da troca do Gol. Qui 14h ou sex 9h?",
      side: "them" as const,
    },
  },
];

export function ComoFunciona() {
  return (
    <Section id="como">
      <Reveal>
        <Eyebrow>como funciona</Eyebrow>
        <SectionTitle>
          Três passos.
          <br />
          Sem complicação.
        </SectionTitle>
        <SectionLead>
          Você não muda nada do jeito que trabalha. Só manda a troca pra gente,
          do jeito que for mais rápido.
        </SectionLead>
      </Reveal>

      <RevealStagger className="mt-14 grid gap-5 md:grid-cols-3" stagger={0.12}>
        {steps.map((step) => (
          <RevealItem
            as="article"
            key={step.n}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-ink/20 hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                passo
              </div>
              <div className="font-display text-[3rem] font-bold leading-none tracking-tighter text-ink/10 transition-colors duration-300 group-hover:text-brand">
                {step.n}
              </div>
            </div>
            <h3 className="font-display mt-5 text-[1.35rem] font-bold leading-tight">
              {step.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {step.body}
            </p>
            <div
              className={
                step.demo.side === "me"
                  ? "mt-5 rounded-[12px] rounded-tr-[2px] bg-wa-me px-3.5 py-2.5 text-[13px] leading-snug shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                  : "mt-5 rounded-[12px] rounded-tl-[2px] border border-line bg-white px-3.5 py-2.5 text-[13px] leading-snug shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
              }
            >
              {step.demo.text}
            </div>
          </RevealItem>
        ))}
      </RevealStagger>

      <Reveal delay={0.1} className="mt-14 text-center">
        <Button href="#cta-final" className="group">
          Quero colocar pra rodar
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </Reveal>
    </Section>
  );
}
