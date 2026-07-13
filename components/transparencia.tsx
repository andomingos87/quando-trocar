import { CirclePause, CreditCard, Headphones, Tag } from "lucide-react";
import { LANDING_OFFER } from "@/lib/landing-offer";

const assurances = [
  { icon: CreditCard, label: "Sem cobrança automática" },
  { icon: Tag, label: "Preço claro desde o início" },
  { icon: CirclePause, label: "Sem continuar, o serviço pausa" },
  { icon: Headphones, label: "Atendimento próximo no WhatsApp" },
];

export function Transparencia() {
  return (
    <section className="border-y border-line bg-brand-soft/50 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[1080px]">
        <p className="max-w-[820px] text-left text-[clamp(1rem,1.5vw,1.125rem)] font-medium leading-relaxed text-ink">
          Estamos começando agora. Por isso, você testa por {LANDING_OFFER.trialDays} dias sem pagar e
          acompanha o funcionamento na prática antes de decidir.
        </p>
        <ul className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
          {assurances.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5">
              <Icon className="size-4 flex-none text-brand-deep" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
