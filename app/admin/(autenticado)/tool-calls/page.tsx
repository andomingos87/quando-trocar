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
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Ações dos agentes de IA</h1>
          <p className="mt-1 text-sm text-muted">
            {list.total.toLocaleString("pt-BR")}{" "}
            {list.total === 1 ? "ação registrada" : "ações registradas"} · auditoria
            das decisões automáticas
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-soft p-4 text-sm leading-relaxed text-muted">
          <p>
            Cada vez que um agente de IA decide fazer algo no WhatsApp — converter
            um lead, registrar uma troca, consultar o FAQ ou bloquear uma mensagem
            suspeita — a ação fica registrada aqui como uma{" "}
            <span className="font-medium text-ink">tool call</span>. Use esta tela
            para auditar o que a IA fez, em qual conversa, e abrir o payload completo
            (entrada e saída) de cada decisão.{" "}
            <span className="font-medium text-ink">
              Passe o mouse sobre cada ação
            </span>{" "}
            para ver o que ela significa.
          </p>
        </div>
      </header>
      <ToolCallsClient initial={list} filters={filters} />
    </div>
  );
}
