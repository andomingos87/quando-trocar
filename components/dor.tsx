import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";
import { CountUp } from "./count-up";

const timeline = [
  { month: "mar", text: "Cliente troca óleo com você.", active: true },
  { month: "abr", text: "Silêncio.", active: false },
  { month: "mai", text: "Silêncio.", active: false },
  { month: "jun", text: "Ele precisa trocar de novo.", active: true },
];

export function Dor() {
  return (
    <Section tone="dark" id="dor" className="overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 text-white/[0.03]" />
      <div className="relative">
        <Reveal>
          <Eyebrow tone="white">a dor</Eyebrow>
          <SectionTitle className="text-white">
            Seja honesto:
            <br />
            quantos clientes você{" "}
            <span className="text-brand">perde por mês?</span>
          </SectionTitle>
          <SectionLead className="text-white/60">
            Não é falta de cliente. É falta de lembrar ele na hora certa.
          </SectionLead>
        </Reveal>

        <div className="mt-14 grid items-start gap-12 md:grid-cols-[1.1fr_1fr] md:gap-20">
          <RevealStagger as="ol" className="relative space-y-3" stagger={0.08}>
            <span className="absolute left-[18px] top-2 bottom-16 w-px bg-white/10" />
            {timeline.map((row) => (
              <RevealItem
                as="li"
                key={row.month}
                className="relative flex items-start gap-4"
              >
                <span
                  className={
                    row.active
                      ? "relative z-10 mt-0.5 flex size-9 flex-none items-center justify-center rounded-full border border-brand bg-ink font-mono text-[10px] uppercase tracking-wider text-brand"
                      : "relative z-10 mt-0.5 flex size-9 flex-none items-center justify-center rounded-full border border-white/15 bg-ink font-mono text-[10px] uppercase tracking-wider text-white/40"
                  }
                >
                  {row.month}
                </span>
                <span
                  className={
                    row.active
                      ? "pt-1.5 text-[clamp(1.125rem,1.8vw,1.4rem)] font-medium leading-snug text-white"
                      : "pt-1.5 text-[clamp(1.125rem,1.8vw,1.4rem)] font-medium leading-snug text-white/35"
                  }
                >
                  {row.text}
                </span>
              </RevealItem>
            ))}
            <RevealItem
              as="li"
              className="relative flex items-start gap-4 pt-2"
            >
              <span className="mt-1.5 flex size-9 flex-none items-center justify-center text-brand">
                →
              </span>
              <span className="pt-1.5 text-[clamp(1.125rem,1.8vw,1.4rem)] font-semibold leading-snug text-brand">
                Mas nem você nem ele lembram.
              </span>
            </RevealItem>
            <RevealItem as="li" className="relative flex items-start gap-4">
              <span className="mt-1.5 flex size-9 flex-none items-center justify-center text-brand">
                →
              </span>
              <span className="pt-1.5 text-[clamp(1.125rem,1.8vw,1.4rem)] font-semibold leading-snug text-brand">
                Ele vai pra outra oficina.
              </span>
            </RevealItem>
            <RevealItem as="li" className="pt-6 font-mono text-sm text-white/45">
              E você <span className="text-white">nem sabe</span> que perdeu.
            </RevealItem>
          </RevealStagger>

          <Reveal direction="left" delay={0.15}>
            <figure className="glow-border relative overflow-hidden rounded-2xl p-8 md:p-10">
              {/* diagonal stripes texture */}
              <div className="bg-stripes-soft pointer-events-none absolute inset-0" />
              {/* soft brand glow in corner */}
              <div className="animate-glow-pulse pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(247,147,30,0.22),transparent_65%)]" />

              <div className="relative">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40">
                  Estimativa do setor
                </div>
                <div className="font-display mt-4 text-[clamp(5rem,10vw,9rem)] font-bold leading-[0.85] tracking-tighter text-brand">
                  <CountUp to={62} suffix="%" />
                </div>
                <figcaption className="mt-5 max-w-[280px] text-[15px] leading-relaxed text-white/70">
                  dos clientes{" "}
                  <span className="font-semibold text-white">
                    não voltam sozinhos
                  </span>
                  . Cada um vale cerca de{" "}
                  <span className="font-mono text-white">R$220</span> em
                  serviço.
                </figcaption>
              </div>
            </figure>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
