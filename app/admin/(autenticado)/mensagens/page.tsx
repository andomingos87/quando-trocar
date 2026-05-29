import {
  getOutboundSummary,
  listOutboundMessages,
  type OutboundListFilters,
} from "@/lib/admin/mensagens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MensagensClient } from "@/components/admin/mensagens-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(
  sp: Record<string, string | string[] | undefined>,
): OutboundListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: (get("status") as OutboundListFilters["status"]) || "todas",
    message_kind:
      (get("message_kind") as OutboundListFilters["message_kind"]) || undefined,
    oficina_id: get("oficina_id") || undefined,
    periodo: (get("periodo") as OutboundListFilters["periodo"]) || undefined,
    busca: get("busca") || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function MensagensPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const [list, summary] = await Promise.all([
    listOutboundMessages(supabase, filters),
    getOutboundSummary(supabase, filters),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mensagens</h1>
        <p className="mt-1 text-sm text-muted">
          {list.total} {list.total === 1 ? "mensagem" : "mensagens"} no filtro · agrupadas por conversa · PII mascarada
        </p>
      </header>
      <MensagensClient initial={list} summary={summary} filters={filters} />
    </div>
  );
}
