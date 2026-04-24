import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Eyebrow, Section, SectionLead, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";

const items = [
  {
    q: "Não tenho tempo pra ficar mexendo em mais um sistema.",
    a: (
      <>
        <b className="text-ink">É um WhatsApp de 30 segundos.</b> Você já tá no
        WhatsApp o dia inteiro. Manda a troca do jeito que for mais rápido —
        texto, áudio, foto da nota — e pronto. Se você gastar mais que 1 minuto
        por dia com a gente, pode cancelar.
      </>
    ),
  },
  {
    q: "Já tenho sistema de gestão na oficina.",
    a: (
      <>
        <b className="text-ink">Isso aqui não substitui.</b> Seu sistema
        continua do jeito que tá. A gente só faz o cliente voltar — o que
        sistema de gestão não faz. São coisas diferentes.
      </>
    ),
  },
  {
    q: "Cliente não gosta de receber mensagem de oficina.",
    a: (
      <>
        <b className="text-ink">Cliente não gosta de spam.</b> Lembrete na hora
        certa ele agradece. A mensagem é assinada como a sua oficina, não como
        robô. E a gente nunca manda fora de hora.
      </>
    ),
  },
  {
    q: "Vai cobrar caro depois dos 30 dias?",
    a: (
      <>
        <b className="text-ink">Só se funcionar.</b> Se cliente voltar durante
        o teste, a gente combina o preço. Se não voltar, você não paga nada.
        Sem cartão de entrada, sem contrato, sem pegadinha.
      </>
    ),
  },
  {
    q: "Como vocês sabem a hora certa?",
    a: (
      <>
        O bot pergunta a <b className="text-ink">quilometragem</b> pro cliente
        de vez em quando. Com isso a gente calcula quando a próxima troca chega
        — pelo ritmo real de uso, não por chute.
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
          As dúvidas mais comuns dos donos que já conversaram com a gente.
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
