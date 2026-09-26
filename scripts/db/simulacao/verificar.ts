// Imprime a "foto" do banco de simulação e compara com os alvos do plano.
//   npm run sim:verificar
import { sqlAdmin, garantirAmbiente } from "./lib/escrita";

const ALVOS: Record<string, number> = { "oficinas ativa+pago": 197, "oficinas em teste (ativa)": 34, "pausadas inadimplência": 9, "pausadas voluntária": 3, "leads total": 1150 };

async function main() {
  const { ref } = garantirAmbiente();
  console.log(`▶ verificando projeto ${ref}`);
  const q = async (sql: string) => (await sqlAdmin(sql))[0] ?? {};
  const linhas: Array<[string, unknown]> = [];
  const r1 = await q(`select
    count(*) filter (where status='ativa' and plano='pago') as ativa_pago,
    count(*) filter (where status='ativa' and plano='teste') as em_teste,
    count(*) filter (where plano='teste') as plano_teste_total,
    count(*) filter (where status='pausada' and motivo_pausa='inadimplencia') as inad,
    count(*) filter (where status='pausada' and motivo_pausa='voluntaria') as vol,
    count(*) filter (where status='cancelada') as canceladas,
    count(*) as total from oficinas where deleted_at is null`);
  linhas.push(["oficinas ativa+pago", r1.ativa_pago], ["oficinas em teste (ativa)", r1.em_teste], ["oficinas plano=teste (card 'em teste' do admin)", r1.plano_teste_total], ["pausadas inadimplência", r1.inad], ["pausadas voluntária", r1.vol], ["canceladas", r1.canceladas], ["oficinas total", r1.total]);
  const mrr = await q(`select round(sum(coalesce(o.preco_negociado, p.preco_base)),2) as mrr, count(*) as n from oficinas o join planos p on p.id=o.plano_id where o.status='ativa'`);
  linhas.push(["MRR (regra 11.3: todas ativas)", `R$ ${mrr.mrr} (${mrr.n} oficinas)`]);
  const leads = await sqlAdmin(`select status, count(*) as n from leads_oficina group by 1 order by 2 desc`);
  linhas.push(["leads total", leads.reduce((a, r) => a + Number(r.n), 0)], ["leads por status", leads.map((r) => `${r.status} ${r.n}`).join(" · ")]);
  const pag = await q(`select count(*) filter (where status='pago') pago, count(*) filter (where status='pendente') pendente, count(*) filter (where status='falhou') falhou, count(*) filter (where status='cancelado') cancelado, round(sum(valor) filter (where status='pago' and paid_at >= date_trunc('month', now())),2) receita_mes from pagamentos`);
  linhas.push(["pagamentos pago/pendente/falhou/cancelado", `${pag.pago}/${pag.pendente}/${pag.falhou}/${pag.cancelado}`], ["receita recebida no mês", `R$ ${pag.receita_mes}`]);
  const com = await q(`select count(*) filter (where status='prevista') prevista, count(*) filter (where status='paga') paga, round(sum(valor) filter (where status='prevista' and created_at >= date_trunc('month', now())),2) prevista_mes from comissoes`);
  linhas.push(["comissões prevista/paga", `${com.prevista}/${com.paga} (prevista no mês R$ ${com.prevista_mes})`]);
  const op = await q(`select (select count(*) from clientes_finais) clientes, (select count(*) from veiculos) veiculos, (select count(*) from servicos) servicos, (select count(*) from lembretes) lembretes`);
  linhas.push(["clientes / veículos / serviços / lembretes", `${op.clientes} / ${op.veiculos} / ${op.servicos} / ${op.lembretes}`]);
  const lem = await sqlAdmin(`select status, count(*) n from lembretes group by 1 order by 2 desc`);
  linhas.push(["lembretes por status", lem.map((r) => `${r.status} ${r.n}`).join(" · ")]);
  const ret = await q(`select count(*) n from servicos s where exists (select 1 from servicos s2 where s2.cliente_id=s.cliente_id and s2.veiculo_id=s.veiculo_id and s2.data_servico < s.data_servico)`);
  linhas.push(["retornos (2º serviço do mesmo cliente/veículo)", ret.n]);
  const msg = await q(`select (select count(*) from conversas) conversas, (select count(*) from conversas where handoff_required) em_handoff, (select count(*) from mensagens) mensagens, (select count(*) from outbound_messages) outbound, (select count(*) from whatsapp_events) eventos, (select count(*) from agent_tool_calls) tool_calls`);
  linhas.push(["conversas (em handoff) / mensagens / outbound / eventos / tool calls", `${msg.conversas} (${msg.em_handoff}) / ${msg.mensagens} / ${msg.outbound} / ${msg.eventos} / ${msg.tool_calls}`]);
  const ext = await q(`select (select count(*) from admin_audit_log) audit, (select count(*) from cobranca_jobs) jobs, (select count(*) from perguntas_sem_resposta where status='aberta') perguntas, (select count(*) from divergencias_intencao_vendas) diverg, (select count(*) from ad_insights_daily) ads, (select count(*) from prospeccao_estabelecimentos) prosp, (select count(*) from representante_link_cliques) cliques, (select count(*) from representantes) reps`);
  linhas.push(["auditoria / cobranca_jobs / perguntas abertas / divergências", `${ext.audit} / ${ext.jobs} / ${ext.perguntas} / ${ext.diverg}`], ["ads (linhas-dia) / prospecção / cliques / reps", `${ext.ads} / ${ext.prosp} / ${ext.cliques} / ${ext.reps}`]);
  // guardrails
  const g = await q(`select
    (select count(*) from lembretes where status='pendente' and scheduled_at < date_trunc('day', now())) pend_passado,
    (select count(*) from outbound_messages where status in ('pending','retry_scheduled') and created_at < now() - interval '1 day') outbox_antigo,
    (select count(*) from (select whatsapp w from leads_oficina union all select whatsapp_principal from oficinas union all select whatsapp from clientes_finais union all select whatsapp from representantes) t where w !~ '^\\+550[012]9[0-9]{8}$') fora_prefixo`);
  linhas.push(["GUARDRAIL lembretes pendentes no passado", g.pend_passado], ["GUARDRAIL outbox pendente antigo", g.outbox_antigo], ["GUARDRAIL telefones fora do prefixo", g.fora_prefixo]);

  let falhas = 0;
  for (const [k, v] of linhas) {
    const alvo = ALVOS[k];
    let marca = "";
    if (alvo !== undefined) { const desvio = Math.abs(Number(v) - alvo) / alvo; marca = desvio <= 0.03 ? `  ✔ alvo ${alvo}` : `  ✖ alvo ${alvo}`; if (desvio > 0.03) falhas += 1; }
    if (k.startsWith("GUARDRAIL")) { marca = Number(v) === 0 ? "  ✔" : "  ✖"; if (Number(v) !== 0) falhas += 1; }
    console.log(`  ${k.padEnd(62)} ${String(v)}${marca}`);
  }
  if (falhas) { console.error(`\n✖ ${falhas} verificação(ões) fora do alvo`); process.exit(1); }
  console.log("\n✔ foto dentro do alvo");
}

main().catch((err) => { console.error("✖", err instanceof Error ? err.message : err); process.exit(1); });
