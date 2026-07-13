import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";
import { LANDING_OFFER } from "@/lib/landing-offer";

const items = [
  {
    q: "Não tenho tempo pra ficar mexendo em mais um sistema.",
    a: (
      <>
        <b className="text-ink">É um WhatsApp de 30 segundos.</b> Você já tá no
        WhatsApp o dia inteiro. Manda a troca do jeito que for mais rápido —
        texto, áudio ou foto da nota — e pronto.
      </>
    ),
  },
  {
    q: "Já tenho sistema de gestão na oficina.",
    a: (
      <>
        <b className="text-ink">Isso aqui não substitui.</b> Seu sistema
        continua do jeito que tá. O Quando Trocar cuida do lembrete de retorno;
        são funções diferentes.
      </>
    ),
  },
  {
    q: "O cliente vai achar que é spam?",
    a: (
      <>
        <b className="text-ink">Cliente não gosta de spam.</b> Lembrete na hora
        certa ele agradece. A mensagem é assinada como a sua oficina, não como
        robô. O contato acontece quando existe contexto de manutenção.
      </>
    ),
  },
  {
    q: `O que acontece depois dos ${LANDING_OFFER.trialDays} dias?`,
    a: (
      <>
        <b className="text-ink">O serviço é pausado, sem cobrança automática.</b>{" "}
        Para continuar, você confirma a assinatura de R$ {LANDING_OFFER.monthlyPrice} por mês pelo WhatsApp.
      </>
    ),
  },
];

export function Objecoes() {
  return (
    <Section tone="gray" id="objecoes">
      <Reveal>
        <Eyebrow>vamos direto ao ponto</Eyebrow>
        <SectionTitle>
          <span className="text-muted/70">“Mas</span>
          <span className="text-ink">...”</span>
        </SectionTitle>
        <SectionLead>
          As dúvidas comerciais que precisam estar claras antes do teste.
        </SectionLead>
      </Reveal>

      <RevealStagger stagger={0.07} className="mt-12">
        <Accordion
          type="single"
          collapsible
          defaultValue="q-0"
          className="grid gap-3"
        >
          {items.map((item, i) => (
            <RevealItem key={item.q}>
              <AccordionItem value={`q-${i}`} className="rounded-2xl">
                <AccordionTrigger quote>{item.q}</AccordionTrigger>
                <AccordionContent className="pl-14 pr-6">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            </RevealItem>
          ))}
        </Accordion>
      </RevealStagger>
    </Section>
  );
}
