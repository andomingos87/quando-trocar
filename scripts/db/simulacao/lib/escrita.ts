// Escrita no Supabase com guardrails: nunca aponta para produção, insere em lotes, expõe SQL de
// administração (verificar/purgar) pela Management API.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "./mundo";

export const REF_PRODUCAO = "crxrdypnefgexifbrdij";
export const REF_SIMULACAO = "fplkasckmvvccnkrkszr";

export function refDoUrl(url: string | undefined): string {
  const m = (url ?? "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/);
  return m?.[1] ?? "";
}

export function garantirAmbiente(): { url: string; key: string; ref: string } {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ref = refDoUrl(url);
  const permitido = process.env.SIM_PROJECT_REF ?? REF_SIMULACAO;
  if (!url || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes. Rode com --env-file-if-exists=.env.simulacao");
  if (ref === REF_PRODUCAO) throw new Error(`RECUSADO: SUPABASE_URL aponta para PRODUÇÃO (${ref}).`);
  if (ref !== permitido) throw new Error(`RECUSADO: ref ${ref} difere do projeto de simulação (${permitido}).`);
  return { url, key, ref };
}

export function cliente(): SupabaseClient {
  const { url, key } = garantirAmbiente();
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function contar(sb: SupabaseClient, tabela: string): Promise<number> {
  const { count, error } = await sb.from(tabela).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${tabela}: ${error.message}`);
  return count ?? 0;
}

export async function inserir(sb: SupabaseClient, tabela: string, rows: Row[], lote = 500): Promise<void> {
  if (rows.length === 0) return;
  const inicio = Date.now();
  for (let i = 0; i < rows.length; i += lote) {
    const parte = rows.slice(i, i + lote);
    const { error } = await sb.from(tabela).insert(parte);
    if (error) {
      throw new Error(`insert ${tabela} (lote ${i / lote + 1}, ${parte.length} linhas): ${error.message}\nexemplo: ${JSON.stringify(parte[0]).slice(0, 600)}`);
    }
    process.stdout.write(`\r  ${tabela.padEnd(32)} ${Math.min(i + lote, rows.length).toString().padStart(7)}/${rows.length}`);
  }
  process.stdout.write(`  (${((Date.now() - inicio) / 1000).toFixed(1)}s)\n`);
}

/** SQL administrativo via Management API (TRUNCATE, agregações). Token: SUPABASE_ACCESS_TOKEN ou .mcp.json. */
export async function sqlAdmin(query: string): Promise<Row[]> {
  const ref = process.env.SIM_PROJECT_REF ?? REF_SIMULACAO;
  if (ref === REF_PRODUCAO) throw new Error("RECUSADO: ref de produção");
  let token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    try {
      const mcp = JSON.parse(readFileSync(".mcp.json", "utf8"));
      token = mcp?.mcpServers?.supabase?.env?.SUPABASE_ACCESS_TOKEN;
    } catch { /* sem .mcp.json */ }
  }
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente (env ou .mcp.json)");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const json = (await res.json()) as Row[] | null;
  return json ?? [];
}
