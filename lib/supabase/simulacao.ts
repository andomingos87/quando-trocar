// Identifica o projeto Supabase de SIMULAÇÃO (dados fictícios, ver docs/runbooks/simulacao-dados.md).
// O ref é fixo no código de propósito: nenhuma variável de ambiente consegue "promover" outro
// banco (produção, por exemplo) a simulação.
export const SUPABASE_REF_SIMULACAO = "fplkasckmvvccnkrkszr";

export function refDoSupabaseUrl(url: string | undefined | null): string | null {
  const match = (url ?? "").match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1].toLowerCase() : null;
}

/** true quando o app está apontado para o projeto de simulação (nunca para produção). */
export function isSupabaseSimulacao(url: string | undefined | null = process.env.SUPABASE_URL): boolean {
  return refDoSupabaseUrl(url) === SUPABASE_REF_SIMULACAO;
}
