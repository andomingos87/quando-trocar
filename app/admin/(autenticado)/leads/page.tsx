import { listLeads, type LeadListFilters } from "@/lib/admin/leads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LeadsClient } from "@/components/admin/leads-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(sp: Record<string, string | string[] | undefined>): LeadListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as LeadListFilters["status"]) || "todas",
    origem: (get("origem") as LeadListFilters["origem"]) || undefined,
    oficina_id: get("oficina_id") || undefined,
    busca: get("busca") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const list = await listLeads(supabase, filters);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          {list.total} {list.total === 1 ? "lead" : "leads"} no total
        </p>
      </header>
      <LeadsClient initial={list} filters={filters} />
    </div>
  );
}
