import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoServicoKey = "troca_oleo" | "amortecedor" | "revisao" | "outro";
export type MarcaAmortecedor = "perfect" | "monroe" | "cofap" | "nakata" | "outra";

export type DateRange = {
  from: string; // ISO date "YYYY-MM-DD"
  to: string; // ISO date inclusive
};

export type ServicoPorTipoRow = {
  tipo_servico: TipoServicoKey;
  label: string;
  total: number;
  percentual: number;
};

export type MarketShareRow = {
  marca: MarcaAmortecedor;
  total: number;
  percentual: number;
};

export type ServicosPorCidadeRow = {
  cidade: string;
  total: number;
};

export type CohortPerfect = {
  oficinas_com_perfect: number;
  total_amortecedores_perfect: number;
  total_amortecedores: number;
  share_perfect: number;
  ticket_medio_perfect: number | null;
};

const TIPO_LABEL: Record<TipoServicoKey, string> = {
  troca_oleo: "Troca de oleo",
  amortecedor: "Amortecedor",
  revisao: "Revisao",
  outro: "Outro",
};

function isTipoKey(value: unknown): value is TipoServicoKey {
  return (
    value === "troca_oleo" ||
    value === "amortecedor" ||
    value === "revisao" ||
    value === "outro"
  );
}

function isMarcaKey(value: unknown): value is MarcaAmortecedor {
  return (
    value === "perfect" ||
    value === "monroe" ||
    value === "cofap" ||
    value === "nakata" ||
    value === "outra"
  );
}

export function defaultRange(): DateRange {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

export async function getServicosPorTipo(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<ServicoPorTipoRow[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("tipo_servico")
    .gte("data_servico", range.from)
    .lte("data_servico", range.to);
  if (error) throw new Error(`servicos_por_tipo_failed: ${error.message}`);

  return aggregateServicosPorTipo(
    (data ?? []).map((r) => (r as { tipo_servico: string }).tipo_servico),
  );
}

export function aggregateServicosPorTipo(values: string[]): ServicoPorTipoRow[] {
  const counts: Record<TipoServicoKey, number> = {
    troca_oleo: 0,
    amortecedor: 0,
    revisao: 0,
    outro: 0,
  };
  for (const v of values) {
    if (isTipoKey(v)) counts[v] += 1;
    else counts.outro += 1;
  }
  const total = values.length;
  const order: TipoServicoKey[] = ["troca_oleo", "amortecedor", "revisao", "outro"];
  return order.map((tipo) => ({
    tipo_servico: tipo,
    label: TIPO_LABEL[tipo],
    total: counts[tipo],
    percentual: total > 0 ? (counts[tipo] / total) * 100 : 0,
  }));
}

export async function getMarketShareAmortecedor(
  supabase: SupabaseClient,
  range: DateRange,
  cidade?: string,
): Promise<MarketShareRow[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("marca_peca, oficinas:oficina_id (cidade)")
    .eq("tipo_servico", "amortecedor")
    .not("marca_peca", "is", null)
    .gte("data_servico", range.from)
    .lte("data_servico", range.to);
  if (error) throw new Error(`market_share_failed: ${error.message}`);

  const cidadeLower = cidade ? cidade.trim().toLowerCase() : null;
  const filtered = (data ?? []).filter((row) => {
    if (!cidadeLower) return true;
    const ofRaw = (row as { oficinas: unknown }).oficinas;
    const of = Array.isArray(ofRaw) ? ofRaw[0] : ofRaw;
    const c = (of as { cidade?: string } | null)?.cidade?.trim().toLowerCase() ?? null;
    return c === cidadeLower;
  });

  return aggregateMarketShare(
    filtered.map((r) => (r as { marca_peca: string }).marca_peca),
  );
}

export function aggregateMarketShare(marcas: string[]): MarketShareRow[] {
  const counts: Record<MarcaAmortecedor, number> = {
    perfect: 0,
    monroe: 0,
    cofap: 0,
    nakata: 0,
    outra: 0,
  };
  for (const m of marcas) {
    if (isMarcaKey(m)) counts[m] += 1;
  }
  const total = marcas.length;
  // Ordem alfabetica (anti-vies Perfect, conforme regras-de-negocio §1.5 e ADR-0014).
  const order: MarcaAmortecedor[] = ["cofap", "monroe", "nakata", "outra", "perfect"];
  return order.map((marca) => ({
    marca,
    total: counts[marca],
    percentual: total > 0 ? (counts[marca] / total) * 100 : 0,
  }));
}

export async function getServicosPorCidade(
  supabase: SupabaseClient,
  range: DateRange,
  tipo?: TipoServicoKey,
): Promise<ServicosPorCidadeRow[]> {
  let query = supabase
    .from("servicos")
    .select("oficinas:oficina_id (cidade)")
    .gte("data_servico", range.from)
    .lte("data_servico", range.to);

  if (tipo) query = query.eq("tipo_servico", tipo);

  const { data, error } = await query;
  if (error) throw new Error(`servicos_por_cidade_failed: ${error.message}`);

  const cidades: string[] = [];
  for (const row of data ?? []) {
    const ofRaw = (row as { oficinas: unknown }).oficinas;
    const of = Array.isArray(ofRaw) ? ofRaw[0] : ofRaw;
    const c = (of as { cidade?: string } | null)?.cidade?.trim();
    if (c) cidades.push(c);
  }
  return aggregateCidades(cidades);
}

export function aggregateCidades(cidades: string[]): ServicosPorCidadeRow[] {
  const counts = new Map<string, number>();
  for (const c of cidades) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([cidade, total]) => ({ cidade, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export async function getCohortPerfect(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<CohortPerfect> {
  const { data, error } = await supabase
    .from("servicos")
    .select("oficina_id, marca_peca, valor")
    .eq("tipo_servico", "amortecedor")
    .gte("data_servico", range.from)
    .lte("data_servico", range.to);
  if (error) throw new Error(`cohort_perfect_failed: ${error.message}`);

  return aggregateCohortPerfect(
    (data ?? []).map((r) => {
      const row = r as { oficina_id: string; marca_peca: string | null; valor: number | null };
      return row;
    }),
  );
}

export function aggregateCohortPerfect(
  rows: Array<{ oficina_id: string; marca_peca: string | null; valor: number | null }>,
): CohortPerfect {
  const totalAmortecedores = rows.length;
  let perfectCount = 0;
  let perfectValorTotal = 0;
  let perfectValorCount = 0;
  const oficinasComPerfect = new Set<string>();
  for (const row of rows) {
    if (row.marca_peca === "perfect") {
      perfectCount += 1;
      oficinasComPerfect.add(row.oficina_id);
      if (row.valor != null && Number.isFinite(row.valor)) {
        perfectValorTotal += Number(row.valor);
        perfectValorCount += 1;
      }
    }
  }
  return {
    oficinas_com_perfect: oficinasComPerfect.size,
    total_amortecedores_perfect: perfectCount,
    total_amortecedores: totalAmortecedores,
    share_perfect: totalAmortecedores > 0 ? (perfectCount / totalAmortecedores) * 100 : 0,
    ticket_medio_perfect:
      perfectValorCount > 0 ? perfectValorTotal / perfectValorCount : null,
  };
}

export function parseRangeFromSearchParams(params: {
  from?: string;
  to?: string;
}): DateRange {
  const def = defaultRange();
  const isIso = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  return {
    from: isIso(params.from) ? (params.from as string) : def.from,
    to: isIso(params.to) ? (params.to as string) : def.to,
  };
}
