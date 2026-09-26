// Motor de vendas: reproduz as transições da regra 1.2 (regras-de-negocio) e o copy do sales-agent
// para 12 roteiros. Cada turno grava evento, mensagem, outbox e tool calls como o webhook faria.
import type { Mundo, Conversa, Row } from "./mundo";
import type { Rng } from "./prng";
import * as C from "./copy";
import { iso, gapHumano, gapBot, momento, brt, splitData, dataBRT, HORA_MS, DIA_MS } from "./tempo";
import { nomePessoa, primeiroNome, nomeOficina, cidade as sorteiaCidade, foneOficina } from "./identidades";

export type Roteiro =
  | "direto" | "pergunta_tudo" | "roi" | "preco_handoff_manual" | "cetico" | "sem_interesse"
  | "esfriou" | "qualificou_sumiu" | "interessado" | "so_oi" | "loop" | "sem_nome";

export const PESO_ROTEIRO_CONVERTE: ReadonlyArray<readonly [Roteiro, number]> = [
  ["direto", 40], ["pergunta_tudo", 32], ["roi", 20], ["preco_handoff_manual", 8],
];
export const PESO_ROTEIRO_NAO_CONVERTE: ReadonlyArray<readonly [Roteiro, number]> = [
  ["cetico", 14], ["sem_interesse", 27], ["esfriou", 32], ["qualificou_sumiu", 14], ["interessado", 5], ["so_oi", 6], ["loop", 1], ["sem_nome", 1],
];

export type Faq = { id: string; pergunta: string; resposta: string; palavras_chave: string[] };
export type Anuncio = { ad_id: string; ad_name: string; headline: string; inicio: string; fim: string | null };
export type Rep = { id: string; codigo: string; nome: string };

export type PlanoLead = {
  deveConverter?: boolean;
  em: number; // primeira mensagem
  roteiro: Roteiro;
  canal: "ad" | "rep" | "organico";
  anuncio?: Anuncio;
  rep?: Rep;
  repVia?: "wa_prefill" | "site_link";
};

export type ResultadoLead = {
  lead: Row;
  conversa: Conversa;
  statusFinal: string;
  conversaoEm: number | null;
  conversaoManual: boolean;
  nomeOficina: string | null;
  responsavel: string;
  cidade: string;
  uf: string;
  volume: number | null;
  ticket: number | null;
  handoff: boolean;
  ultimoInbound: number;
};

type Memoria = {
  greeted?: boolean;
  funcionamento_explained?: boolean;
  price_mentions?: number;
  consecutive_fallback?: number;
  volume_known?: number;
  ticket_known?: number;
  pain_detected?: boolean;
  awaiting_workshop_name?: boolean;
  workshop_name?: string;
};

const FEATURE_FOLLOWUP = brt(2026, 7, 20, 10);
const TAXA_ROI = 0.15;

