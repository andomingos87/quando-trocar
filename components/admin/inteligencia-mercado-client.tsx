"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type {
  CohortPerfect,
  DateRange,
  MarketShareRow,
  ServicoPorTipoRow,
  ServicosPorCidadeRow,
} from "@/lib/admin/inteligencia-mercado";

type Props = {
  range: DateRange;
  cidade: string;
  porTipo: ServicoPorTipoRow[];
  marketShare: MarketShareRow[];
  porCidade: ServicosPorCidadeRow[];
  cohortPerfect: CohortPerfect;
};

function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function formatBrl(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function InteligenciaMercadoClient({
  range,
  cidade,
  porTipo,
  marketShare,
  porCidade,
  cohortPerfect,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [cidadeFilter, setCidadeFilter] = useState(cidade);

  const applyFilters = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", from);
    sp.set("to", to);
    if (cidadeFilter.trim()) sp.set("cidade", cidadeFilter.trim());
    else sp.delete("cidade");
    router.push(`/admin/inteligencia-mercado?${sp.toString()}`);
  };

  const totalServicos = porTipo.reduce((acc, r) => acc + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <label className="text-sm">
          <div className="mb-1 text-xs text-muted">De</div>
          <input
            type="date"
            className="rounded border border-line px-2 py-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs text-muted">Até</div>
          <input
            type="date"
            className="rounded border border-line px-2 py-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs text-muted">Cidade (market-share)</div>
          <input
            type="text"
            placeholder="todas"
            className="rounded border border-line px-2 py-1"
            value={cidadeFilter}
            onChange={(e) => setCidadeFilter(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-sm text-white"
          onClick={applyFilters}
        >
          Aplicar
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Mix por tipo de serviço</h2>
          <p className="mb-3 text-xs text-muted">
            Cadastros no período · total {totalServicos}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">Tipo</th>
                <th className="py-1">Total</th>
                <th className="py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {porTipo.map((row) => (
                <tr key={row.tipo_servico} className="border-t border-line">
                  <td className="py-1">{row.label}</td>
                  <td className="py-1">{row.total}</td>
                  <td className="py-1">{formatPct(row.percentual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Market-share — amortecedor</h2>
          <p className="mb-3 text-xs text-muted">
            Ordem alfabética (anti-viés Perfect). {cidade ? `Filtro: ${cidade}` : "Todas as cidades."}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">Marca</th>
                <th className="py-1">Total</th>
                <th className="py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {marketShare.map((row) => (
                <tr key={row.marca} className="border-t border-line">
                  <td className="py-1 capitalize">{row.marca}</td>
                  <td className="py-1">{row.total}</td>
                  <td className="py-1">{formatPct(row.percentual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Top cidades (cadastros)</h2>
          <p className="mb-3 text-xs text-muted">Até 10 cidades</p>
          {porCidade.length === 0 ? (
            <p className="text-sm text-muted">Sem dados no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-1">Cidade</th>
                  <th className="py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {porCidade.map((row) => (
                  <tr key={row.cidade} className="border-t border-line">
                    <td className="py-1">{row.cidade}</td>
                    <td className="py-1">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Cohort Perfect</h2>
          <p className="mb-3 text-xs text-muted">
            Amortecedores marca Perfect no período. Métricas internas — não enviar pra
            fabricante sem revisão jurídica.
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between border-t border-line py-1">
              <dt className="text-muted">Oficinas com Perfect</dt>
              <dd>{cohortPerfect.oficinas_com_perfect}</dd>
            </div>
            <div className="flex justify-between border-t border-line py-1">
              <dt className="text-muted">Amortecedores Perfect</dt>
              <dd>{cohortPerfect.total_amortecedores_perfect}</dd>
            </div>
            <div className="flex justify-between border-t border-line py-1">
              <dt className="text-muted">Total amortecedores</dt>
              <dd>{cohortPerfect.total_amortecedores}</dd>
            </div>
            <div className="flex justify-between border-t border-line py-1">
              <dt className="text-muted">Share Perfect</dt>
              <dd>{formatPct(cohortPerfect.share_perfect)}</dd>
            </div>
            <div className="flex justify-between border-t border-line py-1">
              <dt className="text-muted">Ticket médio Perfect</dt>
              <dd>{formatBrl(cohortPerfect.ticket_medio_perfect)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
