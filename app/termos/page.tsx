import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos de Uso do Quando Trocar: condições para oficinas e motoristas, regras de uso do serviço, pagamentos, cancelamento e responsabilidades.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "17 de maio de 2026";

export default function TermosPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        <article className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 sm:py-24">
          <header className="mb-12 border-b border-line pb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Documento legal
            </p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
              Termos de Uso
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Estes Termos de Uso regulam o acesso e a utilização do{" "}
              <strong>Quando Trocar</strong> (operado por Perfect Automotive)
              por oficinas mecânicas contratantes e pelos motoristas que
              recebem mensagens enviadas em nome dessas oficinas. Ao
              contratar o serviço, criar uma conta ou utilizar qualquer
              funcionalidade, você declara ter lido, compreendido e aceito
              integralmente estes termos.
            </p>
            <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              Última atualização: {LAST_UPDATED}
            </p>
          </header>

          <Section title="1. Definições">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Plataforma:</strong> o serviço Quando Trocar, incluindo
                site, painel administrativo, API, integrações com o WhatsApp
                Business Platform e o agente de IA responsável pelo envio de
                lembretes e atendimento automatizado.
              </li>
              <li>
                <strong>Operadora:</strong> Perfect Automotive, pessoa
                jurídica responsável pela operação da Plataforma.
              </li>
              <li>
                <strong>Oficina:</strong> pessoa física ou jurídica que
                contrata o Quando Trocar para reter seus clientes.
              </li>
              <li>
                <strong>Motorista:</strong> pessoa física, cliente da
                Oficina, cujos dados foram cadastrados pela Oficina e que
                pode receber mensagens da Plataforma em nome da Oficina.
              </li>
              <li>
                <strong>Usuário:</strong> qualquer pessoa que acesse o site
                ou o painel da Plataforma.
              </li>
            </ul>
          </Section>

          <Section title="2. Objeto do serviço">
            <p>
              O Quando Trocar é um serviço B2B que permite à Oficina manter
              relacionamento com seus clientes (Motoristas) por meio do
              envio automatizado de lembretes de manutenção (troca de óleo,
              filtros, revisões, retornos) via WhatsApp, bem como o
              atendimento por agente de IA dentro das regras definidas pela
              Oficina.
            </p>
            <p className="mt-3">
              A Plataforma <strong>não substitui</strong> o atendimento
              técnico, o diagnóstico mecânico nem qualquer responsabilidade
              da Oficina perante seus clientes.
            </p>
          </Section>

          <Section title="3. Cadastro e conta">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                O cadastro é restrito à Oficina, que deve fornecer
                informações verdadeiras, completas e atualizadas.
              </li>
              <li>
                A Oficina é responsável por manter sigilo da senha e por
                todas as ações praticadas em sua conta.
              </li>
              <li>
                A Oficina deve comunicar imediatamente qualquer uso não
                autorizado da conta para{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>
                .
              </li>
              <li>
                A Operadora pode recusar cadastro, suspender ou encerrar
                contas em caso de violação destes termos, fraude ou uso
                abusivo.
              </li>
            </ul>
          </Section>

          <Section title="4. Responsabilidades da Oficina">
            <p>
              Ao contratar o Quando Trocar, a Oficina declara e se obriga
              a:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Cadastrar apenas Motoristas com os quais possui{" "}
                <strong>relacionamento comercial pré-existente</strong> e
                que esperam razoavelmente receber contato sobre manutenção
                do veículo.
              </li>
              <li>
                Informar previamente o Motorista, no momento do atendimento
                ou cadastro, que ele poderá receber lembretes pelo
                WhatsApp.
              </li>
              <li>
                Manter os dados dos Motoristas atualizados e excluir
                cadastros quando o Motorista solicitar.
              </li>
              <li>
                Cumprir a Lei Geral de Proteção de Dados Pessoais (LGPD), o
                Código de Defesa do Consumidor e demais normas aplicáveis.
              </li>
              <li>
                Respeitar a{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  Política Comercial do WhatsApp
                </a>{" "}
                e a{" "}
                <a
                  href="https://www.whatsapp.com/legal/commerce-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  Política de Comércio do WhatsApp
                </a>
                , não enviando spam, marketing massivo, conteúdo proibido
                ou mensagens fora do contexto de manutenção veicular.
              </li>
              <li>
                Pagar pontualmente a mensalidade contratada.
              </li>
              <li>
                Não usar a Plataforma para fins ilícitos, ofensivos,
                fraudulentos ou que violem direitos de terceiros.
              </li>
            </ul>
          </Section>

          <Section title="5. Uso do agente de IA">
            <p>
              A Plataforma utiliza um agente de IA para conversar com
              Motoristas no WhatsApp em nome da Oficina. A Oficina entende e
              concorda que:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                O agente opera dentro de regras pré-definidas pela
                Plataforma e pela Oficina (templates, horários, modos de
                atendimento).
              </li>
              <li>
                Decisões críticas — confirmação final de agendamento,
                aprovação de orçamento, alteração de pagamento, mudança de
                status do lead — <strong>não</strong> são tomadas
                autonomamente pela IA e exigem ação humana, conforme
                definido nas regras internas da Plataforma.
              </li>
              <li>
                A Oficina é responsável por revisar agendamentos, retornos
                e qualquer outra interação registrada pela Plataforma.
              </li>
              <li>
                Eventuais erros de interpretação da IA serão tratados pelo
                suporte da Operadora, sem que isso configure obrigação de
                indenizar perda de receita decorrente exclusivamente de
                falha na interpretação automatizada.
              </li>
            </ul>
          </Section>

          <Section title="6. WhatsApp Business Platform">
            <p>
              A Plataforma utiliza a WhatsApp Business Platform da Meta para
              envio e recebimento de mensagens. A Oficina entende que:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                O serviço está sujeito à disponibilidade e às políticas da
                Meta, que podem alterar regras, preços de conversa,
                templates ou suspender contas a seu critério.
              </li>
              <li>
                Mensagens iniciadas pela Oficina utilizam{" "}
                <strong>templates aprovados pela Meta</strong>; conteúdos
                fora do template ou fora da janela de 24h podem ser
                bloqueados pelo WhatsApp.
              </li>
              <li>
                Solicitações de descadastro feitas pelo Motorista{" "}
                (&quot;PARAR&quot;, &quot;SAIR&quot;, &quot;CANCELAR&quot; ou
                equivalentes) são respeitadas{" "}
                <strong>imediata e definitivamente</strong>. A Oficina não
                pode reativar o envio para um número em opt-out.
              </li>
              <li>
                O número de telefone do remetente é fornecido pela
                Operadora ou pela Oficina, conforme acordado no contrato
                específico.
              </li>
            </ul>
          </Section>

          <Section title="7. Direitos do Motorista">
            <p>
              O Motorista, ainda que não tenha contratado o serviço
              diretamente, tem garantidos os seguintes direitos:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Solicitar a qualquer momento o descadastro do envio de
                mensagens, respondendo no próprio WhatsApp com palavras
                como &quot;PARAR&quot;, &quot;SAIR&quot;, &quot;CANCELAR&quot; ou{" "}
                &quot;NÃO QUERO MAIS RECEBER&quot;.
              </li>
              <li>
                Exercer todos os direitos previstos no art. 18 da LGPD
                (acesso, correção, exclusão, portabilidade, oposição etc.).
              </li>
              <li>
                Entrar em contato direto com a Operadora pelo e-mail{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>{" "}
                em caso de dúvida ou solicitação.
              </li>
            </ul>
            <p className="mt-4">
              O detalhamento dos direitos e do tratamento de dados está na{" "}
              <Link
                href="/privacidade"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </Section>

          <Section title="8. Mensalidade, pagamento e cancelamento">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                O valor da mensalidade é o vigente na data da contratação,
                informado no momento do cadastro ou em proposta comercial.
              </li>
              <li>
                A cobrança é mensal e recorrente, salvo plano específico
                contratado.
              </li>
              <li>
                Atraso superior a 7 dias pode acarretar suspensão do envio
                de mensagens; atraso superior a 30 dias pode acarretar
                cancelamento da conta.
              </li>
              <li>
                A Oficina pode cancelar o serviço a qualquer momento,
                solicitando pelo e-mail{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>
                . O cancelamento tem efeito ao fim do ciclo já pago, sem
                reembolso proporcional, salvo previsão expressa em proposta
                comercial.
              </li>
              <li>
                Reajustes anuais podem ocorrer, com comunicação prévia de
                no mínimo 30 dias.
              </li>
            </ul>
          </Section>

          <Section title="9. Período de teste">
            <p>
              Quando ofertado, o período de teste gratuito tem prazo
              determinado e regras específicas comunicadas na contratação.
              Ao fim do período de teste, caso a Oficina não cancele, a
              cobrança da mensalidade contratada é iniciada automaticamente.
            </p>
          </Section>

          <Section title="10. Disponibilidade e suporte">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                A Operadora envidará esforços para manter a Plataforma
                disponível 24/7, exceto durante manutenções programadas
                comunicadas com antecedência.
              </li>
              <li>
                A Operadora <strong>não garante</strong> ausência total de
                interrupções, falhas, latência ou indisponibilidade
                decorrentes de terceiros (Meta/WhatsApp, hospedagem,
                provedor de IA, conexão da Oficina).
              </li>
              <li>
                O suporte é prestado em dias úteis, das 9h às 18h
                (horário de Brasília), pelo e-mail{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="11. Propriedade intelectual">
            <p>
              Todos os direitos sobre a marca, logotipos, código-fonte,
              layout, base de conhecimento e demais elementos da Plataforma
              pertencem à Operadora. É vedado:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Copiar, modificar, distribuir ou criar obras derivadas da
                Plataforma sem autorização prévia e por escrito.
              </li>
              <li>
                Fazer engenharia reversa, descompilação ou tentativa de
                obter o código-fonte.
              </li>
              <li>
                Utilizar marcas, nomes ou identidade visual da Operadora
                fora do contexto do contrato.
              </li>
            </ul>
            <p className="mt-4">
              A Oficina mantém a titularidade dos dados que cadastra e
              concede à Operadora licença não exclusiva, restrita ao prazo
              e à finalidade do contrato, para tratar tais dados conforme a
              Política de Privacidade.
            </p>
          </Section>

          <Section title="12. Limitação de responsabilidade">
            <p>
              Na máxima extensão permitida pela legislação aplicável, a
              Operadora <strong>não responde</strong> por:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Perdas de receita, lucros cessantes ou danos indiretos
                decorrentes do uso ou da impossibilidade de uso da
                Plataforma.
              </li>
              <li>
                Falhas, suspensões ou alterações de políticas impostas pela
                Meta/WhatsApp.
              </li>
              <li>
                Conteúdo, qualidade ou execução dos serviços mecânicos
                prestados pela Oficina ao Motorista — a relação comercial
                é exclusivamente entre Oficina e Motorista.
              </li>
              <li>
                Uso indevido da Plataforma pela Oficina, incluindo envio de
                mensagens fora do escopo contratado.
              </li>
            </ul>
            <p className="mt-4">
              A responsabilidade total da Operadora, em qualquer hipótese,
              fica limitada ao valor das últimas 3 (três) mensalidades
              efetivamente pagas pela Oficina.
            </p>
          </Section>

          <Section title="13. Suspensão e rescisão">
            <p>
              A Operadora pode suspender ou rescindir o acesso da Oficina,
              no todo ou em parte, em caso de:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Violação destes Termos ou da Política de Privacidade.</li>
              <li>Inadimplência superior a 30 dias.</li>
              <li>
                Uso da Plataforma para spam, conteúdo proibido, fraude ou
                qualquer prática que comprometa a integridade do serviço
                ou a relação com a Meta.
              </li>
              <li>
                Determinação de autoridade competente ou da própria Meta.
              </li>
            </ul>
            <p className="mt-4">
              Em caso de rescisão, os dados serão tratados conforme o item
              de retenção da{" "}
              <Link
                href="/privacidade"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </Section>

          <Section title="14. Alterações destes Termos">
            <p>
              A Operadora pode atualizar estes Termos para refletir
              mudanças no serviço, na legislação ou nas exigências da Meta.
              Alterações relevantes serão comunicadas por e-mail e/ou no
              painel administrativo, com antecedência mínima de 15 dias. O
              uso continuado da Plataforma após a vigência das alterações
              implica concordância com a nova versão.
            </p>
          </Section>

          <Section title="15. Privacidade e proteção de dados">
            <p>
              O tratamento de dados pessoais segue a{" "}
              <Link
                href="/privacidade"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Política de Privacidade
              </Link>
              , que é parte integrante destes Termos.
            </p>
          </Section>

          <Section title="16. Comunicações">
            <p>
              Comunicações oficiais entre Oficina e Operadora ocorrem pelo
              e-mail cadastrado pela Oficina e pelo e-mail{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>
              . A Oficina é responsável por manter um e-mail válido e
              monitorado em sua conta.
            </p>
          </Section>

          <Section title="17. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa
              do Brasil. Fica eleito o foro da comarca do domicílio da
              Operadora para dirimir qualquer controvérsia decorrente
              destes Termos, com renúncia a qualquer outro, por mais
              privilegiado que seja.
            </p>
          </Section>

          <div className="mt-16 border-t border-line pt-8">
            <p className="text-[14px] leading-relaxed text-muted">
              Voltar para{" "}
              <Link
                href="/"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                a página inicial
              </Link>{" "}
              ou ler nossa{" "}
              <Link
                href="/privacidade"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-[28px]">
        {title}
      </h2>
      <div className="mt-4 space-y-1 text-[15px] leading-[1.7] text-muted [&_strong]:text-ink [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
