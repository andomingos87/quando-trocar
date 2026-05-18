import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Exclusão de dados",
  description:
    "Como solicitar a exclusão dos seus dados pessoais do Quando Trocar. Procedimento, prazos e canais oficiais para motoristas e oficinas.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "17 de maio de 2026";

export default function ExclusaoDadosPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        <article className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 sm:py-24">
          <header className="mb-12 border-b border-line pb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Direitos do titular
            </p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
              Exclusão de dados
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Esta página explica como você pode solicitar a exclusão dos
              seus dados pessoais tratados pelo <strong>Quando Trocar</strong>
              {" "}(operado por Perfect Automotive), em conformidade com a Lei
              Geral de Proteção de Dados (LGPD, art. 18, VI) e com as
              exigências da Meta Platforms para aplicativos integrados ao
              WhatsApp Business Platform.
            </p>
            <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              Última atualização: {LAST_UPDATED}
            </p>
          </header>

          <Section title="Resumo rápido">
            <div className="rounded-md border border-line bg-paper-soft p-5">
              <p>
                Para excluir seus dados, envie um e-mail para{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>{" "}
                com o assunto{" "}
                <strong>&quot;Solicitação de exclusão de dados&quot;</strong>{" "}
                informando seu nome e o número de telefone usado no
                WhatsApp. Respondemos em até <strong>15 dias</strong> e
                excluímos seus dados em até <strong>30 dias</strong>, salvo
                informações que precisamos reter por obrigação legal.
              </p>
            </div>
          </Section>

          <Section title="1. Quem pode solicitar">
            <p>Qualquer titular de dados, incluindo:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Motoristas</strong> cadastrados por uma oficina
                cliente do Quando Trocar.
              </li>
              <li>
                <strong>Oficinas</strong> contratantes do serviço.
              </li>
              <li>
                <strong>Visitantes</strong> do nosso site cujos dados
                tenham sido coletados (por exemplo, via formulário de
                contato).
              </li>
            </ul>
          </Section>

          <Section title="2. Como solicitar">
            <h3 className="font-display text-lg font-semibold text-ink">
              Opção A — Por e-mail (recomendado)
            </h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>
                Envie um e-mail para{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados`}
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  {siteConfig.contactEmail}
                </a>
                .
              </li>
              <li>
                Use o assunto:{" "}
                <strong>&quot;Solicitação de exclusão de dados&quot;</strong>.
              </li>
              <li>
                No corpo da mensagem, informe:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Seu nome completo.</li>
                  <li>
                    O <strong>número de telefone</strong> usado no
                    WhatsApp (com DDD).
                  </li>
                  <li>
                    Se for oficina: o CNPJ/CPF e o nome da oficina
                    cadastrada.
                  </li>
                  <li>
                    Qual exclusão você deseja: <em>todos os dados</em> ou
                    apenas <em>parar de receber mensagens</em> (opt-out).
                  </li>
                </ul>
              </li>
              <li>
                Aguarde nossa confirmação. Podemos pedir uma verificação
                rápida para garantir que a solicitação vem do titular dos
                dados (por exemplo, confirmação pelo próprio número de
                WhatsApp cadastrado).
              </li>
            </ol>

            <h3 className="font-display mt-8 text-lg font-semibold text-ink">
              Opção B — Pelo próprio WhatsApp (somente motoristas)
            </h3>
            <p className="mt-3">
              Se você é motorista e recebeu uma mensagem do Quando Trocar
              em nome de uma oficina, basta responder no mesmo WhatsApp com
              qualquer uma das palavras abaixo:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>PARAR</strong>
              </li>
              <li>
                <strong>SAIR</strong>
              </li>
              <li>
                <strong>CANCELAR</strong>
              </li>
              <li>
                <strong>NÃO QUERO MAIS RECEBER</strong>
              </li>
            </ul>
            <p className="mt-3">
              O envio de novas mensagens é interrompido{" "}
              <strong>imediatamente e em definitivo</strong> para aquela
              oficina. Se você quiser também a exclusão completa dos
              registros (não apenas a parada de envios), envie e-mail
              conforme a Opção A.
            </p>

            <h3 className="font-display mt-8 text-lg font-semibold text-ink">
              Opção C — Pela oficina que te cadastrou
            </h3>
            <p className="mt-3">
              Como os dados dos motoristas são cadastrados pelas oficinas,
              você também pode pedir diretamente à oficina que te atendeu
              para remover seus dados do sistema dela. A oficina é
              responsável por executar a exclusão no painel do Quando
              Trocar.
            </p>
          </Section>

          <Section title="3. O que é excluído">
            <p>Após a confirmação da solicitação, excluímos:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Nome, telefone e demais dados de contato.</li>
              <li>
                Dados do veículo (placa, marca, modelo, ano,
                quilometragem).
              </li>
              <li>
                Histórico de serviços e lembretes vinculados ao seu
                cadastro.
              </li>
              <li>
                Conteúdo das mensagens trocadas com o agente de IA pelo
                WhatsApp.
              </li>
              <li>Logs técnicos identificáveis associados a você.</li>
            </ul>
            <p className="mt-4">
              Para oficinas, a exclusão se estende também aos dados da
              empresa, do responsável e do uso do painel administrativo.
            </p>
          </Section>

          <Section title="4. O que pode ser retido (e por quê)">
            <p>
              Alguns dados podem ser mantidos, em forma mínima e
              estritamente necessária, para cumprir obrigações legais ou
              proteger direitos:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Dados fiscais e financeiros</strong> (notas
                fiscais, comprovantes de pagamento) — retidos pelo prazo
                exigido pela legislação tributária (até 5 anos).
              </li>
              <li>
                <strong>Registros mínimos de opt-out</strong> (apenas o
                número de telefone marcado como descadastrado) — mantidos
                indefinidamente para garantir que nunca mais enviaremos
                mensagens para você.
              </li>
              <li>
                <strong>Logs de auditoria</strong> exigidos por lei ou
                necessários para defesa em eventual processo judicial,
                pelo prazo previsto no art. 16, I e III da LGPD.
              </li>
            </ul>
            <p className="mt-4">
              Esses dados não são usados para nenhuma finalidade comercial
              ou de marketing.
            </p>
          </Section>

          <Section title="5. Prazos">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Resposta inicial:</strong> em até{" "}
                <strong>15 dias</strong> a partir do recebimento da
                solicitação, conforme art. 19, §1º da LGPD.
              </li>
              <li>
                <strong>Execução da exclusão:</strong> em até{" "}
                <strong>30 dias</strong> após a confirmação, salvo
                impossibilidade técnica ou dever legal de retenção, casos
                em que informaremos você por escrito.
              </li>
              <li>
                <strong>Opt-out do WhatsApp:</strong> aplicado{" "}
                <strong>imediatamente</strong> ao responder com palavra de
                descadastro.
              </li>
            </ul>
          </Section>

          <Section title="6. Verificação de identidade">
            <p>
              Para proteger seus dados contra solicitações fraudulentas,
              podemos pedir uma verificação simples antes de executar a
              exclusão, como confirmação pelo próprio WhatsApp cadastrado
              ou envio de informação que apenas o titular conheceria. Não
              pedimos cópia de documentos, senhas ou dados bancários.
            </p>
          </Section>

          <Section title="7. Custo">
            <p>
              A exclusão de dados é <strong>gratuita</strong>. Não cobramos
              taxas, multas ou qualquer valor para processar a
              solicitação.
            </p>
          </Section>

          <Section title="8. Recusa e recurso">
            <p>
              Se, em casos excepcionais, não pudermos executar a exclusão
              (por exemplo, quando houver obrigação legal de retenção),
              informaremos os motivos por escrito. Você poderá:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Solicitar revisão da decisão respondendo o e-mail de
                resposta.
              </li>
              <li>
                Acionar a <strong>ANPD</strong> (Autoridade Nacional de
                Proteção de Dados) pelo site{" "}
                <a
                  href="https://www.gov.br/anpd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  gov.br/anpd
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="9. Encarregado pelo tratamento de dados (DPO)">
            <p>
              Em conformidade com o art. 41 da LGPD, designamos um
              Encarregado pelo Tratamento de Dados Pessoais. Para falar
              diretamente com o DPO, envie e-mail para{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}?subject=DPO%20%E2%80%94%20LGPD`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>{" "}
              com o assunto <strong>&quot;DPO — LGPD&quot;</strong>.
            </p>
          </Section>

          <div className="mt-16 border-t border-line pt-8">
            <p className="text-[14px] leading-relaxed text-muted">
              Para mais detalhes sobre como tratamos seus dados, leia nossa{" "}
              <Link
                href="/privacidade"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Política de Privacidade
              </Link>{" "}
              e nossos{" "}
              <Link
                href="/termos"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Termos de Uso
              </Link>
              . Ou volte para{" "}
              <Link
                href="/"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                a página inicial
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
