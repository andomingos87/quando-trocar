import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Quando Trocar coleta, usa, armazena e protege dados de oficinas e motoristas, em conformidade com a LGPD e as políticas da Meta/WhatsApp.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "17 de maio de 2026";

export default function PrivacidadePage() {
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
              Política de Privacidade
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Esta política descreve como o <strong>Quando Trocar</strong>{" "}
              (operado por Perfect Automotive) coleta, usa, armazena,
              compartilha e protege dados pessoais de oficinas mecânicas
              clientes e dos motoristas atendidos por elas, em conformidade
              com a Lei Geral de Proteção de Dados Pessoais (Lei nº
              13.709/2018 — LGPD) e com as políticas da Meta Platforms para
              uso da WhatsApp Business Platform.
            </p>
            <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              Última atualização: {LAST_UPDATED}
            </p>
          </header>

          <Section title="1. Quem somos">
            <p>
              O <strong>Quando Trocar</strong> é um serviço de retenção de
              clientes para oficinas mecânicas, operado por{" "}
              <strong>Perfect Automotive</strong>, com sede no Brasil. Atuamos
              como <em>controlador</em> dos dados das oficinas que contratam
              nosso serviço e como <em>operador</em> dos dados dos motoristas
              cadastrados pelas oficinas, processados em nome destas para o
              envio de lembretes de manutenção pelo WhatsApp.
            </p>
            <p className="mt-3">
              Para qualquer assunto relacionado a esta política ou ao
              tratamento dos seus dados, entre em contato pelo e-mail{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>
              .
            </p>
          </Section>

          <Section title="2. Quais dados coletamos">
            <p>
              Coletamos apenas os dados necessários para que o serviço
              funcione e para cumprir nossas obrigações legais e contratuais.
            </p>

            <h3 className="font-display mt-6 text-lg font-semibold text-ink">
              2.1. Dados das oficinas (nossas clientes)
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Nome da oficina e nome do responsável.</li>
              <li>CNPJ ou CPF do responsável.</li>
              <li>E-mail e telefone de contato.</li>
              <li>Endereço da oficina.</li>
              <li>
                Dados de pagamento processados por nosso provedor de
                pagamentos (não armazenamos números completos de cartão).
              </li>
              <li>
                Dados de uso do painel administrativo (login, ações
                realizadas, registros de acesso).
              </li>
            </ul>

            <h3 className="font-display mt-6 text-lg font-semibold text-ink">
              2.2. Dados dos motoristas (clientes das oficinas)
            </h3>
            <p className="mt-3">
              Os motoristas <strong>não se cadastram diretamente</strong> no
              Quando Trocar. Os dados abaixo são fornecidos pela oficina, no
              momento em que ela atende o motorista:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Nome do motorista.</li>
              <li>Número de telefone (WhatsApp).</li>
              <li>
                Dados do veículo (placa, marca, modelo, ano, quilometragem).
              </li>
              <li>
                Histórico de serviços realizados na oficina (tipo de serviço,
                data, quilometragem na data).
              </li>
              <li>
                Conteúdo das mensagens trocadas pelo WhatsApp entre o
                motorista e o agente de IA do Quando Trocar.
              </li>
            </ul>

            <h3 className="font-display mt-6 text-lg font-semibold text-ink">
              2.3. Dados coletados automaticamente
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Endereço IP, tipo de dispositivo, navegador e sistema
                operacional ao acessar nosso site ou painel.
              </li>
              <li>
                Cookies estritamente necessários para autenticação e
                preferências da sessão.
              </li>
              <li>
                Logs técnicos de requisições à nossa API e ao webhook do
                WhatsApp (para depuração e auditoria).
              </li>
            </ul>
          </Section>

          <Section title="3. Como usamos os dados">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Operar o serviço:</strong> enviar lembretes de troca
                de óleo e demais manutenções pelo WhatsApp, registrar
                respostas, agendar retornos e gerar relatórios para a
                oficina.
              </li>
              <li>
                <strong>Atendimento via agente de IA:</strong> processar
                mensagens recebidas no WhatsApp para entender intenções
                (confirmar agendamento, remarcar, recusar) e responder em
                nome da oficina.
              </li>
              <li>
                <strong>Cobrança e gestão da conta:</strong> emitir notas,
                cobrar mensalidades, dar suporte e enviar comunicações
                operacionais à oficina.
              </li>
              <li>
                <strong>Melhorias do produto:</strong> entender uso agregado
                e anônimo para corrigir bugs e priorizar evoluções.
              </li>
              <li>
                <strong>Obrigações legais:</strong> atender solicitações de
                autoridades competentes, prevenir fraude e cumprir a LGPD.
              </li>
            </ul>
            <p className="mt-4">
              Nunca usamos o conteúdo das conversas dos motoristas para
              treinar modelos de IA de terceiros, vender listas, fazer
              perfilamento publicitário ou qualquer finalidade fora da
              operação contratada pela oficina.
            </p>
          </Section>

          <Section title="4. Bases legais (LGPD)">
            <p>
              Tratamos dados pessoais com base nas seguintes hipóteses do
              art. 7º da LGPD:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Execução de contrato</strong> com a oficina (art. 7º,
                V).
              </li>
              <li>
                <strong>Legítimo interesse</strong> da oficina em manter o
                relacionamento com o motorista e lembrá-lo da próxima
                manutenção do veículo (art. 7º, IX), com transparência e
                opção de descadastro a qualquer momento.
              </li>
              <li>
                <strong>Cumprimento de obrigação legal ou regulatória</strong>{" "}
                (art. 7º, II).
              </li>
              <li>
                <strong>Consentimento</strong>, quando aplicável e
                explicitamente solicitado (art. 7º, I).
              </li>
            </ul>
          </Section>

          <Section title="5. WhatsApp e a Meta">
            <p>
              O Quando Trocar usa a <strong>WhatsApp Business Platform</strong>{" "}
              da Meta Platforms, Inc. para enviar e receber mensagens em nome
              das oficinas contratantes. Isso significa que:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                As mensagens trocadas trafegam pela infraestrutura da Meta e
                estão sujeitas também à{" "}
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  Política de Privacidade do WhatsApp
                </a>
                .
              </li>
              <li>
                Só enviamos mensagens a motoristas cujos números foram
                fornecidos pela oficina no contexto de um atendimento real
                (relacionamento pré-existente).
              </li>
              <li>
                Usamos modelos de mensagem (templates) aprovados pela Meta
                para iniciar conversas; respondemos dentro da janela de 24h
                estabelecida pela plataforma.
              </li>
              <li>
                Respeitamos imediatamente qualquer pedido de descadastro
                (&quot;PARAR&quot;, &quot;SAIR&quot;, &quot;NÃO QUERO MAIS RECEBER&quot; ou
                equivalente). O número entra em opt-out e não recebe novas
                mensagens.
              </li>
              <li>
                Não usamos a WhatsApp Business Platform para envio de spam,
                marketing massivo, conteúdo proibido pela{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-4 hover:text-brand"
                >
                  Política Comercial do WhatsApp
                </a>{" "}
                ou qualquer outra finalidade vedada pela Meta.
              </li>
            </ul>
          </Section>

          <Section title="6. Compartilhamento com terceiros">
            <p>
              Compartilhamos dados apenas com fornecedores essenciais à
              operação, sob contratos que exigem o mesmo nível de proteção
              desta política:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Meta Platforms (WhatsApp Business Platform)</strong>{" "}
                — envio e recebimento de mensagens.
              </li>
              <li>
                <strong>Supabase</strong> — banco de dados e autenticação
                (hospedagem em região indicada no contrato).
              </li>
              <li>
                <strong>OpenAI</strong> — processamento de linguagem natural
                para o agente de IA (não usamos os dados para treinar
                modelos; opt-out de treinamento ativado).
              </li>
              <li>
                <strong>Vercel</strong> — hospedagem da aplicação e logs.
              </li>
              <li>
                <strong>Provedor de pagamentos</strong> — processamento de
                mensalidades da oficina.
              </li>
              <li>
                <strong>Autoridades competentes</strong> — quando exigido
                por lei, ordem judicial ou requisição regulatória.
              </li>
            </ul>
            <p className="mt-4">
              <strong>Não vendemos</strong> dados pessoais e{" "}
              <strong>não compartilhamos</strong> dados com anunciantes,
              corretoras de dados ou terceiros para fins de marketing
              próprio.
            </p>
          </Section>

          <Section title="7. Transferência internacional">
            <p>
              Alguns dos nossos fornecedores (Meta, OpenAI, Vercel) podem
              processar dados fora do Brasil. Nessas hipóteses, garantimos
              que a transferência ocorra para países com nível adequado de
              proteção ou mediante cláusulas contratuais padrão, conforme o
              art. 33 da LGPD.
            </p>
          </Section>

          <Section title="8. Retenção dos dados">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Dados das oficinas e dos motoristas são mantidos enquanto o
                contrato com a oficina estiver ativo.
              </li>
              <li>
                Após o encerramento do contrato, retemos os dados por até{" "}
                <strong>5 anos</strong> para cumprimento de obrigações
                legais, fiscais e defesa em eventual processo, conforme o
                art. 16, I da LGPD.
              </li>
              <li>
                Logs técnicos são mantidos por até <strong>180 dias</strong>{" "}
                e depois descartados ou anonimizados.
              </li>
              <li>
                Mediante solicitação do titular, antecipamos a exclusão
                quando não houver dever legal de retenção.
              </li>
            </ul>
          </Section>

          <Section title="9. Segurança">
            <p>
              Adotamos medidas técnicas e administrativas para proteger os
              dados contra acesso não autorizado, perda ou alteração:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Conexões criptografadas em trânsito (HTTPS/TLS).</li>
              <li>Criptografia em repouso no banco de dados.</li>
              <li>
                Controle de acesso baseado em função (RBAC) e princípio do
                menor privilégio.
              </li>
              <li>Registro de auditoria de operações sensíveis.</li>
              <li>Backups regulares e plano de recuperação.</li>
              <li>
                Treinamento da equipe e cláusulas de confidencialidade nos
                contratos.
              </li>
            </ul>
            <p className="mt-4">
              Em caso de incidente de segurança que envolva risco relevante,
              comunicaremos os titulares e a Autoridade Nacional de Proteção
              de Dados (ANPD) conforme exigido pelo art. 48 da LGPD.
            </p>
          </Section>

          <Section title="10. Seus direitos (LGPD)">
            <p>
              Como titular de dados, você pode, a qualquer momento, exercer
              os direitos previstos no art. 18 da LGPD:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Confirmar a existência de tratamento.</li>
              <li>Acessar os seus dados.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>
                Solicitar anonimização, bloqueio ou eliminação de dados
                desnecessários, excessivos ou tratados em desconformidade.
              </li>
              <li>Solicitar portabilidade dos dados.</li>
              <li>
                Solicitar a eliminação dos dados tratados com base no seu
                consentimento.
              </li>
              <li>
                Obter informação sobre entidades públicas e privadas com as
                quais compartilhamos seus dados.
              </li>
              <li>Revogar o consentimento.</li>
              <li>
                Opor-se a tratamento realizado com base em legítimo
                interesse.
              </li>
            </ul>
            <p className="mt-4">
              Para exercer qualquer um destes direitos, escreva para{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>
              . Respondemos em até 15 dias.
            </p>
          </Section>

          <Section title="11. Opt-out do WhatsApp">
            <p>
              Se você é motorista e não quer mais receber mensagens do
              Quando Trocar em nome de uma oficina, basta responder qualquer
              mensagem que recebeu no WhatsApp com uma das palavras:{" "}
              <strong>PARAR</strong>, <strong>SAIR</strong>,{" "}
              <strong>CANCELAR</strong> ou{" "}
              <strong>NÃO QUERO MAIS RECEBER</strong>. O descadastro é
              imediato e definitivo para aquela oficina. Você também pode
              pedir o descadastro pelo e-mail{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>
              , informando o número de telefone.
            </p>
          </Section>

          <Section title="12. Crianças e adolescentes">
            <p>
              O Quando Trocar é um serviço B2B voltado a oficinas e seus
              clientes (motoristas adultos). Não coletamos intencionalmente
              dados de menores de 18 anos. Se identificarmos cadastro
              indevido de menor, excluiremos os dados imediatamente.
            </p>
          </Section>

          <Section title="13. Cookies">
            <p>
              Nosso site usa apenas cookies estritamente necessários para o
              funcionamento (autenticação no painel, preferências da
              sessão). Não usamos cookies de publicidade ou rastreamento de
              terceiros para fins de marketing. Você pode bloquear cookies
              nas configurações do seu navegador, mas algumas
              funcionalidades do painel podem deixar de funcionar.
            </p>
          </Section>

          <Section title="14. Alterações nesta política">
            <p>
              Podemos atualizar esta Política de Privacidade para refletir
              mudanças no serviço, na legislação ou nas exigências da Meta.
              Alterações relevantes serão comunicadas por e-mail às oficinas
              clientes e a versão vigente estará sempre publicada nesta
              página, com a data da última atualização no topo.
            </p>
          </Section>

          <Section title="15. Encarregado de Proteção de Dados (DPO)">
            <p>
              Em conformidade com o art. 41 da LGPD, designamos um
              Encarregado pelo Tratamento de Dados Pessoais. Para falar com
              o DPO, escreva para{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                {siteConfig.contactEmail}
              </a>{" "}
              com o assunto &quot;DPO — LGPD&quot;.
            </p>
          </Section>

          <Section title="16. Foro">
            <p>
              Fica eleito o foro da comarca do domicílio da operadora
              (Perfect Automotive) no Brasil para dirimir qualquer
              controvérsia decorrente desta política, com renúncia a
              qualquer outro, por mais privilegiado que seja.
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
              ou ler nossos{" "}
              <Link
                href="/termos"
                className="font-medium text-ink underline underline-offset-4 hover:text-brand"
              >
                Termos de Uso
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
