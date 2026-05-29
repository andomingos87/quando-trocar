import {
  listClientesFinais,
  type ClienteListFilters,
} from "@/lib/admin/clientes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ClientesClient } from "@/components/admin/clientes-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(
  sp: Record<string, string | string[] | undefined>,
): ClienteListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as ClienteListFilters["status"]) || "todas",
    oficina_id: get("oficina_id") || undefined,
    busca: get("busca") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const list = await listClientesFinais(supabase, filters);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Clientes finais</h1>
        <p className="mt-1 text-sm text-muted">
          {list.total} {list.total === 1 ? "cliente" : "clientes"} no total · WhatsApp mascarado
        </p>
      </header>
      <ClientesClient initial={list} filters={filters} />
    </div>
  );
}
