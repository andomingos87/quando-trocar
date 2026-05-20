import {
  getCohortPerfect,
  getMarketShareAmortecedor,
  getServicosPorCidade,
  getServicosPorTipo,
  parseRangeFromSearchParams,
} from "@/lib/admin/inteligencia-mercado";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InteligenciaMercadoClient } from "@/components/admin/inteligencia-mercado-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; cidade?: string }>;
};

export default async function InteligenciaMercadoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = parseRangeFromSearchParams(params);
  const cidade = params.cidade?.trim() || undefined;

  const supabase = createSupabaseAdminClient();
  const [porTipo, marketShare, porCidade, cohortPerfect] = await Promise.all([
    getServicosPorTipo(supabase, range),
    getMarketShareAmortecedor(supabase, range, cidade),
    getServicosPorCidade(supabase, range),
    getCohortPerfect(supabase, range),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Inteligência de mercado</h1>
        <p className="mt-1 text-sm text-muted">
          Mix de serviços, market-share de amortecedor, cidades ativas e cohort
          Perfect. Dados de cadastros (não receita). Admin-only — não compartilhar
          relatórios externos sem revisão contratual.
        </p>
      </header>

      <InteligenciaMercadoClient
        range={range}
        cidade={cidade ?? ""}
        porTipo={porTipo}
        marketShare={marketShare}
        porCidade={porCidade}
        cohortPerfect={cohortPerfect}
      />
    </div>
  );
}
