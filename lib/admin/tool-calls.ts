import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentMode =
  | "vendas"
  | "onboarding"
  | "operacao"
  | "cliente_final_lembrete"
  | "suporte";

export type ToolCallListRow = {
  id: string;
  tool_name: string;
  agent_mode: AgentMode | null;
  oficina_id: string | null;
  oficina_nome: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  conversa_id: string | null;
  is_error: boolean;
  created_at: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
};

export type ToolCallListFilters = {
  tool_name?: string;
  agent_mode?: AgentMode;
  oficina_id?: string;
  periodo?: "ultimas_24h" | "ultimos_7d" | "ultimos_30d";
  page?: number;
  pageSize?: number;
};

export type ToolCallListResult = {
  rows: ToolCallListRow[];
  total: number;
  page: number;
  pageSize: number;
  toolNames: string[];
};

const DEFAULT_PAGE_SIZE = 50;

function periodoToSinceIso(
  periodo: ToolCallListFilters["periodo"],
): string | undefined {
  if (!periodo) return undefined;
  const now = Date.now();
  if (periodo === "ultimas_24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (periodo === "ultimos_7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (periodo === "ultimos_30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

export async function listToolCalls(
  supabase: SupabaseClient,
  filters: ToolCallListFilters = {},
): Promise<ToolCallListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Filtragem por agent_mode exige conhecer quais conversa_ids tem o modo
  // desejado. Como o alias dinamico no PostgREST quebra o type generator,
  // fazemos pre-fetch das conversas e aplicamos .in() em conversa_id.
  let conversaIds: string[] | null = null;
  if (filters.agent_mode) {
    const { data: convData, error: convErr } = await supabase
      .from("conversas")
      .select("id")
      .eq("agent_mode", filters.agent_mode)
      .limit(10000);
    if (convErr) throw new Error(`list_tool_calls_conv_failed: ${convErr.message}`);
    conversaIds = (convData ?? []).map((c) => c.id as string);
    if (conversaIds.length === 0) {
      // Filtro impossivel — devolve resultado vazio sem chamar agent_tool_calls.
      const { data: toolNamesDistinct } = await supabase
        .from("agent_tool_calls")
        .select("tool_name")
        .order("tool_name", { ascending: true })
        .limit(500);
      const toolNames = Array.from(
        new Set((toolNamesDistinct ?? []).map((r) => r.tool_name as string)),
      );
      return { rows: [], total: 0, page, pageSize, toolNames };
    }
  }

  let query = supabase
    .from("agent_tool_calls")
    .select(
      `id, tool_name, oficina_id, lead_id, cliente_id, conversa_id, input, output, created_at,
       conversas:conversa_id (agent_mode),
       oficinas:oficina_id (nome)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.tool_name) query = query.eq("tool_name", filters.tool_name);
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);
  if (conversaIds) query = query.in("conversa_id", conversaIds);
  const sinceIso = periodoToSinceIso(filters.periodo);
  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { data, count, error } = await query;
  if (error) throw new Error(`list_tool_calls_failed: ${error.message}`);

  const rows: ToolCallListRow[] = (data ?? []).map((t) => {
    const conversaRaw = t.conversas as
      | { agent_mode: string }
      | { agent_mode: string }[]
      | null;
    const conversa = Array.isArray(conversaRaw) ? conversaRaw[0] ?? null : conversaRaw;
    const oficinaRaw = t.oficinas as { nome: string } | { nome: string }[] | null;
    const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;
    const output = (t.output ?? null) as Record<string, unknown> | null;
    const isError = !!(output && (output.ok === false || "error" in output));
    return {
      id: t.id as string,
      tool_name: t.tool_name as string,
      agent_mode: (conversa?.agent_mode as AgentMode | undefined) ?? null,
      oficina_id: (t.oficina_id ?? null) as string | null,
      oficina_nome: oficina?.nome ?? null,
      lead_id: (t.lead_id ?? null) as string | null,
      cliente_id: (t.cliente_id ?? null) as string | null,
      conversa_id: (t.conversa_id ?? null) as string | null,
      is_error: isError,
      created_at: t.created_at as string,
      input: (t.input ?? null) as Record<string, unknown> | null,
      output,
    };
  });

  // Distinct tool_names (para popular dropdown). Limitado a um set razoavel
  // — o painel tem poucas tools hoje.
  const { data: distinctRaw } = await supabase
    .from("agent_tool_calls")
    .select("tool_name")
    .order("tool_name", { ascending: true })
    .limit(500);
  const toolNames = Array.from(
    new Set((distinctRaw ?? []).map((r) => r.tool_name as string)),
  );

  return { rows, total: count ?? 0, page, pageSize, toolNames };
}
