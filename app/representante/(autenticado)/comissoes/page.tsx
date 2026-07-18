import { Card, CardLabel, CardValue, StatusBadge } from "@/components/admin/ui";
import type { ComissaoStatus } from "@/lib/admin/comissoes";
import { formatBRL, formatDate } from "@/lib/admin/format";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { listComissoesDoRepresentante } from "@/lib/representante/comissoes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { COMISSAO_STATUS } from "../status";
import { ComissoesFilter } from "./comissoes-filter";

export const dynamic = "force-dynamic";

const VALID_STATUS: ComissaoStatus[] = ["prevista", "paga", "cancelada"];

function parseStatus(value: string | undefined): ComissaoStatus | undefined {
  return value && VALID_STATUS.includes(value as ComissaoStatus)
    ? (value as ComissaoStatus)
    : undefined;
}

function parseMes(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

export default async function RepresentanteComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; status?: string }>;
}) {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();
  const sp = await searchParams;

  const mes = parseMes(sp.mes);
  const status = parseStatus(sp.status);

  const { rows, total, totalPrevisto, totalPago } = await listComissoesDoRepresentante(
    supabase,
    rep.id,
    { mes, status, pageSize: 200 },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Comissões</h1>
        <p className="mt-1 text-sm text-muted">
          Seu extrato de comissões. Somente consulta — o pagamento é feito pelo time.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card tone="atencao">
          <CardLabel>Prevista</CardLabel>
          <CardValue>{formatBRL(totalPrevisto)}</CardValue>
        </Card>
        <Card tone="sucesso">
          <CardLabel>Paga</CardLabel>
          <CardValue>{formatBRL(totalPago)}</CardValue>
        </Card>
      </section>

      <ComissoesFilter mes={mes ?? ""} status={status ?? ""} />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10">
          <p className="text-base font-medium text-ink">Nenhuma comissão neste filtro.</p>
          <p className="mt-1 text-sm text-muted">
            Cada mensalidade paga por uma oficina sua gera uma comissão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Oficina</th>
                  <th className="px-4 py-3 font-medium">Base</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((c) => {
                  const st = COMISSAO_STATUS[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-paper-soft">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {c.oficina_nome ?? "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted">
                        {formatBRL(c.base_valor)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-ink">
                        {formatBRL(c.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => {
              const st = COMISSAO_STATUS[c.status];
              return (
                <li key={c.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {c.oficina_nome ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{formatDate(c.created_at)}</p>
                    </div>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
                    {formatBRL(c.valor)}
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted">
            {total} {total === 1 ? "comissão" : "comissões"} no filtro atual.
          </p>
        </>
      )}
    </div>
  );
}
