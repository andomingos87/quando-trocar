import { WhatsappIcon } from "./ui/whatsapp-icon";
import { Button } from "./ui/button";
import { Eyebrow, SectionLead, SectionTitle } from "./section";
import { Reveal } from "./reveal";
import { whatsappLink } from "@/lib/config";

export function CtaFinal() {
  return (
    <section
      id="cta-final"
      className="relative isolate overflow-hidden bg-brand px-5 py-24 text-center text-white sm:px-8 md:py-32"
    >
      {/* gradient base — warm orange → deep ember */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#ffa13a_0%,#f7931e_35%,#d97811_100%)]" />

      {/* blueprint grid — spans full width, fades toward edges */}
      <div className="bg-blueprint bg-blueprint-fade pointer-events-none absolute inset-0" />

      {/* diagonal warning stripes — subtle, bottom band */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #000 0 14px, transparent 14px 28px)",
        }}
      />

      {/* radial glow from top */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(255,255,255,0.28),transparent_65%)]" />

      {/* inner vignette */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.22)]" />

      {/* grain */}
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay" />

      {/* corner tick marks — full-section */}
      <CornerTicks />

      <Reveal className="relative mx-auto max-w-[820px]">
        <Eyebrow tone="ink">tá esperando o quê?</Eyebrow>
        <SectionTitle className="mx-auto text-white">
          Você já tem cliente.
          <br />
          Só precisa{" "}
          <span className="underline-brand-dark text-ink">
            lembrar ele de voltar.
          </span>
        </SectionTitle>
        <SectionLead className="mx-auto text-white/90">
          Teste 30 dias. Sem cartão. Sem pegadinha. Se cliente voltar, a gente
          continua. Se não, você segue sua vida.
        </SectionLead>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Button
            href={whatsappLink("Oi, quero testar o Quando Trocar")}
            target="_blank"
            rel="noopener noreferrer"
            variant="white"
            className="group"
          >
            <WhatsappIcon className="size-5 text-[#25d366] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]" />
            Testar agora no WhatsApp
          </Button>
          <Button
            href="#como"
            variant="ghost"
            className="border-white/70 text-white hover:bg-white hover:text-brand-dark"
          >
            Ver como funciona
          </Button>
        </div>

        <p className="mt-8 font-mono text-[11.5px] uppercase tracking-[0.18em] text-white/80">
          Testando com poucas oficinas nessa rodada · ainda tem vagas
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
