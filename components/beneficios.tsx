import { CalendarCheck, CirclePause, Clock3, MessageCircle, Store } from "lucide-react";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealItem, RevealStagger } from "./reveal";

const benefits = [
  { icon: MessageCircle, text: "Registre pelo WhatsApp em poucos segundos." },
  { icon: Clock3, text: "Não dependa da memória da equipe." },
  { icon: CalendarCheck, text: "Lembre o cliente no momento adequado." },
  { icon: Store, text: "Mantenha o nome da oficina presente." },
  { icon: CirclePause, text: "Pare sem custo se não quiser continuar." },
];

export function Beneficios() {
  return (
    <Section tone="gray" id="beneficios">
      <Reveal>
        <Eyebrow>benefícios práticos</Eyebrow>
        <SectionTitle>Menos coisa pra lembrar. Mais motivo pra voltar.</SectionTitle>
        <SectionLead>
          O Quando Trocar cuida da recorrência sem colocar mais um sistema na rotina da oficina.
        </SectionLead>
      </Reveal>
      <RevealStagger as="ul" className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5" stagger={0.07}>
        {benefits.map(({ icon: Icon, text }) => (
          <RevealItem as="li" key={text} className="rounded-2xl border border-line bg-paper p-5">
            <Icon className="size-5 text-brand-deep" aria-hidden="true" />
            <p className="mt-4 text-[15px] font-medium leading-relaxed text-ink">{text}</p>
          </RevealItem>
        ))}
      </RevealStagger>
    </Section>
  );
}
