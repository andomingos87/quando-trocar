import { listPagamentos, type PagamentoListFilters } from "@/lib/admin/pagamentos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PagamentosClient } from "@/components/admin/pagamentos-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(sp: Record<string, string | string[] | undefined>): PagamentoListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as PagamentoListFilters["status"]) || undefined,
    oficina_id: get("oficina_id") || undefined,
    periodo: (get("periodo") as PagamentoListFilters["periodo"]) || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const list = await listPagamentos(supabase, filters);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pagamentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          {list.total} {list.total === 1 ? "pagamento" : "pagamentos"} no total
        </p>
      </header>
      <PagamentosClient initial={list} filters={filters} />
    </div>
  );
}
