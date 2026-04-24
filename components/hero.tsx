import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneDemo } from "@/components/phone-demo";

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
            <span className="size-1.5 animate-pulse-dot rounded-full bg-brand" />
            em teste com oficinas reais
          </span>

          <h1 className="font-display mt-6 text-[clamp(2.5rem,6.2vw,4.75rem)] font-bold leading-[0.98]">
            Seu cliente{" "}
            <span className="relative whitespace-nowrap">
              <span className="line-through decoration-brand decoration-[4px] underline-offset-2">
                esquece
              </span>
            </span>
            <br />
            de <span className="text-brand">voltar</span> pra você.
            <br />
            <span className="text-muted/70">A gente resolve.</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[clamp(1rem,1.4vw,1.1875rem)] leading-relaxed text-muted">
            Você manda uma mensagem.{" "}
            <b className="font-semibold text-ink">A gente cuida do resto.</b>{" "}
            Quando chegar a hora da próxima troca, o cliente volta — sem você
            precisar lembrar de nada.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="#cta-final">
              Testar grátis por 30 dias
              <ArrowRight className="size-4" />
            </Button>
            <Button href="#como" variant="ghost" className="px-5 py-3.5">
              Ver como funciona
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted">
            {["Sem cartão", "Sem instalar nada", "Só WhatsApp"].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-3 text-brand" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <PhoneDemo />
      </div>
    </section>
  );
}
