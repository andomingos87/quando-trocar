// Operação da oficina: cadastros pelo WhatsApp (card → confirmar → RPC), lembretes, respostas do
// cliente final, opt-out e "retorno" (segundo serviço do mesmo cliente depois do lembrete).
import type { Mundo, Conversa, Row } from "./mundo";
import { ativaEm, statusEm, type OficinaSim } from "./oficina";
import * as C from "./copy";
import { iso, dataBRT, somaDias, meiaNoiteUtc, momentoNoDia, momento, gapBot, ehDiaUtil, formatBR, brt, splitData, horaBRT, DIA_MS, HORA_MS } from "./tempo";
import { nomePessoa, primeiroNome, veiculo as sorteiaVeiculo, placa as sorteiaPlaca, foneCliente, foneEscrito } from "./identidades";

export type ItemCatalogo = { id: string; familia: string; produto_label: string; template_name: string; intervalo_dias: number };
export type Contexto = {
  catalogo: Map<string, ItemCatalogo>; // por familia
  produtos: Map<string, string>; // marca -> produto_id
  seqCliente: { n: number };
};

type ClienteSim = {
  id: string;
  nome: string;
  whatsapp: string;
  status: "ativo" | "opt_out" | "numero_errado";
  consentimento: boolean;
  createdAt: number;
  veiculos: Array<{ id: string; descricao: string }>;
  conversa: Conversa | null;
  optOutEm: number | null;
};

type Retorno = { data: string; cliente: ClienteSim; veiculoId: string; descricao: string; familia: string };

const FAMILIAS: ReadonlyArray<readonly [string, number]> = [["troca_oleo", 78], ["revisao", 12], ["amortecedor", 7], ["outro", 3]];
const MARCAS: ReadonlyArray<readonly [string, number]> = [["perfect", 45], ["cofap", 25], ["monroe", 15], ["nakata", 10], ["outra", 5]];

function valorServico(m: Mundo, familia: string, ticketOficina: number | null): number {
  const rng = m.rng;
  const base = ticketOficina ?? 220;
  const v = familia === "troca_oleo" ? rng.normal(base * 0.9, 45, 120, 420)
    : familia === "revisao" ? rng.normal(base * 2.4, 180, 350, 1400)
    : familia === "amortecedor" ? rng.normal(base * 3.6, 260, 600, 2200)
    : rng.normal(base * 1.4, 120, 150, 900);
  return Math.round(v / 10) * 10;
}

