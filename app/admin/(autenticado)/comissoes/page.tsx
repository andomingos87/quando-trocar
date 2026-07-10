import { listComissoes, type ComissaoListFilters } from "@/lib/admin/comissoes";
import { listRepresentantes } from "@/lib/admin/representantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ComissoesClient } from "@/components/admin/comissoes-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(sp: Record<string, string | string[] | undefined>): ComissaoListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = get("status");
  return {
    representante_id: get("representante_id") || undefined,
    status:
      status === "prevista" || status === "paga" || status === "cancelada"
        ? status
        : undefined,
    mes: get("mes") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const [list, representantes] = await Promise.all([
    listComissoes(supabase, filters),
    listRepresentantes(supabase),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Comissoes</h1>
        <p className="mt-1 text-sm text-muted">
          Uma linha por pagamento confirmado de oficina atribuida a um representante.
          O valor e congelado na regra vigente no momento do pagamento.
        </p>
      </header>

      <ComissoesClient
        initial={list}
        filters={filters}
        representantes={representantes.map((r) => ({ id: r.id, nome: r.nome }))}
      />
    </div>
  );
}