function brl(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

export function gerarLead(m: Mundo, plano: PlanoLead, faqs: Faq[], seqFone: number): ResultadoLead {
  const rng = m.rng;
  const responsavel = nomePessoa(rng);
  const { cidade, uf } = sorteiaCidade(rng);
  const whatsapp = foneOficina(seqFone);
  const nomeOf = nomeOficina(rng, responsavel);
  const nomePerfil = rng.weighted([[primeiroNome(responsavel), 45], [responsavel, 25], [nomeOf, 20], [`${primeiroNome(responsavel)} ${nomeOf.split(" ")[0]}`, 10]]);
  const leadId = rng.uuid();
  const memoria: Memoria = {};
  let status = "novo";
  let t = plano.em;
  let handoff = false;
  let handoffReason: string | null = null;
  let conversaoEm: number | null = null;
  let conversaoManual = false;
  let nomeCapturado: string | null = null;
  let volume: number | null = null;
  let ticket: number | null = null;
  let ultimoInbound = t;
  const volumeReal = Math.round(rng.normal(60, 35, 15, 260));
  const ticketReal = Math.round(rng.normal(230, 80, 90, 650) / 10) * 10;

  const c = m.conversa({ whatsapp, agent_mode: "vendas", participant_type: "lead_oficina", lead_id: leadId, em: t });

  const setStatus = (novo: string, em: number) => {
    if (novo === status) return;
    const anterior = status;
    status = novo;
    m.tool(c, { em, nome: "update_lead", input: { status: novo }, output: { applied: true, previousStatus: anterior, currentStatus: novo } });
  };

  const bot = (em: number, body: string, opts: { botoes?: C.Botao[]; intent?: string | null; userMessage?: string; gerado?: string | null; auditar?: boolean } = {}) => {
    const enviado = opts.gerado ?? body;
    m.outboundTexto(c, { em, body: enviado, botoes: opts.botoes });
    if (opts.auditar !== false && (opts.gerado !== undefined || rng.chance(0.35))) {
      m.geracao(c, { em: em - 800, agentMode: "vendas", intent: opts.intent ?? null, userMessage: opts.userMessage ?? "", deterministicReply: body, generated: opts.gerado ?? null });
    }
  };

  const prefixo = (body: string) => {
    if (memoria.greeted) return body;
    memoria.greeted = true;
    return `${C.GREETING_PREFIX}\n\n${body}`;
  };

  const inbound = (em: number, texto: string, extra: { botao?: C.Botao; referral?: Row | null } = {}) => {
    ultimoInbound = em;
    return m.inbound(c, { em, body: texto, nomePerfil, botao: extra.botao, referral: extra.referral ?? null });
  };

  // ── Primeira mensagem (define origem e atribuição) ──────────────────────
  const landing = plano.roteiro === "direto" ? rng.chance(0.75) : rng.chance(0.55);
  let primeira = landing ? rng.pick(C.FALAS_LEAD.landing) : plano.roteiro === "so_oi" || plano.roteiro === "loop" ? rng.pick(C.FALAS_LEAD.oi) : "";
  let repToken: string | null = null;
  if (plano.canal === "rep" && plano.rep) {
    const cod = plano.rep.codigo;
    repToken = plano.repVia === "site_link" ? `${rng.uuid().replace(/-/g, "").slice(0, 20)}` : null;
    primeira = `${primeira || rng.pick(C.FALAS_LEAD.landing)} #REP-${cod}${repToken ? `.${repToken}` : ""}`;
  }
  let referral: Row | null = null;
  if (plano.canal === "ad" && plano.anuncio) {
    referral = {
      source_url: `https://fb.me/${rng.digits(9)}`,
      source_id: plano.anuncio.ad_id,
      source_type: "ad",
      headline: plano.anuncio.headline,
      body: "Seu cliente trocou o óleo e sumiu? A gente faz ele voltar.",
      media_type: "image",
      ctwa_clid: `ARA${rng.uuid().replace(/-/g, "")}${rng.digits(6)}`,
    };
  }
  const origem = landing || plano.canal === "rep" ? "landing_page" : "manual_whatsapp";

  // ── Executa roteiro ────────────────────────────────────────────────────
  type Passo = { tipo: string; texto?: string };
  const passos: Passo[] = [];
  const R = plano.roteiro;
  const f = C.FALAS_LEAD;
  const pushOi = () => passos.push({ tipo: "oi" });
  if (R === "direto") {
    if (!landing && !primeira) passos.push({ tipo: "oi" });
    passos.push({ tipo: landing || primeira ? "quer_testar_primeira" : "quer_testar" }, { tipo: "nome" });
  } else if (R === "pergunta_tudo") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: rng.chance(0.3) ? "funcionamento_dor" : "funcionamento" });
    passos.push({ tipo: "faq" });
    if (rng.chance(0.5)) passos.push({ tipo: "faq" });
    passos.push({ tipo: "preco" }, { tipo: "quer_testar" }, { tipo: "nome" });
  } else if (R === "roi") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: rng.chance(0.4) ? "funcionamento_dor" : "funcionamento" });
    if (rng.chance(0.5)) passos.push({ tipo: "volume_ticket" });
    else passos.push({ tipo: "volume_so" }, { tipo: "ticket_so" });
    if (rng.chance(0.6)) passos.push({ tipo: "preco" });
    passos.push({ tipo: "quer_testar" }, { tipo: "nome" });
  } else if (R === "preco_handoff_manual") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" }, { tipo: "preco" }, { tipo: rng.chance(0.3) ? "rede" : "preco_insistente" });
  } else if (R === "cetico") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "preco" }, { tipo: "preco_insistente" }, { tipo: "sem_interesse" });
  } else if (R === "sem_interesse") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" });
    if (rng.chance(0.4)) passos.push({ tipo: "faq" });
    if (rng.chance(0.3)) passos.push({ tipo: "preco" });
    passos.push({ tipo: "sem_interesse" });
  } else if (R === "esfriou") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" });
    passos.push({ tipo: rng.weighted([["faq", 45], ["neutro", 35], ["small_talk", 10], ["preco", 10]]) });
    if (rng.chance(0.3)) passos.push({ tipo: "neutro" });
  } else if (R === "qualificou_sumiu") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" }, { tipo: "volume_ticket" }, { tipo: "vai_pensar" });
  } else if (R === "interessado") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" }, { tipo: "preco" }, { tipo: "vai_pensar" });
  } else if (R === "so_oi") {
    pushOi();
  } else if (R === "loop") {
    pushOi();
    for (let i = 0; i < 7; i += 1) passos.push({ tipo: "social" });
  } else if (R === "sem_nome") {
    if (primeira) passos.push({ tipo: "primeira_landing" });
    passos.push({ tipo: "funcionamento" }, { tipo: "quer_testar" });
  }

  let primeiraEnviada = false;
  let fallbackCount = 0;
  for (const passo of passos) {
    if (handoff && R !== "cetico") break;
    let texto = "";
    const ehPrimeira = !primeiraEnviada;
    const extra: { botao?: C.Botao; referral?: Row | null } = {};
    if (ehPrimeira && primeira && (passo.tipo === "primeira_landing" || passo.tipo === "quer_testar_primeira" || passo.tipo === "oi")) {
      texto = primeira;
    }
    switch (passo.tipo) {
      case "oi": texto = texto || rng.pick(f.oi); break;
      case "primeira_landing": break;
      case "funcionamento": texto = rng.pick(f.funcionamento); break;
      case "funcionamento_dor": texto = rng.pick(f.funcionamento_dor); break;
      case "faq": break;
      case "preco": texto = rng.pick(f.preco); break;
      case "preco_insistente": texto = rng.pick(f.preco_insistente); break;
      case "rede": texto = rng.pick(f.rede); break;
      case "volume_ticket": texto = rng.pick(f.volume_ticket(volumeReal, ticketReal)); break;
      case "volume_so": texto = rng.pick(f.volume_so(volumeReal)); break;
      case "ticket_so": texto = rng.pick(f.ticket_so(ticketReal)); break;
      case "quer_testar": case "quer_testar_primeira": texto = texto || rng.pick(f.quer_testar); break;
      case "nome": texto = rng.pick(f.nome_oficina_wrap(nomeOf)).replace("{cidade}", cidade); break;
      case "sem_interesse": texto = rng.pick(f.sem_interesse); break;
      case "vai_pensar": texto = rng.pick(f.vai_pensar); break;
      case "neutro": texto = rng.pick(f.neutro); break;
      case "social": texto = rng.pick(f.social); break;
      case "small_talk": texto = rng.pick(f.small_talk); break;
    }
    // Botões: quando o passo anterior ofereceu botões, parte dos leads toca em vez de digitar.
    if (!ehPrimeira && rng.chance(0.35)) {
      if (passo.tipo === "preco") extra.botao = { id: "sales_fb_preco", title: "Quanto custa" };
      if (passo.tipo === "quer_testar") extra.botao = { id: "sales_fb_testar", title: "Quero testar" };
      if (passo.tipo === "funcionamento") extra.botao = { id: "sales_fb_funcionamento", title: "Como funciona" };
      if (extra.botao) texto = extra.botao.title;
    }
    if (ehPrimeira) extra.referral = referral;

    if (!ehPrimeira) t += gapHumano(rng);
    if (plano.deveConverter) {
      const teto = m.ate - 30 * 60_000 - (passos.length - passos.indexOf(passo)) * 120_000;
      if (t > teto) t = teto;
    }
    if (t > m.ate - 60_000) break;
    const tIn = t;
    if (passo.tipo === "faq") {
      const chaves = Object.keys(f.faq) as Array<keyof typeof f.faq>;
      const chave = rng.pick(chaves);
      texto = rng.pick(f.faq[chave]);
    }
    inbound(tIn, texto, extra);
    primeiraEnviada = true;
    const tOut = tIn + gapBot(rng);
    t = tOut;
    const tipoEfetivo = passo.tipo === "quer_testar_primeira" || (passo.tipo === "primeira_landing")
      ? (passo.tipo === "primeira_landing" ? "landing" : "quer_testar")
      : passo.tipo;

    // Resposta do bot conforme intent (espelho de buildReply).
    if (tipoEfetivo === "landing") {
      // frase-gatilho da landing sem pedido explícito de teste: bot se apresenta e explica.
      memoria.funcionamento_explained = true;
      setStatus("em_conversa", tOut);
      const body = prefixo(C.EXPLICADOR_LONGO);
      bot(tOut, body, { botoes: C.BOTOES_EXPLICADOR, intent: "pergunta_funcionamento", userMessage: texto, gerado: rng.chance(0.6) ? C.explicadorGerado(rng) : null });
      continue;
    }
    if (tipoEfetivo === "oi") {
      if (!memoria.greeted) {
        memoria.funcionamento_explained = true;
        const body = prefixo(C.EXPLICADOR_LONGO);
        bot(tOut, body, { botoes: C.BOTOES_EXPLICADOR, intent: "fora_escopo", userMessage: texto, gerado: rng.chance(0.6) ? C.explicadorGerado(rng) : null });
      } else {
        bot(tOut, rng.pick(C.GREETING_AFTER_GREETED), { intent: "fora_escopo", userMessage: texto });
      }
      continue;
    }
    if (tipoEfetivo === "funcionamento" || tipoEfetivo === "funcionamento_dor") {
      const dor = tipoEfetivo === "funcionamento_dor";
      memoria.pain_detected = dor;
      const base = memoria.funcionamento_explained ? C.EXPLICADOR_CURTO : C.EXPLICADOR_LONGO;
      const body = prefixo(dor ? `Entendi chefe, cliente que some depois da troca e exatamente o que a gente resolve. ${base}` : base);
      memoria.funcionamento_explained = true;
      setStatus(status === "novo" ? "em_conversa" : status, tOut);
      bot(tOut, body, { botoes: C.BOTOES_EXPLICADOR, intent: "pergunta_funcionamento", userMessage: texto, gerado: rng.chance(0.5) ? C.explicadorGerado(rng) : null });
      continue;
    }
    if (tipoEfetivo === "faq") {
      const faq = escolherFaq(rng, faqs, texto);
      m.tool(c, { em: tOut - 500, nome: "faq_lookup", input: { faqId: faq.id, pergunta: faq.pergunta }, output: { resposta: faq.resposta } });
      bot(tOut, prefixo(faq.resposta), { intent: "pergunta_faq", userMessage: texto });
      continue;
    }
    if (tipoEfetivo === "preco") {
      memoria.price_mentions = (memoria.price_mentions ?? 0) + 1;
      if (memoria.price_mentions === 1) {
        const body = memoria.volume_known && memoria.ticket_known
          ? C.precoComRoi(brl(memoria.volume_known * memoria.ticket_known * TAXA_ROI))
          : C.PRECO_PRIMEIRA;
        bot(tOut, prefixo(body), { botoes: C.BOTOES_PRECO, intent: "pergunta_preco", userMessage: texto, gerado: rng.chance(0.55) && !memoria.volume_known ? C.precoGerado(rng) : null });
      } else {
        handoff = true; handoffReason = "preco_insistente";
        bot(tOut, prefixo(C.HANDOFF_COMERCIAL_BODY), { intent: "pergunta_preco", userMessage: texto, auditar: false });
        resumoHandoff(m, c, tOut, handoffReason, nomePerfil);
      }
      continue;
    }
    if (tipoEfetivo === "preco_insistente") {
      memoria.price_mentions = (memoria.price_mentions ?? 0) + 1;
      handoff = true; handoffReason = "preco_insistente";
      bot(tOut, prefixo(C.HANDOFF_COMERCIAL_BODY), { intent: "pergunta_preco", userMessage: texto, auditar: false });
      resumoHandoff(m, c, tOut, handoffReason, nomePerfil);
      continue;
    }
    if (tipoEfetivo === "rede") {
      handoff = true; handoffReason = "rede_ou_franquia";
      setStatus(status === "novo" ? "em_conversa" : status, tOut);
      bot(tOut, prefixo(C.HANDOFF_COMERCIAL_BODY), { intent: "fora_escopo", userMessage: texto, auditar: false });
      resumoHandoff(m, c, tOut, handoffReason, nomePerfil);
      continue;
    }
    if (tipoEfetivo === "volume_ticket" || tipoEfetivo === "volume_so" || tipoEfetivo === "ticket_so") {
      if (tipoEfetivo !== "ticket_so") memoria.volume_known = volumeReal;
      if (tipoEfetivo !== "volume_so") memoria.ticket_known = ticketReal;
      if (memoria.volume_known && memoria.ticket_known) {
        volume = memoria.volume_known; ticket = memoria.ticket_known;
        const rec = volume * ticket * TAXA_ROI;
        m.tool(c, { em: tOut - 400, nome: "calculate_roi", input: { monthlyChanges: volume, averageTicket: ticket, recoveryRate: TAXA_ROI }, output: { recoveredRevenue: rec } });
        setStatus("qualificado", tOut);
        bot(tOut, prefixo(C.roiBody(15, volume, brl(ticket), brl(rec))), { intent: "informa_volume_ticket", userMessage: texto });
      } else {
        setStatus(status === "novo" ? "em_conversa" : status, tOut);
        bot(tOut, prefixo(C.pedeComplemento(memoria.volume_known ? "ticket" : "volume")), { intent: "informa_volume_ticket", userMessage: texto });
      }
      continue;
    }
    if (tipoEfetivo === "quer_testar") {
      setStatus("teste_aceito", tOut);
      memoria.awaiting_workshop_name = true;
      bot(tOut, prefixo(C.PEDE_NOME_BODY), { intent: "quer_testar", userMessage: texto, gerado: rng.chance(0.6) ? C.pedeNomeGerado(rng) : null });
      continue;
    }
    if (tipoEfetivo === "nome") {
      nomeCapturado = nomeOf;
      memoria.awaiting_workshop_name = false;
      memoria.workshop_name = nomeOf;
      m.tool(c, { em: tOut - 700, nome: "capture_workshop_name", input: { message: texto }, output: { nome: nomeOf, persisted: true, nome_oficina: nomeOf, nome_responsavel: primeiroNome(responsavel) } });
      bot(tOut, C.cadastraEmTeste(nomeOf), { intent: "quer_testar", userMessage: texto, auditar: false });
      conversaoEm = tOut + 1200;
      continue;
    }
    if (tipoEfetivo === "sem_interesse") {
      setStatus("perdido", tOut);
      bot(tOut, prefixo(C.PERDIDO_BODY), { intent: "sem_interesse", userMessage: texto, auditar: false });
      continue;
    }
    if (tipoEfetivo === "vai_pensar") {
      bot(tOut, prefixo(C.VAI_PENSAR_BODY), { intent: "vai_pensar", userMessage: texto });
      continue;
    }
    if (tipoEfetivo === "neutro") {
      bot(tOut, prefixo(memoria.funcionamento_explained ? C.CONFIRMACAO_NEUTRA_BODY : C.EXPLICADOR_LONGO), { intent: "confirmacao_neutra", userMessage: texto });
      continue;
    }
    if (tipoEfetivo === "small_talk") {
      bot(tOut, prefixo(C.SMALL_TALK_BODY), { intent: "small_talk", userMessage: texto });
      continue;
    }
    if (tipoEfetivo === "social") {
      fallbackCount += 1;
      memoria.consecutive_fallback = fallbackCount;
      if (fallbackCount >= 7) {
        handoff = true; handoffReason = "fallback_loop";
        bot(tOut, prefixo(C.FALLBACK_LOOP_HANDOFF), { intent: "social_test", userMessage: texto, auditar: false });
        resumoHandoff(m, c, tOut, handoffReason, nomePerfil);
      } else if (fallbackCount === 2) {
        bot(tOut, prefixo(C.FALLBACK_VARIATIONS[1]), { botoes: C.BOTOES_FALLBACK, intent: "social_test", userMessage: texto, auditar: false });
      } else {
        bot(tOut, prefixo(C.SOCIAL_TEST_VARIATIONS[(fallbackCount - 1) % 5]), { intent: "social_test", userMessage: texto, auditar: false });
      }
      continue;
    }
  }

  // ── Conversão pelo bot ─────────────────────────────────────────────────
  if (conversaoEm && conversaoEm <= m.ate) {
    setStatus("convertido", conversaoEm);
  } else {
    conversaoEm = null;
  }

  // ── Conversão manual (handoff de preço → comercial fecha por telefone) ──
  if (R === "preco_handoff_manual" && !conversaoEm) {
    const quando = momento(rng, ultimoInbound + 6 * HORA_MS, ultimoInbound + 4 * DIA_MS, "admin");
    if (quando <= m.ate) {
      conversaoEm = quando;
      conversaoManual = true;
      nomeCapturado = nomeOf;
      status = "convertido";
    }
  }

  // ── Ações do admin em leads parados ────────────────────────────────────
  let interesseEm: number | null = null;
  let motivoPerda: string | null = null;
  if (R === "interessado") {
    const quando = momento(rng, ultimoInbound + 4 * HORA_MS, ultimoInbound + 3 * DIA_MS, "admin");
    if (quando <= m.ate) { interesseEm = quando; status = "interessado"; }
  }
  if (R === "sem_interesse" && rng.chance(0.15)) motivoPerda = rng.pick(["Sem interesse declarado", "Disse que não precisa", "Pediu pra tirar o número"]);
  if (status === "perdido" && !motivoPerda) motivoPerda = rng.pick(["Sem interesse declarado", "Achou caro", "Não vê valor agora", "Já usa outro sistema"]);
  if ((R === "esfriou" || R === "qualificou_sumiu") && m.ate - ultimoInbound > 35 * DIA_MS && rng.chance(0.22)) {
    const quando = momento(rng, ultimoInbound + 30 * DIA_MS, Math.min(m.ate, ultimoInbound + 60 * DIA_MS), "admin");
    if (quando <= m.ate) {
      motivoPerda = rng.pick(["Sem retorno após follow-ups", "Parou de responder", "Não respondeu aos 2 follow-ups"]);
      status = "perdido";
      m.auditoria({ em: quando, admin_id: ADMIN_ID.valor, acao: "lead.marcar_perdido", entidade: "leads", entidade_id: leadId, payload: { before: { status: R === "esfriou" ? "em_conversa" : "qualificado" }, after: { status: "perdido", motivo_perda: motivoPerda } }, ip: ADMIN_IP.valor });
    }
  }

  // ── Follow-ups proativos (CV4) ─────────────────────────────────────────
  let followupCount = 0;
  let lastFollowup: number | null = null;
  const elegivelFollowup = !handoff && (status === "em_conversa" || status === "qualificado" || ((R === "esfriou" || R === "qualificou_sumiu") && status === "perdido"));
  if (elegivelFollowup) {
    const janelas = [24, 72];
    for (let i = 0; i < 2; i += 1) {
      const minimo = ultimoInbound + janelas[i] * HORA_MS;
      let disparo = Math.max(minimo, FEATURE_FOLLOWUP);
      // cron roda 13:00 UTC (10:00 BRT): próximo disparo após `disparo`
      const dia = dataBRT(disparo);
      let cronMs = brt(...splitData(dia), 10, rng.int(0, 4), rng.int(0, 59));
      if (cronMs < disparo) cronMs += DIA_MS;
      if (cronMs > m.ate) break;
      if (status === "perdido" && cronMs > (m.audit.find((a) => a.entidade_id === leadId)?.created_at ? Date.parse(String(m.audit.find((a) => a.entidade_id === leadId)!.created_at)) : m.ate)) break;
      const template = i === 0 ? "followup_lead_24h" : "followup_lead_72h";
      m.outboundTemplate(c, { em: cronMs, template, params: { bodyParameters: [primeiroNome(nomePerfil)] }, body: `[follow-up ${i + 1}] template ${template}`, bodyMensagem: `Follow-up ${i + 1} enviado (${template}).` });
      followupCount += 1;
      lastFollowup = cronMs;
    }
  }

  c.handoff_required = handoff;
  c.handoff_reason = handoffReason;
  c.context = { sales: { ...memoria }, sim_run_id: m.runId };

  const lead: Row = {
    id: leadId,
    whatsapp,
    nome: nomePerfil,
    origem,
    status,
    metadata: { sim_run_id: m.runId, roteiro: R, canal: plano.canal },
    last_message_at: iso(ultimoInbound),
    created_at: iso(plano.em),
    updated_at: iso(Math.max(ultimoInbound, conversaoEm ?? 0, lastFollowup ?? 0, interesseEm ?? 0)),
    nome_responsavel: nomeCapturado || conversaoEm ? responsavel : (rng.chance(0.3) ? responsavel : null),
    nome_oficina: nomeCapturado ?? (conversaoManual ? nomeOf : null),
    cidade: conversaoEm || rng.chance(0.25) ? cidade : null,
    volume_trocas_mes: volume,
    ticket_medio: ticket,
    principal_dor: memoria.pain_detected ? rng.pick(["Cliente troca o óleo e some", "Não consegue lembrar o cliente de voltar", "Controle no caderno"]) : null,
    melhor_horario_contato: rng.chance(0.15) ? rng.pick(["manhã", "depois das 18h", "hora do almoço"]) : null,
    interesse_declarado_at: interesseEm ? iso(interesseEm) : null,
    motivo_perda: motivoPerda,
    oficina_id: null,
    converted_at: conversaoEm ? iso(conversaoEm) : null,
    representante_id: plano.rep?.id ?? null,
    followup_count: followupCount,
    last_followup_at: lastFollowup ? iso(lastFollowup) : null,
    ad_ctwa_clid: referral ? referral.ctwa_clid : null,
    ad_id: referral ? referral.source_id : null,
    ad_source_type: referral ? "ad" : null,
    ad_source_url: referral ? referral.source_url : null,
    ad_headline: referral ? referral.headline : null,
    ad_attributed_at: referral ? iso(plano.em) : null,
    representante_atribuido_em: plano.rep ? iso(plano.em) : null,
    representante_atribuido_via: plano.rep ? plano.repVia ?? "wa_prefill" : null,
    representante_click_token: repToken,
  };
  if (interesseEm) {
    m.auditoria({ em: interesseEm, admin_id: ADMIN_ID.valor, acao: "lead.change_status", entidade: "leads", entidade_id: leadId, payload: { before: { status: "em_conversa" }, after: { status: "interessado" }, motivo: "Ligou e demonstrou interesse; vai decidir com o sócio" }, ip: ADMIN_IP.valor });
  }

  return {
    lead, conversa: c, statusFinal: status, conversaoEm, conversaoManual, nomeOficina: nomeCapturado,
    responsavel, cidade, uf, volume: volume ?? (conversaoEm ? volumeReal : null), ticket: ticket ?? (conversaoEm ? ticketReal : null),
    handoff, ultimoInbound,
  };
}

