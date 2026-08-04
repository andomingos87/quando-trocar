import { Card, CardLabel, CardValue } from "@/components/admin/ui";
import { siteConfig } from "@/lib/config";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { INDICACAO_JANELA_DIAS } from "@/lib/representante/indicacao";
import { getResumoIndicacao } from "@/lib/representante/indicacao-cliques";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CopiarLink } from "./copiar-link";

export const dynamic = "force-dynamic";

export default async function RepresentanteMeuLinkPage() {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();
  const resumo = await getResumoIndicacao(supabase, rep.id);

  const url = `${siteConfig.siteUrl.replace(/\/$/, "")}/r/${rep.codigo}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Meu link</h1>
        <p className="mt-1 text-sm text-muted">
          Compartilhe este link do site. Quem abrir por ele fica na sua conta por{" "}
          {INDICACAO_JANELA_DIAS} dias — mesmo que depois abra o link de outro representante.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-white p-5">
        <CardLabel>Seu link de indicação</CardLabel>
        <p className="mt-2 break-all font-mono text-sm text-ink">{url}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <CopiarLink url={url} />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Conhece o Quando Trocar? Sua oficina lembra o cliente da próxima troca automaticamente. Veja aqui: ${url}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            Enviar no WhatsApp
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardLabel>Cliques</CardLabel>
          <CardValue>{resumo.cliques}</CardValue>
        </Card>
        <Card>
          <CardLabel>Últimos 30 dias</CardLabel>
          <CardValue>{resumo.cliques30Dias}</CardValue>
        </Card>
        <Card tone="atencao">
          <CardLabel>Cliques válidos</CardLabel>
          <CardValue>{resumo.cliquesAtribuidos}</CardValue>
        </Card>
        <Card tone="sucesso">
          <CardLabel>Leads pelo link</CardLabel>
          <CardValue>{resumo.leadsAtribuidos}</CardValue>
        </Card>
      </section>

      <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-4 text-sm text-muted">
        <p className="font-medium text-ink">Como a indicação é contada</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            O clique vale por {INDICACAO_JANELA_DIAS} dias no mesmo navegador. Nesse período, abrir o
            link de outro representante não tira o lead de você.
          </li>
          <li>
            <strong>Cliques válidos</strong> são os que geraram indicação. Um clique não vale quando
            aquele visitante já estava na janela de outro representante.
          </li>
          <li>
            <strong>Leads pelo link</strong> conta quem chegou por aqui e falou com o bot. Quem
            manda mensagem por outro caminho não é contado.
          </li>
        </ul>
      </div>
    </div>
  );
}
