// Gera o mundo simulado e grava no projeto de SIMULAÇÃO.
//
//   npm run sim:gerar                      # seed 197, "hoje" = data atual (BRT)
//   npm run sim:gerar -- --seed 7 --dry    # só gera em memória e imprime a foto
//   npm run sim:gerar -- --ate 2026-09-26 --forcar
//
// Plano e premissas: docs/simulacao/plano-simulacao-197-clientes.md
import { Rng } from "./lib/prng";
import { Mundo, type Row } from "./lib/mundo";
import { brt, dataBRT, somaDias, iso, momento, meiaNoiteUtc, DIA_MS, HORA_MS, splitData } from "./lib/tempo";
import { gerarLead, ADMIN_ID, ADMIN_IP, PESO_ROTEIRO_CONVERTE, PESO_ROTEIRO_NAO_CONVERTE, type Roteiro, type PlanoLead, type Faq, type ResultadoLead } from "./lib/vendas";
import { criarOficina, gerarComissoes, gerarCobrancaJobs, type Destino, type OficinaSim } from "./lib/oficina";
import { gerarOperacao, type ItemCatalogo } from "./lib/operacao";
import { criarRepresentantes, pesoRep, criarAdminExtra, gerarAnuncios, anuncioAtivoEm, gerarLinkCliques, gerarProspeccao, gerarVolantes, gerarMetaPhoneStatus, gerarLoginsAdmin } from "./lib/extras";
import { cliente as criarCliente, contar, inserir, garantirAmbiente } from "./lib/escrita";
import { ipFicticio } from "./lib/identidades";

type Args = { seed: number; ate: string; dry: boolean; forcar: boolean };

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const hojeBRT = dataBRT(Date.now());
  return { seed: Number(get("--seed") ?? 197), ate: get("--ate") ?? hojeBRT, dry: argv.includes("--dry"), forcar: argv.includes("--forcar") };
}