export function gerarOperacao(m: Mundo, o: OficinaSim, ctx: Contexto) {
  const rng = m.rng;
  const hoje = dataBRT(m.ate);
  const clientes: ClienteSim[] = [];
  const retornos = new Map<string, Retorno[]>();
  let primeiroCadastro = true;
  let greeted = false;
  let neutralTurn = 0;
  let cadastrosMes = new Map<string, number>();
  let ultimoMesConsulta = "";
  const conv = o.conversa;
  const responsavel = String(o.row.responsavel);
  const nomeOf = String(o.row.nome);
  const hIni = Number(String(o.row.horario_envio_inicio).slice(0, 2));
  const hFim = Number(String(o.row.horario_envio_fim).slice(0, 2));

  // Quantos cadastros por dia.
  const porDiaUtil = (o.volume * o.taxaCadastro) / 22;
  const limiteExpirado = o.destino === "teste_expirado" ? rng.int(3, 8) : Infinity;
  const limiteEmTeste = o.destino === "em_teste" ? rng.int(2, 12) : Infinity;
  let totalCadastros = 0;

  let d = o.conversaoData;
  while (d <= hoje) {
    // retornos agendados para este dia
    const doDia = retornos.get(d) ?? [];
    for (const r of doDia) {
      if (!ativaEm(o, d) || r.cliente.status !== "ativo") continue;
      registrar(d, r.cliente, r.veiculoId, r.descricao, r.familia, true);
    }
    if (ativaEm(o, d) && totalCadastros < limiteExpirado && totalCadastros < limiteEmTeste) {
      const dias = Math.round((meiaNoiteUtc(d) - meiaNoiteUtc(o.conversaoData)) / DIA_MS);
      if (o.destino === "teste_expirado" && dias > 12) { d = somaDias(d, 1); continue; }
      const dow = new Date(meiaNoiteUtc(d)).getUTCDay();
      let esperado = dow === 0 ? 0 : dow === 6 ? porDiaUtil * 0.35 : porDiaUtil;
      if (dias <= 3) esperado *= 1.6; else if (dias <= 20) esperado *= 1.15;
      if (o.destino === "teste_expirado") esperado = Math.max(esperado, 0.6);
      let n = 0;
      // Poisson simples
      let p = Math.exp(-esperado), s = p, u = rng.next();
      while (u > s && n < 9) { n += 1; p *= esperado / n; s += p; }
      for (let i = 0; i < n; i += 1) {
        if (totalCadastros >= limiteExpirado || totalCadastros >= limiteEmTeste) break;
        // cliente novo ou recorrente (que voltou sem lembrete)
        const recorrente = clientes.length > 20 && rng.chance(0.06);
        const cli = recorrente ? rng.pick(clientes) : novoCliente(d);
        if (cli.status !== "ativo") continue;
        const veic = recorrente && cli.veiculos.length ? rng.pick(cli.veiculos) : { id: rng.uuid(), descricao: sorteiaVeiculo(rng) };
        if (!recorrente || !cli.veiculos.some((v) => v.id === veic.id)) {
          cli.veiculos.push(veic);
          m.veiculos.push({ id: veic.id, oficina_id: o.id, cliente_id: cli.id, descricao: veic.descricao, placa: sorteiaPlaca(rng), created_at: iso(momentoNoDia(rng, d, 8, 19)), updated_at: iso(momentoNoDia(rng, d, 8, 19)) });
        }
        registrar(d, cli, veic.id, veic.descricao, rng.weighted(FAMILIAS), false);
      }
      // mensagens avulsas da oficina (saudação, consulta, ajuda) ~ 1-2 por mês
      const mes = d.slice(0, 7);
      if (ultimoMesConsulta !== mes && rng.chance(0.08) && dias > 2) {
        ultimoMesConsulta = mes;
        mensagemAvulsa(d);
      }
    }
    d = somaDias(d, 1);
  }

  // Estado final dos clientes
  for (const cli of clientes) {
    m.clientes.push({
      id: cli.id,
      oficina_id: o.id,
      nome: cli.nome,
      whatsapp: cli.whatsapp,
      consentimento_whatsapp: cli.consentimento,
      origem_consentimento: cli.consentimento ? "oficina_informou_cliente" : null,
      data_consentimento: cli.consentimento ? iso(cli.createdAt) : null,
      opt_out_at: cli.status === "opt_out" ? iso(cli.optOutEm!) : null,
      status: cli.status,
      created_at: iso(cli.createdAt),
      updated_at: iso(cli.optOutEm ?? cli.createdAt),
    });
  }

  function novoCliente(data: string): ClienteSim {
    ctx.seqCliente.n += 1;
    const cli: ClienteSim = {
      id: rng.uuid(),
      nome: nomePessoa(rng, rng.chance(0.6) ? "m" : "f"),
      whatsapp: foneCliente(ctx.seqCliente.n),
      status: "ativo",
      consentimento: rng.chance(0.92),
      createdAt: momentoNoDia(rng, data, 8, 19),
      veiculos: [],
      conversa: null,
      optOutEm: null,
    };
    clientes.push(cli);
    return cli;
  }

  function conversaCliente(cli: ClienteSim, em: number): Conversa {
    if (cli.conversa) return cli.conversa;
    cli.conversa = m.conversa({ whatsapp: cli.whatsapp, agent_mode: "cliente_final_lembrete", participant_type: "cliente_final", oficina_id: o.id, cliente_id: cli.id, em });
    cli.conversa.context = { sim_run_id: m.runId };
    return cli.conversa;
  }

  function registrar(data: string, cli: ClienteSim, veiculoId: string, descricaoVeiculo: string, familia: string, ehRetorno: boolean) {
    totalCadastros += 1;
    const item = ctx.catalogo.get(familia)!;
    let tIn = momentoNoDia(rng, data, 8, 19);
    if (tIn > m.ate) tIn = m.ate - rng.int(10, 120) * 60_000;
    if (tIn < o.conversaoEm + 5 * 60_000) tIn = o.conversaoEm + rng.int(5, 240) * 60_000;
    const modo = primeiroCadastro ? "onboarding" : "operacao";
    const dataServico = rng.chance(0.85) ? data : somaDias(data, -1);
    const servicoNome = rng.pick(C.NOMES_SERVICO[familia]);
    const marca = familia === "amortecedor" ? rng.weighted(MARCAS) : null;
    const servicoTexto = servicoNome.replace("{marca}", marca ? C.MARCA_LABEL[marca] : "");
    const foneTxt = foneEscrito(rng, cli.whatsapp);
    const draft = { nome_cliente: cli.nome, whatsapp_cliente: cli.whatsapp, veiculo: descricaoVeiculo, servico: servicoTexto, data_servico: dataServico, marca_peca: marca, valor: null as number | null, consentimento_whatsapp: cli.consentimento, tipo_servico: familia };
    const valor = valorServico(m, familia, o.row.ticket_medio as number | null);
    const audio = o.usaAudio && rng.chance(0.6);
    const template = audio ? rng.pick(C.FALAS_LEAD.cadastro_audio) : rng.pick(C.FALAS_LEAD.cadastro_formatos);
    let texto = template
      .replace("{nome}", cli.nome).replace("{nomeP}", primeiroNome(cli.nome)).replace("{carro}", descricaoVeiculo)
      .replace(/\{servico\}/g, servicoTexto).replace("{fone}", foneTxt).replace("{data}", dataServico === data ? "hoje" : "ontem");
    if (ehRetorno) texto = rng.pick([`${cli.nome} voltou hoje, ${descricaoVeiculo}, ${servicoTexto}, ${foneTxt}`, `${primeiroNome(cli.nome)} voltou: ${servicoTexto} no ${descricaoVeiculo}, ${foneTxt}`, texto]);
    if (!cli.consentimento && rng.chance(0.7)) texto += rng.pick([" (sem autorização de whatsapp)", " - ele não quer mensagem", ", nao autorizou zap"]);

    let t = tIn;
    m.inbound(conv, { em: t, body: texto, nomePerfil: responsavel, media: audio ? "audio" : undefined });
    t += gapBot(rng);

    // Campo faltando (8%): bot pergunta, oficina responde.
    if (rng.chance(0.08)) {
      const campo = rng.pick(["whatsapp_cliente", "veiculo", "servico"]);
      m.outboundTexto(conv, { em: t, body: C.PERGUNTA_CAMPO[campo] });
      t += rng.int(30, 400) * 1000;
      const resposta = campo === "whatsapp_cliente" ? foneTxt : campo === "veiculo" ? descricaoVeiculo : servicoTexto;
      m.inbound(conv, { em: t, body: resposta, nomePerfil: responsavel });
      t += gapBot(rng);
    }
    // Card de confirmação
    let card = C.cardConfirmacao(draft);
    m.tool(conv, { em: t - 300, nome: "solicitou_confirmacao_cadastro", input: { draft, source_media_type: audio ? "audio" : "text" }, output: { awaiting_confirmation: true } });
    m.outboundTexto(conv, { em: t, body: card, botoes: C.BOTOES_CONFIRMAR });
    // Correção (6%)
    if (rng.chance(0.06)) {
      t += rng.int(20, 200) * 1000;
      m.inbound(conv, { em: t, body: "Corrigir", nomePerfil: responsavel, botao: C.BOTOES_CONFIRMAR[1] });
      t += gapBot(rng);
      m.outboundTexto(conv, { em: t, body: C.CORRIGIR_BODY });
      t += rng.int(15, 120) * 1000;
      const novoVeic = sorteiaVeiculo(rng);
      m.inbound(conv, { em: t, body: `o carro é ${novoVeic}`, nomePerfil: responsavel });
      draft.veiculo = novoVeic; descricaoVeiculo = novoVeic;
      const v = m.veiculos.find((x) => x.id === veiculoId); if (v) v.descricao = novoVeic;
      const vc = cli.veiculos.find((x) => x.id === veiculoId); if (vc) vc.descricao = novoVeic;
      t += gapBot(rng);
      card = C.cardConfirmacao(draft, ["veiculo"]);
      m.tool(conv, { em: t - 300, nome: "solicitou_confirmacao_cadastro", input: { draft, changed_fields: ["veiculo"] }, output: { awaiting_confirmation: true } });
      m.outboundTexto(conv, { em: t, body: card, botoes: C.BOTOES_CONFIRMAR });
    }
    t += rng.int(15, 300) * 1000;
    const usaBotao = rng.chance(0.7);
    m.inbound(conv, { em: t, body: usaBotao ? "Confirmar" : rng.pick(["sim", "confirmar", "isso", "pode registrar", "ok confirma"]), nomePerfil: responsavel, botao: usaBotao ? C.BOTOES_CONFIRMAR[0] : undefined });
    t += gapBot(rng);
    m.tool(conv, { em: t - 900, nome: "confirmou_cadastro", input: { message: usaBotao ? "confirmar" : "sim" }, output: { draft } });

    // RPC register_service_with_reminder
    const servicoId = rng.uuid();
    const lembreteId = cli.consentimento ? rng.uuid() : null;
    const scheduledData = somaDias(dataServico, item.intervalo_dias);
    const scheduledAt = meiaNoiteUtc(scheduledData);
    m.servicos.push({
      id: servicoId, oficina_id: o.id, cliente_id: cli.id, veiculo_id: veiculoId,
      tipo: servicoTexto, descricao: servicoTexto, data_servico: dataServico, valor,
      created_at: iso(t), tipo_servico: familia, marca_peca: marca,
      catalogo_id: item.id, produto_id: marca && marca !== "outra" ? ctx.produtos.get(marca) ?? null : null,
    });
    m.tool(conv, { em: t - 600, nome: "register_service_with_reminder", cliente_id: cli.id, input: { oficinaId: o.id, nomeCliente: cli.nome, whatsappCliente: cli.whatsapp, veiculo: descricaoVeiculo, servico: servicoTexto, dataServico, valor: null, consentimentoWhatsapp: cli.consentimento, tipoServico: familia, marcaPeca: marca }, output: { clienteId: cli.id, veiculoId, servicoId, lembreteId, scheduledAt: lembreteId ? iso(scheduledAt) : null, diasLembrete: lembreteId ? item.intervalo_dias : null, catalogoId: item.id } });

    // Confirmação ao cliente final (template)
    let avisou = false;
    if (cli.consentimento) {
      const cc = conversaCliente(cli, t);
      const produto = item.produto_label;
      m.outboundTemplate(cc, { em: t + 1500, template: "confirmacao_servico", params: [cli.nome, produto, descricaoVeiculo, nomeOf], body: C.corpoConfirmacaoServico(cli.nome, produto, descricaoVeiculo, nomeOf) });
      m.tool(conv, { em: t - 200, nome: "notify_cliente_confirmacao", cliente_id: cli.id, input: { whatsapp: cli.whatsapp, template: "confirmacao_servico" }, output: { sent: true, whatsappMessageId: m.wamid() } });
      avisou = true;
    }
    // Ack à oficina
    const ack = cli.consentimento ? C.ackCadastro(cli.nome, formatBR(scheduledData), avisou) : C.ackSemConsentimento(cli.nome);
    const gerado = cli.consentimento && rng.chance(0.6) ? C.ackGerado(rng, cli.nome, formatBR(scheduledData), avisou) : null;
    m.outboundTexto(conv, { em: t + 2500, body: gerado ?? ack });
    if (gerado || rng.chance(0.3)) m.geracao(conv, { em: t + 1800, agentMode: modo, intent: null, userMessage: usaBotao ? "confirmar" : "sim", deterministicReply: ack, generated: gerado });
    if (primeiroCadastro) { primeiroCadastro = false; m.mudarModo(conv, "operacao", "oficina_cliente", t + 3000); }
    if (rng.chance(0.22)) {
      const t2 = t + rng.int(20, 600) * 1000;
      m.inbound(conv, { em: t2, body: rng.pick(C.FALAS_LEAD.oficina_agradece), nomePerfil: responsavel });
      m.outboundTexto(conv, { em: t2 + gapBot(rng), body: C.AGRADECIMENTO_RESPOSTAS[neutralTurn++ % 3] });
    }
    cadastrosMes.set(data.slice(0, 7), (cadastrosMes.get(data.slice(0, 7)) ?? 0) + 1);

    if (lembreteId) criarLembrete(lembreteId, cli, veiculoId, descricaoVeiculo, servicoId, familia, scheduledData, t);
  }

  function criarLembrete(id: string, cli: ClienteSim, veiculoId: string, descricaoVeiculo: string, servicoId: string, familia: string, scheduledData: string, criadoEm: number) {
    const scheduledAt = meiaNoiteUtc(scheduledData);
    const row: Row = {
      id, oficina_id: o.id, cliente_id: cli.id, veiculo_id: veiculoId, servico_id: servicoId,
      scheduled_at: iso(scheduledAt), sent_at: null, status: "pendente", whatsapp_message_id: null,
      attempts: 0, last_error: null, created_at: iso(criadoEm), updated_at: iso(criadoEm),
      last_attempt_at: null, provider_status: null, provider_error_code: null,
    };
    m.lembretes.push(row);
    if (scheduledData > hoje) return; // futuro: fica pendente

    const st = statusEm(o, scheduledData);
    const marcar = (status: string, em: number, extra: Row = {}) => { row.status = status; row.updated_at = iso(em); Object.assign(row, extra); };

    if (st === "cancelada") { marcar("cancelado", momentoNoDia(rng, scheduledData, 8, 9), { last_error: "oficina cancelada antes do envio" }); return; }
    if (cli.status !== "ativo") { marcar("cancelado", momentoNoDia(rng, scheduledData, 8, 9)); return; }
    // pausada na data: se reativou depois, sai no dia da reativação; senão cancela (guardrail: nada pendente no passado)
    let dataEnvio = scheduledData;
    if (st === "pausada") {
      if (o.pausaInadAte && o.pausaInadAte > scheduledData && o.pausaInadAte <= hoje) dataEnvio = o.pausaInadAte;
      else { marcar("cancelado", momentoNoDia(rng, scheduledData, 8, 9), { last_error: "oficina pausada (inadimplência) — cancelado na simulação" }); return; }
    }
    const template = C.TEMPLATE_POR_TIPO[familia];
    const corpo = C.corpoLembrete(familia, cli.nome, nomeOf, descricaoVeiculo);
    const cc = conversaCliente(cli, meiaNoiteUtc(dataEnvio));
    // Horário: primeira rodada do enqueue dentro da janela (80%) ou espalhado.
    const [y, mo, dd] = splitData(dataEnvio);
    let enviadoEm = rng.chance(0.8) ? brt(y, mo, dd, hIni, rng.int(0, 22), rng.int(0, 59)) : momentoNoDia(rng, dataEnvio, hIni, hFim);

    if (dataEnvio === hoje) {
      if (enviadoEm > m.ate) { return; } // ainda vai sair hoje: continua pendente (scheduled_at é ontem 21h BRT... aceito)
      if (rng.chance(0.45)) {
        marcar("enfileirado", enviadoEm, { last_attempt_at: iso(enviadoEm), attempts: 0 });
        m.outboundTemplate(cc, { em: enviadoEm, template, params: [cli.nome, nomeOf, descricaoVeiculo], body: corpo, lembrete_id: id, status: "pending" });
        return;
      }
    }
    if (enviadoEm > m.ate) enviadoEm = m.ate - rng.int(5, 40) * 60_000;

    // erro de envio (3%)
    if (rng.chance(0.03)) {
      const erro = rng.weighted([[{ code: "131026", message: "Message Undeliverable." }, 60], [{ code: "131047", message: "Re-engagement message" }, 25], [{ code: "131053", message: "Media upload error" }, 15]] as const);
      marcar("erro_envio", enviadoEm + 26 * HORA_MS, { attempts: 4, last_error: `${erro.code}: ${erro.message}`, provider_error_code: erro.code, last_attempt_at: iso(enviadoEm + 26 * HORA_MS), provider_status: "failed" });
      m.outboundTemplate(cc, { em: enviadoEm, template, params: [cli.nome, nomeOf, descricaoVeiculo], body: corpo, lembrete_id: id, status: "failed", erro: { code: erro.code, message: erro.message }, attempts: 4 });
      return;
    }

    const wamid = m.outboundTemplate(cc, { em: enviadoEm, template, params: [cli.nome, nomeOf, descricaoVeiculo], body: corpo, lembrete_id: id });
    marcar("enviado", enviadoEm, { sent_at: iso(enviadoEm), whatsapp_message_id: wamid, attempts: 1, last_attempt_at: iso(enviadoEm), provider_status: rng.weighted([["sent", 10], ["delivered", 55], ["read", 35]]) });

    // Resposta do cliente
    const intent = rng.weighted<C.IntentCliente | null>([
      [null, 62], ["ja_fez_servico", 9], ["quer_agendar", 10], ["quer_reagendar", 2], ["pergunta_preco", 3], ["pergunta_horario", 1],
      ["mensagem_indefinida", 3], ["nao_tem_interesse", 5], ["opt_out", 3], ["numero_errado", 2],
    ]);
    let respondeuEm: number | null = null;
    if (intent) {
      respondeuEm = enviadoEm + rng.weighted([[rng.int(2, 30) * 60_000, 40], [rng.int(30, 300) * 60_000, 35], [rng.int(5, 30) * HORA_MS, 20], [rng.int(30, 60) * HORA_MS, 5]]);
      if (respondeuEm > m.ate) respondeuEm = null;
    }
    if (intent && respondeuEm) {
      m.inbound(cc, { em: respondeuEm, body: rng.pick(C.FALAS_CLIENTE[intent]), nomePerfil: primeiroNome(cli.nome), contexto: wamid });
      const tb = respondeuEm + gapBot(rng);
      m.outboundTexto(cc, { em: tb, body: C.RESPOSTA_BOT_CLIENTE[intent] });
      const reason = C.HANDOFF_REASON_CLIENTE[intent];
      if (reason) {
        cc.handoff_required = true; cc.handoff_reason = reason;
        const linkOf = `https://wa.me/${String(o.row.whatsapp_principal).replace("+", "")}`;
        const linkCli = `https://wa.me/${cli.whatsapp.replace("+", "")}`;
        m.outboundTexto(cc, { em: tb + 2000, body: `Se preferir, fala direto com a ${nomeOf} 👉 ${linkOf}` });
        m.outboundTexto(conv, { em: tb + 3500, body: `${cli.nome} (${descricaoVeiculo}) respondeu o lembrete${intent === "quer_agendar" || intent === "quer_reagendar" ? " e quer agendar" : intent === "pergunta_preco" ? " perguntando valores" : intent === "pergunta_horario" ? " perguntando horário" : ""}. Fala com ele por aqui: ${linkCli}` });
        cc.context = { ...cc.context, lastReminderId: id };
      }
      if (intent === "ja_fez_servico") marcar("respondido", tb);
      if (intent === "nao_tem_interesse") marcar("sem_resposta", tb);
      if (intent === "opt_out" || intent === "numero_errado") {
        cli.status = intent; cli.optOutEm = tb;
        marcar("cancelado", tb);
        for (const l of m.lembretes) if (l.cliente_id === cli.id && l.status === "pendente") { l.status = "cancelado"; l.updated_at = iso(tb); }
        m.tool(cc, { em: tb - 500, nome: "cliente_final_concierge", cliente_id: cli.id, input: { intent, message: "…" }, output: { clienteStatus: intent, shouldCancelFutureReminders: true } });
      }
    }
    // Retorno: segundo serviço do mesmo cliente 10–40 dias depois
    const pRetorno = intent === "quer_agendar" || intent === "quer_reagendar" ? 0.55 : intent === "pergunta_preco" || intent === "pergunta_horario" ? 0.35 : intent === null ? 0.17 : intent === "mensagem_indefinida" ? 0.15 : 0;
    if (pRetorno > 0 && rng.chance(pRetorno)) {
      const dataRet = somaDias(dataEnvio, rng.int(intent ? 2 : 10, intent ? 20 : 40));
      if (dataRet <= hoje) {
        const lista = retornos.get(dataRet) ?? [];
        lista.push({ data: dataRet, cliente: cli, veiculoId, descricao: descricaoVeiculo, familia: rng.chance(0.85) ? familia : rng.weighted(FAMILIAS) });
        retornos.set(dataRet, lista);
      }
    }
  }

  function mensagemAvulsa(data: string) {
    let t = momentoNoDia(rng, data, 8, 19);
    if (t > m.ate) return;
    const tipo = rng.weighted([["saudacao", 45], ["consulta_mes", 25], ["proximos", 15], ["ajuda", 15]]);
    if (tipo === "saudacao") {
      m.inbound(conv, { em: t, body: rng.pick(C.FALAS_LEAD.oficina_saudacao), nomePerfil: responsavel });
      const s = C.saudacaoTemporal(horaBRT(t));
      const body = greeted ? C.SAUDACAO_SUBSEQUENTE[neutralTurn++ % 3](s) : C.SAUDACAO_INICIAL[neutralTurn++ % 3](s);
      greeted = true;
      m.outboundTexto(conv, { em: t + gapBot(rng), body });
      return;
    }
    if (tipo === "ajuda") {
      m.inbound(conv, { em: t, body: rng.pick(C.FALAS_LEAD.oficina_ajuda), nomePerfil: responsavel });
      m.outboundTexto(conv, { em: t + gapBot(rng), body: C.AJUDA_BODY });
      return;
    }
    if (tipo === "consulta_mes") {
      const n = m.lembretes.filter((l) => l.oficina_id === o.id && l.sent_at && String(l.sent_at).slice(0, 7) === data.slice(0, 7) && String(l.sent_at) <= iso(t)).length;
      m.inbound(conv, { em: t, body: rng.pick(C.FALAS_LEAD.oficina_consulta_mes), nomePerfil: responsavel });
      m.tool(conv, { em: t + 900, nome: "operacao_read_only_query", input: { query: "lembretes_mes" }, output: { count: n } });
      m.outboundTexto(conv, { em: t + gapBot(rng), body: C.lembretesMes(n) });
      return;
    }
    const prox = m.lembretes.filter((l) => l.oficina_id === o.id && l.status === "pendente" && String(l.scheduled_at) > iso(t) && String(l.scheduled_at) <= iso(t + 7 * DIA_MS)).slice(0, 8);
    const linhas = prox.map((l) => {
      const cli = clientes.find((c) => c.id === l.cliente_id)!;
      const v = cli.veiculos.find((x) => x.id === l.veiculo_id);
      const dt = String(l.scheduled_at).slice(0, 10);
      return `• ${cli.nome} (${v?.descricao ?? "carro"}) — ${dt.slice(8, 10)}/${dt.slice(5, 7)}`;
    });
    m.inbound(conv, { em: t, body: rng.pick(C.FALAS_LEAD.oficina_consulta_proximos), nomePerfil: responsavel });
    m.tool(conv, { em: t + 900, nome: "operacao_read_only_query", input: { query: "proximos_lembretes", days: 7 }, output: { count: prox.length } });
    m.outboundTexto(conv, { em: t + gapBot(rng), body: C.proximosLembretes(linhas, 7) });
  }
}
