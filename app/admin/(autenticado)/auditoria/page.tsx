import {
  type AuditFilters,
  listAuditEntries,
  listKnownAcoes,
  listKnownEntidades,
} from "@/lib/admin/audit-queries";
import { listAdmins } from "@/lib/admin/admins";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AuditoriaClient } from "@/components/admin/auditoria-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    admin_id: get("admin_id") || undefined,
    entidade: get("entidade") || undefined,
    acao: get("acao") || undefined,
    entidade_id: get("entidade_id") || undefined,
    data_inicio: get("data_inicio") || undefined,
    data_fim: get("data_fim") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const [entries, admins, acoes, entidades] = await Promise.all([
    listAuditEntries(supabase, filters),
    listAdmins(supabase),
    listKnownAcoes(supabase),
    listKnownEntidades(supabase),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="mt-1 text-sm text-muted">
          {entries.total} {entries.total === 1 ? "entrada" : "entradas"} no total
        </p>
      </header>
      <AuditoriaClient
        initial={entries}
        filters={filters}
        admins={admins.map((a) => ({ id: a.id, nome: a.nome }))}
        acoes={acoes}
        entidades={entidades}
      />
    </div>
  );
}