// Coortes (mês relativo a "hoje": -5 … 0) — números da §1.2 do plano.
const COORTES = [
  { leads: 100, ativa: 14, inadReg: 1, cancel: 4, inadHoje: 1, vol: 1, expirado: 11, emTeste: 0 },
  { leads: 140, ativa: 22, inadReg: 2, cancel: 4, inadHoje: 2, vol: 0, expirado: 15, emTeste: 0 },
  { leads: 180, ativa: 29, inadReg: 3, cancel: 4, inadHoje: 2, vol: 1, expirado: 19, emTeste: 0 },
  { leads: 220, ativa: 38, inadReg: 4, cancel: 2, inadHoje: 2, vol: 1, expirado: 23, emTeste: 0 },
  { leads: 260, ativa: 49, inadReg: 4, cancel: 1, inadHoje: 2, vol: 0, expirado: 27, emTeste: 0 },
  { leads: 250, ativa: 31, inadReg: 0, cancel: 0, inadHoje: 0, vol: 0, expirado: 15, emTeste: 34 },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { ref } = garantirAmbiente();
  const [y, mo, d] = splitData(args.ate);
  const agora = brt(y, mo, d, 15, 40, 0); // "agora" fixo dentro do dia alvo
  const hoje = args.ate;
  const rng = new Rng(args.seed);
  const runId = `s${args.seed}-${hoje.replace(/-/g, "")}`;
  const m = new Mundo(rng, runId, agora);
  console.log(`▶ simulação seed=${args.seed} hoje=${hoje} run=${runId} projeto=${ref}${args.dry ? " (dry)" : ""}`);

  const sb = criarCliente();
  // ── Config existente no banco ─────────────────────────────────────────
  const [{ data: planos }, { data: admins }, { data: catalogo }, { data: produtos }, { data: faqs }] = await Promise.all([
    sb.from("planos").select("id, nome, preco_base").eq("ativo", true),
    sb.from("admin_users").select("id, nome, whatsapp").order("created_at"),
    sb.from("servicos_catalogo").select("id, familia, produto_label, template_name, intervalo_dias").is("oficina_id", null).eq("padrao_familia", true),
    sb.from("produtos_catalogo").select("id, slug"),
    sb.from("faq_vendas").select("id, pergunta, resposta, palavras_chave").eq("ativo", true),
  ]);
  if (!planos?.length) throw new Error("planos vazio — migrations aplicadas?");
  if (!admins?.length) throw new Error("admin_users vazio");
  if (!catalogo || catalogo.length < 4) throw new Error("servicos_catalogo sem os 4 itens globais");
  const planoId = planos[0].id as string;
  const adminAnderson = admins[0].id as string;
  ADMIN_ID.valor = adminAnderson;
  ADMIN_IP.valor = ipFicticio(rng);
  const catalogoMap = new Map<string, ItemCatalogo>();
  for (const c of catalogo) catalogoMap.set(String(c.familia), { id: String(c.id), familia: String(c.familia), produto_label: String(c.produto_label ?? "revisão"), template_name: String(c.template_name ?? "lembrete_servico"), intervalo_dias: Number(c.intervalo_dias ?? 90) });
  const produtosMap = new Map<string, string>();
  for (const p of produtos ?? []) { const marca = String(p.slug).replace("amortecedor-", ""); produtosMap.set(marca, String(p.id)); }
  const faqList: Faq[] = (faqs ?? []).map((f) => ({ id: String(f.id), pergunta: String(f.pergunta), resposta: String(f.resposta), palavras_chave: (f.palavras_chave as string[]) ?? [] }));

  if (!args.dry) {
    const jaTem = await contar(sb, "oficinas");
    if (jaTem > 0 && !args.forcar) throw new Error(`o banco já tem ${jaTem} oficinas. Rode npm run sim:purgar -- --confirmar antes, ou passe --forcar.`);
  }

  // ── Apoio ─────────────────────────────────────────────────────────────
  const seqFone = { n: 0 };
  const reps = criarRepresentantes(m, seqFone);
  const adminExtra = criarAdminExtra(m, seqFone);
  const anuncios = gerarAnuncios(m);
  const repCriadoEm = new Map(reps.map((r) => [r.id, Date.parse(String(m.representantes.find((x) => x.id === r.id)!.created_at))]));

  // ── Leads por coorte ──────────────────────────────────────────────────
  type Slot = { destino: Destino | null; em: number; roteiro: Roteiro };
  const slots: Slot[] = [];
  const mesInicio = (k: number) => { const dt = new Date(Date.UTC(y, mo - 1 - k, 1)); return dt.toISOString().slice(0, 10); };
  const mesFim = (k: number) => { const dt = new Date(Date.UTC(y, mo - k, 0)); return dt.toISOString().slice(0, 10); };
  const limite = (dias: number) => agora - dias * DIA_MS;
  for (let k = 5; k >= 0; k -= 1) {
    const c = COORTES[5 - k];
    const ini = meiaNoiteUtc(mesInicio(k)) + 3 * HORA_MS;
    const fim = Math.min(meiaNoiteUtc(mesFim(k)) + 27 * HORA_MS, agora - HORA_MS);
    const destinos: Array<Destino | null> = [];
    const push = (dst: Destino, n: number) => { for (let i = 0; i < n; i += 1) destinos.push(dst); };
    push("ativa", c.ativa); push("inad_regularizada", c.inadReg); push("cancelada", c.cancel); push("inad_hoje", c.inadHoje);
    push("vol_pausada", c.vol); push("teste_expirado", c.expirado); push("em_teste", c.emTeste);
    while (destinos.length < c.leads) destinos.push(null);
    rng.shuffle(destinos);
    for (const dst of destinos) {
      let de = ini, ate = fim;
      if (dst === "em_teste") { de = Math.max(ini, limite(13)); ate = Math.min(fim, limite(1)); }
      else if (dst === "inad_hoje") { ate = Math.min(fim, limite(48)); }
      else if (dst === "cancelada") { ate = Math.min(fim, limite(52)); }
      else if (dst === "inad_regularizada") { ate = Math.min(fim, limite(45)); }
      else if (dst === "vol_pausada") { ate = Math.min(fim, limite(24)); }
      else if (dst) { ate = Math.min(fim, limite(15)); }
      if (ate <= de) { de = Math.max(ini - 20 * DIA_MS, ate - 10 * DIA_MS); }
      const em = momento(rng, de, ate, "lead");
      let roteiro: Roteiro = dst ? rng.weighted(PESO_ROTEIRO_CONVERTE) : rng.weighted(PESO_ROTEIRO_NAO_CONVERTE);
      if (dst === "em_teste" && roteiro === "preco_handoff_manual") roteiro = "direto";
      slots.push({ destino: dst, em, roteiro });
    }
  }
  slots.sort((a, b) => a.em - b.em);

  const resultados: ResultadoLead[] = [];
  const oficinas: OficinaSim[] = [];
  let convFalhas = 0;
  for (const s of slots) {
    seqFone.n += 1;
    const dia = dataBRT(s.em);
    const anuncio = anuncioAtivoEm(rng, anuncios, dia);
    const repsDisp = reps.filter((r) => (repCriadoEm.get(r.id) ?? 0) < s.em);
    const canal = rng.weighted<"ad" | "rep" | "organico">([["ad", anuncio ? 35 : 0], ["rep", repsDisp.length ? 30 : 0], ["organico", 35]]);
    const plano: PlanoLead = { em: s.em, roteiro: s.roteiro, canal, deveConverter: s.destino !== null };
    if (canal === "ad") plano.anuncio = anuncio;
    if (canal === "rep") { plano.rep = rng.weighted(repsDisp.map((r) => [r, pesoRep(r.codigo)] as const)); plano.repVia = rng.chance(0.45) ? "site_link" : "wa_prefill"; }
    const r = gerarLead(m, plano, faqList, seqFone.n);
    resultados.push(r);
    if (s.destino) {
      if (!r.conversaoEm) { convFalhas += 1; m.leads.push(r.lead); continue; }
      const o = criarOficina(m, r, s.destino, planoId, null);
      r.lead.oficina_id = o.id;
      oficinas.push(o);
    } else if (r.conversaoEm) {
      // roteiro não deveria converter — não acontece por construção
      convFalhas += 1;
    }
    m.leads.push(r.lead);
  }
  console.log(`  leads ${m.leads.length} · oficinas ${oficinas.length} · falhas de conversão ${convFalhas}`);

  // ── Oficina interna (demo da landing) ─────────────────────────────────
  m.oficinas.push({
    id: rng.uuid(), nome: "Auto Center Silva", responsavel: "Anderson Domingos", whatsapp_principal: "+5500900000000", cidade: "Curitiba", ticket_medio: 250, volume_trocas_mes: 80,
    status: "ativa", plano: "interno", origem: "manual", timezone: "America/Sao_Paulo", dias_lembrete_padrao: 90, horario_envio_inicio: "08:00:00", horario_envio_fim: "18:00:00",
    created_at: iso(brt(2026, 4, 25, 18, 40)), updated_at: iso(brt(2026, 4, 25, 18, 40)), plano_id: planoId, estado: "PR", observacao: "Oficina interna de demonstração.",
  });

  // ── Operação ──────────────────────────────────────────────────────────
  const ctx = { catalogo: catalogoMap, produtos: produtosMap, seqCliente: { n: 0 } };
  let i = 0;
  for (const o of oficinas) {
    gerarOperacao(m, o, ctx);
    i += 1;
    if (i % 50 === 0) process.stdout.write(`\r  operação ${i}/${oficinas.length}`);
  }
  process.stdout.write(`\r  operação ${oficinas.length}/${oficinas.length}\n`);
  for (const o of oficinas) { m.oficinas.push(o.row); m.pagamentos.push(...o.pagamentos); }

  gerarComissoes(m, oficinas, reps);
  gerarCobrancaJobs(m, oficinas);
  gerarLinkCliques(m, reps);
  gerarProspeccao(m, m.leads.filter((l) => l.origem === "manual_whatsapp" && !l.ad_id && !l.representante_id).slice(0, 40));
  gerarVolantes(m, faqList);
  gerarMetaPhoneStatus(m);
  gerarLoginsAdmin(m, [adminAnderson, adminExtra]);

  // ── Conversas → rows ──────────────────────────────────────────────────
  const conversasRows: Row[] = m.conversas.map((c) => ({
    id: c.id, lead_id: c.lead_id, oficina_id: c.oficina_id, cliente_id: c.cliente_id, participant_whatsapp: c.participant_whatsapp,
    participant_type: c.participant_type, agent_mode: c.agent_mode, handoff_required: c.handoff_required, handoff_reason: c.handoff_reason,
    last_message_at: c.last_message_at ? iso(c.last_message_at) : null, created_at: iso(c.created_at), updated_at: iso(c.updated_at), context: c.context, bot_muted_until: null,
  }));

  // ── Guardrails ────────────────────────────────────────────────────────
  const inicioHojeUtc = meiaNoiteUtc(hoje);
  const pendentesPassado = m.lembretes.filter((l) => l.status === "pendente" && Date.parse(String(l.scheduled_at)) < inicioHojeUtc).length;
  const outboxPendentePassado = m.outbound.filter((o) => (o.status === "pending" || o.status === "retry_scheduled") && Date.parse(String(o.created_at)) < inicioHojeUtc - DIA_MS).length;
  const forasDoPrefixo = [...m.leads.map((l) => l.whatsapp), ...m.oficinas.map((o) => o.whatsapp_principal), ...m.clientes.map((c) => c.whatsapp), ...m.representantes.map((r) => r.whatsapp)]
    .filter((w) => !/^\+550[012]9\d{8}$/.test(String(w))).length;
  const tabelasFuturo: Array<[string, Row[]]> = [["mensagens", m.mensagens], ["outbound", m.outbound], ["tool_calls", m.tool_calls], ["audit", m.audit], ["pagamentos", m.pagamentos], ["oficinas", m.oficinas], ["leads", m.leads], ["comissoes", m.comissoes]];
  const futuros = tabelasFuturo.flatMap(([t, rows]) => rows.filter((r) => Date.parse(String(r.created_at)) > agora + HORA_MS).map((r) => `${t}:${r.created_at}:${r.acao ?? r.tool_name ?? r.status ?? ""}`));
  const futuro = futuros.length;
  if (futuro) console.log("  futuro:", futuros.slice(0, 12).join(" | "));
  const problemas: string[] = [];
  if (pendentesPassado) problemas.push(`${pendentesPassado} lembretes pendentes no passado`);
  if (outboxPendentePassado) problemas.push(`${outboxPendentePassado} outbound pending antigos`);
  if (forasDoPrefixo) problemas.push(`${forasDoPrefixo} telefones fora do prefixo +5500/01/02`);
  if (futuro) problemas.push(`${futuro} registros com created_at no futuro`);
  if (problemas.length) throw new Error(`guardrails violados: ${problemas.join("; ")}`);

  // ── Foto ──────────────────────────────────────────────────────────────
  const conta = (arr: Row[], f: (r: Row) => boolean) => arr.filter(f).length;
  const foto: Array<[string, number | string]> = [
    ["oficinas ativa+pago", conta(m.oficinas, (o) => o.status === "ativa" && o.plano === "pago")],
    ["oficinas em teste (plano=teste, ativa)", conta(m.oficinas, (o) => o.plano === "teste" && o.status === "ativa")],
    ["oficinas pausadas inad/vol", `${conta(m.oficinas, (o) => o.motivo_pausa === "inadimplencia")}/${conta(m.oficinas, (o) => o.motivo_pausa === "voluntaria")}`],
    ["oficinas canceladas (churn + teste expirado)", conta(m.oficinas, (o) => o.status === "cancelada")],
    ["leads por status", ["convertido", "perdido", "em_conversa", "qualificado", "interessado", "novo", "teste_aceito"].map((s) => `${s} ${conta(m.leads, (l) => l.status === s)}`).join(" · ")],
    ["MRR (ativas × preço)", `R$ ${m.oficinas.filter((o) => o.status === "ativa").reduce((a, o) => a + Number(o.preco_negociado ?? 59), 0)}`],
    ["pagamentos pago/pendente/falhou/cancelado", ["pago", "pendente", "falhou", "cancelado"].map((s) => conta(m.pagamentos, (p) => p.status === s)).join("/")],
    ["comissões prevista/paga", `${conta(m.comissoes, (c) => c.status === "prevista")}/${conta(m.comissoes, (c) => c.status === "paga")}`],
    ["clientes / veículos / serviços", `${m.clientes.length} / ${m.veiculos.length} / ${m.servicos.length}`],
    ["lembretes por status", ["pendente", "enfileirado", "enviado", "respondido", "sem_resposta", "cancelado", "erro_envio"].map((s) => `${s} ${conta(m.lembretes, (l) => l.status === s)}`).join(" · ")],
    ["conversas / mensagens / outbound / eventos / tool calls", `${conversasRows.length} / ${m.mensagens.length} / ${m.outbound.length} / ${m.eventos.length} / ${m.tool_calls.length}`],
    ["auditoria / cobranca_jobs / perguntas / divergências", `${m.audit.length} / ${m.cobranca_jobs.length} / ${m.perguntas.length} / ${m.divergencias.length}`],
    ["ads (linhas-dia) / prospecção estab. / cliques", `${m.ad_insights.length} / ${m.prospeccao_estab.length} / ${m.link_cliques.length}`],
  ];
  console.log("\n  FOTO DE HOJE");
  for (const [k, v] of foto) console.log(`  ${k.padEnd(48)} ${v}`);

  if (args.dry) { console.log("\n(dry) nada gravado."); return; }

  // ── Escrita (ordem de FK) ─────────────────────────────────────────────
  console.log("\n  gravando…");
  await sb.from("configuracoes_vendedor").update({ geracao_llm_modo: "on", updated_at: iso(brt(2026, 7, 11, 10)) }).not("id", "is", null);
  await sb.from("configuracoes_pagamento").update({ provedor_ativo: "asaas", asaas_ambiente: "producao", updated_at: iso(brt(2026, 7, 12, 11)) }).not("id", "is", null);
  await inserir(sb, "admin_users", m.admin_users_extra);
  await inserir(sb, "representantes", m.representantes);
  await inserir(sb, "ad_insights_daily", m.ad_insights);
  await inserir(sb, "oficinas", m.oficinas);
  await inserir(sb, "leads_oficina", m.leads);
  await inserir(sb, "representante_link_cliques", m.link_cliques);
  await inserir(sb, "clientes_finais", m.clientes);
  await inserir(sb, "veiculos", m.veiculos);
  await inserir(sb, "servicos", m.servicos);
  await inserir(sb, "lembretes", m.lembretes);
  await inserir(sb, "conversas", conversasRows);
  await inserir(sb, "mensagens", m.mensagens, 400);
  await inserir(sb, "outbound_messages", m.outbound, 400);
  await inserir(sb, "whatsapp_events", m.eventos, 400);
  await inserir(sb, "agent_tool_calls", m.tool_calls, 400);
  await inserir(sb, "pagamentos", m.pagamentos);
  await inserir(sb, "comissoes", m.comissoes);
  await inserir(sb, "cobranca_jobs", m.cobranca_jobs);
  await inserir(sb, "admin_audit_log", m.audit);
  await inserir(sb, "perguntas_sem_resposta", m.perguntas);
  await inserir(sb, "divergencias_intencao_vendas", m.divergencias);
  await inserir(sb, "gatilhos_intencao_vendas", m.gatilhos);
  await inserir(sb, "prospeccao_areas", m.prospeccao_areas);
  await inserir(sb, "prospeccao_execucoes", m.prospeccao_execucoes);
  await inserir(sb, "prospeccao_estabelecimentos", m.prospeccao_estab);
  await inserir(sb, "meta_phone_status", m.meta_phone_status);
  console.log("\n✔ gravado. Agora: npm run sim:verificar");
}

main().catch((err) => { console.error("\n✖", err instanceof Error ? err.message : err); process.exit(1); });
