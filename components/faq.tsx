import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Eyebrow, Section, SectionTitle } from "./section";
import { Reveal, RevealStagger, RevealItem } from "./reveal";

const items = [
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. Funciona inteiro pelo WhatsApp — o seu e o do cliente. Sem app, sem login, sem senha.",
  },
  {
    q: "E se o cliente não responder as mensagens?",
    a: "O lembrete não depende de insistência. O contato segue a previsão do serviço e respeita a resposta do cliente.",
  },
  {
    q: "Quem é o remetente da mensagem que o cliente recebe?",
    a: 'A mensagem é assinada como a sua oficina ("Oi, aqui é do Auto Center X"). O cliente não vê a gente — vê você.',
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: 'Sim. A assinatura é mensal, sem fidelidade e sem multa. Basta solicitar pelo WhatsApp.',
  },
  {
    q: "Como faço pra corrigir um cadastro errado?",
    a: 'Manda no chat: "corrigi a placa do Roberto, é F no final". O bot entende em português, sem formulário nenhum.',
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <Reveal>
        <Eyebrow>perguntas frequentes</Eyebrow>
        <SectionTitle>
          Perguntas que
          <br />a gente sempre ouve.
        </SectionTitle>
      </Reveal>

      <RevealStagger stagger={0.05} className="mt-12 max-w-[820px]">
        <Accordion type="single" collapsible className="grid gap-2">
          {items.map((item, i) => (
            <RevealItem key={item.q}>
              <AccordionItem value={`faq-${i}`} className="rounded-xl">
                <AccordionTrigger className="py-5 text-[15px] font-semibold">
                  <span className="mr-4 inline-block w-6 font-mono text-[11px] uppercase tracking-wider text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pl-[3.25rem]">
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
