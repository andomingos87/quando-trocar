import { listOficinas, type OficinaListFilters } from "@/lib/admin/oficinas";
import { listPlanos } from "@/lib/admin/planos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OficinasClient } from "@/components/admin/oficinas-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(sp: Record<string, string | string[] | undefined>): OficinaListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as OficinaListFilters["status"]) || "todas",
    plano_id: get("plano_id") || undefined,
    origem: (get("origem") as OficinaListFilters["origem"]) || undefined,
    motivo_pausa: (get("motivo_pausa") as OficinaListFilters["motivo_pausa"]) || undefined,
    busca: get("busca") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function OficinasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const [list, planos] = await Promise.all([
    listOficinas(supabase, filters),
    listPlanos(supabase),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Oficinas</h1>
        <p className="mt-1 text-sm text-slate-600">
          {list.total} {list.total === 1 ? "oficina" : "oficinas"} no total
        </p>
      </header>
      <OficinasClient
        initial={list}
        filters={filters}
        planos={planos.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
      />
    </div>
  );
}
