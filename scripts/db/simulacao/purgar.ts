// Apaga TODOS os dados transacionais do projeto de SIMULAÇÃO (mantém config: planos, faq,
// tipos_servico_default, catálogo global, configuracoes_*, admin Anderson).
//   npm run sim:purgar -- --confirmar
import { sqlAdmin, garantirAmbiente } from "./lib/escrita";

async function main() {
  if (!process.argv.includes("--confirmar")) { console.error("Passe --confirmar para apagar os dados do projeto de simulação."); process.exit(2); }
  const { ref } = garantirAmbiente();
  console.log(`▶ purgando projeto ${ref}`);
  await sqlAdmin(`truncate table
    public.whatsapp_events, public.mensagens, public.outbound_messages, public.agent_tool_calls,
    public.admin_audit_log, public.auth_otps, public.perguntas_sem_resposta, public.divergencias_intencao_vendas,
    public.gatilhos_intencao_vendas, public.conversas, public.lembretes, public.servicos, public.clientes_finais,
    public.veiculos, public.leads_oficina, public.representante_link_cliques, public.comissoes, public.pagamentos,
    public.cobranca_jobs, public.oficina_members, public.oficinas, public.representantes,
    public.prospeccao_estabelecimentos, public.prospeccao_execucoes, public.prospeccao_areas,
    public.ad_insights_daily, public.meta_phone_status
    restart identity cascade`);
  await sqlAdmin(`delete from public.admin_users where whatsapp like '+5500%'`);
  await sqlAdmin(`delete from public.servicos_catalogo where oficina_id is not null`);
  console.log("✔ purgado");
}

main().catch((err) => { console.error("✖", err instanceof Error ? err.message : err); process.exit(1); });
