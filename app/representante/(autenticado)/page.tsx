import Link from "next/link";

import { Card, CardHint, CardLabel, CardValue } from "@/components/admin/ui";
import { getConfiguracoesVendedor } from "@/lib/admin/configuracoes-vendedor";
import { formatBRL } from "@/lib/admin/format";
import { whatsappLink } from "@/lib/config";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { listNovidades } from "@/lib/representante/content/novidades";
import { getRepresentanteDashboard } from "@/lib/representante/dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CopyLinkCard } from "./copy-link";

export const dynamic = "force-dynamic";

const FRASE_FALLBACK = "oi quero testar o quando trocar";

export default async function RepresentanteOverviewPage() {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();

  const [dashboard, config] = await Promise.all([
    getRepresentanteDashboard(supabase, rep.id),
    getConfiguracoesVendedor(supabase),
  ]);

  const frase = config.frases_landing[0] ?? FRASE_FALLBACK;
  const link = whatsappLink({ message: `${frase} #REP-${rep.codigo}` });
  const novidades = listNovidades().slice(0, 3);

  const primeiroNome = rep.nome.trim().split(/\s+/)[0] ?? rep.nome;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Olá, {primeiroNome}</h1>
        <p className="mt-1 text-sm text-muted">
          Sua rede de oficinas, leads e comissões em um só lugar.
        </p>
      </header>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardLabel>Oficinas ativas</CardLabel>
          <CardValue>{dashboard.oficinasAtivas}</CardValue>
        </Card>
        <Card>
          <CardLabel>Leads em aberto</CardLabel>
          <CardValue>{dashboard.leadsEmAberto}</CardValue>
        </Card>
        <Card tone="atencao">
          <CardLabel>Comissão prevista no mês</CardLabel>
          <CardValue>{formatBRL(dashboard.comissaoPrevistaMes)}</CardValue>
          <CardHint>Ainda a receber</CardHint>
        </Card>
        <Card tone="sucesso">
          <CardLabel>Comissão paga (acumulado)</CardLabel>
          <CardValue>{formatBRL(dashboard.comissaoPagaAcumulada)}</CardValue>
        </Card>
      </section>

      <CopyLinkCard codigo={rep.codigo} link={link} />

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Novidades
          </h2>
          <Link
            href="/representante/novidades"
            className="text-xs font-medium text-brand-dark hover:text-brand-deep"
          >
            Ver todas →
          </Link>
        </div>
        {novidades.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma novidade ainda.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {novidades.map((n) => (
              <li key={n.id} className="px-5 py-4">
                <p className="text-sm font-medium text-ink">{n.titulo}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{n.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