/** Admin "atual" (setado pelo gerar.ts a partir de admin_users). */
export const ADMIN_ID = { valor: null as string | null };
export const ADMIN_IP = { valor: null as string | null };

function resumoHandoff(m: Mundo, c: Conversa, em: number, reason: string, nome: string) {
  const summary = m.rng.pick([
    `${nome} quer o valor fechado antes de testar; já perguntou preço 2x. Volume não informado.`,
    `${nome} tem oficina em ${m.rng.pick(["SP", "Guarulhos", "Campinas", "Curitiba"])}; insistiu no preço e pediu faixa. Sem números de volume.`,
    `${nome} pediu pra falar com humano; explicamos o produto e o teste de 14 dias. Interesse médio.`,
    `${nome} tem mais de uma unidade (rede/filial). Quer proposta pra todas.`,
  ]);
  m.tool(c, { em: em + 3000, nome: "handoff_summary", input: { handoffReason: reason, promptVersion: "hs-1" }, output: { summary, whatsappMessageId: m.wamid() } });
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escolherFaq(rng: Rng, faqs: Faq[], pergunta: string): Faq {
  const p = normalizar(pergunta);
  let melhor: Faq | null = null;
  let melhorN = 0;
  for (const faq of faqs) {
    const n = faq.palavras_chave.filter((k) => p.includes(normalizar(k))).length;
    if (n > melhorN) { melhorN = n; melhor = faq; }
  }
  return melhor ?? rng.pick(faqs);
}
