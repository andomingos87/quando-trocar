import {
  listToolCalls,
  type ToolCallListFilters,
} from "@/lib/admin/tool-calls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ToolCallsClient } from "@/components/admin/tool-calls-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilters(
  sp: Record<string, string | string[] | undefined>,
): ToolCallListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    tool_name: get("tool_name") || undefined,
    agent_mode: (get("agent_mode") as ToolCallListFilters["agent_mode"]) || undefined,
    oficina_id: get("oficina_id") || undefined,
    periodo: (get("periodo") as ToolCallListFilters["periodo"]) || undefined,
    page: Math.max(1, Number(get("page") || "1") || 1),
    pageSize: 50,
  };
}

export default async function ToolCallsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const supabase = createSupabaseAdminClient();
  const list = await listToolCalls(supabase, filters);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tool calls do agente</h1>
        <p className="mt-1 text-sm text-muted">
          {list.total} chamadas no total · auditoria das decisoes do LLM
        </p>
      </header>
      <ToolCallsClient initial={list} filters={filters} />
    </div>
  );
}
