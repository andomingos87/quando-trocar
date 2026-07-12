import { requireAdminApi } from "@/lib/admin/api-guard";
import { listOficinas, type OficinaListFilters, type OficinaListRow } from "@/lib/admin/oficinas";
import { formatCpfCnpj } from "@/lib/admin/documento-br";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS: Array<[string, (r: OficinaListRow) => string]> = [
  ["Nome", (r) => r.nome],
  ["CPF/CNPJ", (r) => (r.cpf_cnpj ? formatCpfCnpj(r.cpf_cnpj) : "")],
  ["WhatsApp", (r) => r.whatsapp_principal],
  ["E-mail", (r) => r.email ?? ""],
  ["Responsavel", (r) => r.responsavel ?? ""],
  ["Cidade", (r) => r.cidade ?? ""],
  ["UF", (r) => r.estado ?? ""],
  ["Status", (r) => r.status],
  ["Motivo pausa", (r) => r.motivo_pausa ?? ""],
  ["Plano", (r) => r.plano_nome ?? ""],
  ["Preco efetivo", (r) => (r.preco_efetivo != null ? String(r.preco_efetivo) : "")],
  ["Representante", (r) => r.representante_nome ?? ""],
  ["Proximo vencimento", (r) => r.proximo_vencimento ?? ""],
  ["Cobranca pronta", (r) => (r.cobranca_pronta ? "sim" : "nao")],
  ["Criada em", (r) => r.created_at],
];

function csvCell(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams;
  const filters: OficinaListFilters = {
    status: (q.get("status") as OficinaListFilters["status"]) || "todas",
    plano_id: q.get("plano_id") || undefined,
    origem: (q.get("origem") as OficinaListFilters["origem"]) || undefined,
    motivo_pausa: (q.get("motivo_pausa") as OficinaListFilters["motivo_pausa"]) || undefined,
    representante_id: q.get("representante_id") || undefined,
    cobranca: (q.get("cobranca") as OficinaListFilters["cobranca"]) || undefined,
    busca: q.get("busca") || undefined,
    sort: (q.get("sort") as OficinaListFilters["sort"]) || undefined,
    dir: (q.get("dir") as OficinaListFilters["dir"]) || undefined,
  };

  const supabase = createSupabaseAdminClient();
  const rows: OficinaListRow[] = [];
  let page = 1;
  // Pagina ate coletar tudo (listOficinas limita pageSize a 200).
  for (;;) {
    const res = await listOficinas(supabase, { ...filters, page, pageSize: 200 });
    rows.push(...res.rows);
    if (rows.length >= res.total || res.rows.length === 0) break;
    page += 1;
  }

  const header = COLUMNS.map(([label]) => csvCell(label)).join(";");
  const body = rows
    .map((r) => COLUMNS.map(([, get]) => csvCell(get(r))).join(";"))
    .join("\n");
  // BOM para o Excel abrir UTF-8 corretamente.
  const csv = `﻿${header}\n${body}\n`;

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oficinas-${stamp}.csv"`,
    },
  });
}
