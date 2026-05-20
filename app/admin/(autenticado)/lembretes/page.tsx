import {
  listLembretes,
  type LembreteListFilters,
} from "@/lib/admin/lembretes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LembretesClient } from "@/components/admin/lembretes-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(
  sp: Record<string, string | string[] | undefined>,
): LembreteListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as LembreteListFilters["status"]) || "todas",
    oficina_id: get("oficina_id") || undefined,
    periodo: (get("periodo") as LembreteListFilters["periodo"]) || undefined,
    busca: get("busca") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function LembretesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const list = await listLembretes(supabase, filters);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Lembretes</h1>
        <p className="mt-1 text-sm text-muted">
          {list.total} {list.total === 1 ? "lembrete" : "lembretes"} no total · PII mascarada
        </p>
      </header>
      <LembretesClient initial={list} filters={filters} />
    </div>
  );
}
