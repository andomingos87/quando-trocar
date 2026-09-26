// Ciclo de vida da oficina: conversão → teste de 14 dias → pago (ciclos mensais, inadimplência,
// pausa, cancelamento) ou teste expirado. Espelha gerarCobrancaProxima + processPaymentWebhook.
import type { Mundo, Conversa, Row } from "./mundo";
import { ADMIN_ID, ADMIN_IP, type ResultadoLead } from "./vendas";
import { iso, dataBRT, somaDias, somaUmMes, meiaNoiteUtc, momentoNoDia, momento, brt, splitData, diffDias, DIA_MS, HORA_MS, formatBR, ehDiaUtil } from "./tempo";
import { cnpj, cpf, endereco, emailOficina } from "./identidades";
import * as C from "./copy";

export type Destino = "ativa" | "inad_hoje" | "inad_regularizada" | "vol_pausada" | "cancelada" | "teste_expirado" | "em_teste";

export type Periodo = { de: string; ate: string | null; status: "ativa" | "pausada" | "cancelada" };

export type OficinaSim = {
  id: string;
  row: Row;
  conversa: Conversa;
  lead: ResultadoLead;
  destino: Destino;
  conversaoData: string;
  conversaoEm: number;
  fimTeste: string;
  periodos: Periodo[]; // status ao longo do tempo (para lembretes e cadastros)
  pagamentos: Row[];
  precoEfetivo: number;
  repId: string | null;
  cidade: string;
  uf: string;
  volume: number;
  taxaCadastro: number;
  usaAudio: boolean;
  pausaInadDe: string | null;
  pausaInadAte: string | null; // null = ainda pausada
};

const GRACE_DIAS = 7;

/** Nunca deixa um instante passar de "agora". */
function ateAgora(m: Mundo, ms: number): number {
  return ms > m.ate ? m.ate - m.rng.int(3, 90) * 60_000 : ms;
}
const BILLING_START = "2026-05-18"; // painel admin + cobrança em produção

export function statusEm(o: OficinaSim, data: string): Periodo["status"] {
  let atual: Periodo["status"] = "ativa";
  for (const p of o.periodos) {
    if (p.de <= data && (p.ate === null || data < p.ate)) return p.status;
    if (p.de <= data) atual = p.status;
  }
  return atual;
}

export function ativaEm(o: OficinaSim, data: string): boolean {
  return statusEm(o, data) === "ativa";
}

export function criarOficina(m: Mundo, lead: ResultadoLead, destino: Destino, planoId: string, seqRep: string | null): OficinaSim {
  const rng = m.rng;
  const id = rng.uuid();
  const conversaoEm = lead.conversaoEm!;
  const conversaoData = dataBRT(conversaoEm);
  const fimTeste = somaDias(conversaoData, 14);
  const nome = lead.nomeOficina ?? "Oficina sem nome";
  const preco = rng.weighted([[59, 80], [49, 15], [39, 5]]);
  const pagante = destino !== "teste_expirado" && destino !== "em_teste";
  const end = endereco(rng);
  const usaCnpj = rng.chance(0.75);

  const row: Row = {
    id,
    nome,
    responsavel: lead.responsavel,
    whatsapp_principal: lead.lead.whatsapp,
    cidade: lead.cidade,
    ticket_medio: lead.ticket,
    volume_trocas_mes: lead.volume,
    status: "ativa",
    plano: "teste",
    origem: lead.conversaoManual ? "manual" : "landing_whatsapp",
    timezone: "America/Sao_Paulo",
    dias_lembrete_padrao: 90,
    horario_envio_inicio: rng.weighted([["08:00:00", 70], ["09:00:00", 20], ["07:30:00", 10]]),
    horario_envio_fim: rng.weighted([["18:00:00", 70], ["19:00:00", 20], ["17:30:00", 10]]),
    mensagem_lembrete_padrao: null,
    created_at: iso(conversaoEm),
    updated_at: iso(conversaoEm),
    motivo_pausa: null,
    proximo_vencimento: null,
    plano_id: planoId,
    preco_negociado: preco === 59 ? null : preco,
    representante_id: lead.lead.representante_id ?? seqRep,
    cpf_cnpj: pagante ? (usaCnpj ? cnpj(rng) : cpf(rng)) : rng.chance(0.2) ? cnpj(rng) : null,
    asaas_customer_id: null,
    email: pagante || rng.chance(0.4) ? emailOficina(rng, nome) : null,
    cep: pagante || rng.chance(0.5) ? end.cep : null,
    estado: lead.uf,
    bairro: pagante || rng.chance(0.5) ? end.bairro : null,
    logradouro: pagante || rng.chance(0.5) ? end.logradouro : null,
    numero: pagante || rng.chance(0.5) ? end.numero : null,
    complemento: rng.chance(0.15) ? rng.pick(["Fundos", "Galpão 2", "Box 4", "Loja A"]) : null,
    observacao: null,
  };
  if (row.cpf_cnpj) row.asaas_customer_id = `cus_${rng.digits(12)}`;

  const o: OficinaSim = {
    id, row, conversa: lead.conversa, lead, destino, conversaoData, conversaoEm, fimTeste,
    periodos: [{ de: conversaoData, ate: null, status: "ativa" }],
    pagamentos: [], precoEfetivo: preco, repId: (row.representante_id as string | null | undefined) ?? null,
    cidade: lead.cidade, uf: lead.uf,
    volume: lead.volume ?? Math.round(rng.normal(60, 30, 20, 200)),
    taxaCadastro: rng.float(0.25, 0.45),
    usaAudio: rng.chance(0.1),
    pausaInadDe: null, pausaInadAte: null,
  };

  // Conversa migra para onboarding (bot ou RPC manual) e recebe a boas-vindas.
  m.mudarModo(o.conversa, "onboarding", "oficina_cliente", conversaoEm);
  o.conversa.oficina_id = id;
  m.tool(o.conversa, { em: conversaoEm - 500, nome: "convert_lead_to_oficina", input: { whatsapp: lead.lead.whatsapp, responsavel: lead.lead.nome }, output: { id, nome, plano: "teste", status: "ativa", origem: row.origem } });
  if (lead.conversaoManual) {
    m.auditoria({ em: conversaoEm, admin_id: ADMIN_ID.valor, acao: "lead.convert_manual", entidade: "leads", entidade_id: String(lead.lead.id), payload: { oficina_id: id, plano_id: planoId, preco_negociado: row.preco_negociado, status: "ativa", dias_lembrete: 90 }, ip: ADMIN_IP.valor });
  } else {
    const intro = C.introOnboarding(nome);
    m.outboundTexto(o.conversa, { em: conversaoEm + 1500, body: rng.chance(0.55) ? C.introGerada(rng, nome) : intro });
    if (rng.chance(0.55)) m.geracao(o.conversa, { em: conversaoEm + 900, agentMode: "vendas", intent: null, userMessage: nome, deterministicReply: intro, generated: C.introGerada(rng, nome) });
  }

  aplicarCicloDeVida(m, o);
  return o;
}

function aplicarCicloDeVida(m: Mundo, o: OficinaSim) {
  const rng = m.rng;
  const hoje = dataBRT(m.ate);
  const admin = ADMIN_ID.valor;

  if (o.destino === "em_teste") return;

  if (o.destino === "teste_expirado") {
    let quando = somaDias(o.fimTeste, rng.int(0, 5));
    if (quando > hoje) quando = hoje;
    const em = ateAgora(m, momentoNoDia(rng, quando, 9, 18));
    o.row.status = "cancelada";
    o.row.observacao = "Teste de 14 dias expirou sem conversão (simulação).";
    o.row.updated_at = iso(em);
    o.periodos[0].ate = quando;
    o.periodos.push({ de: quando, ate: null, status: "cancelada" });
    m.auditoria({ em, admin_id: admin, acao: "oficina.update_status", entidade: "oficinas", entidade_id: o.id, payload: { before: { status: "ativa", motivo_pausa: null }, after: { status: "cancelada", motivo_pausa: null }, motivo: "teste expirado sem pagamento" }, ip: ADMIN_IP.valor });
    return;
  }

  // ── Ativação do plano pago (3 dias antes do fim do teste, em dia útil) ──
  let ativacaoData = somaDias(o.fimTeste, -3);
  if (ativacaoData < BILLING_START) ativacaoData = BILLING_START;
  const ativacaoEm = ateAgora(m, momentoNoDia(rng, ativacaoData, 9, 17));
  o.row.plano = "pago";
  m.auditoria({ em: ativacaoEm, admin_id: admin, acao: "oficina.update_plano", entidade: "oficinas", entidade_id: o.id, payload: { before: { plano: "teste", plano_nome: null, proximo_vencimento: null }, after: { plano: "pago", plano_nome: "Quando Trocar Mensal", proximo_vencimento: o.fimTeste } }, ip: ADMIN_IP.valor });
  if (o.row.preco_negociado) {
    m.auditoria({ em: ativacaoEm + 40_000, admin_id: admin, acao: "oficina.update_preco", entidade: "oficinas", entidade_id: o.id, payload: { before: { preco_negociado: null }, after: { preco_negociado: o.row.preco_negociado }, motivo: rng.pick(["Negociado na ativação", "Indicação de representante", "Oficina pequena"]) }, ip: ADMIN_IP.valor });
  }

  // ── Plano de ciclos ─────────────────────────────────────────────────────
  // Decide em qual ciclo acontece o evento do destino.
  let vencimento = o.fimTeste < ativacaoData ? somaDias(ativacaoData, 3) : o.fimTeste;
  const ciclos: string[] = [];
  let v = vencimento;
  while (somaDias(v, -3) <= hoje) { ciclos.push(v); v = somaUmMes(v); }
  const totalCiclos = ciclos.length;
  let cicloEvento = -1;
  if (o.destino === "inad_hoje") cicloEvento = totalCiclos - 1; // último ciclo vencido
  if (o.destino === "inad_regularizada") cicloEvento = rng.int(0, Math.max(0, totalCiclos - 2));
  if (o.destino === "cancelada") cicloEvento = rng.int(Math.min(1, totalCiclos - 1), Math.max(0, totalCiclos - 1));
  if (o.destino === "vol_pausada") cicloEvento = Math.max(0, totalCiclos - 1);

  // Garantias do destino inad_hoje: o vencimento precisa estar entre 8 e 25 dias atrás.
  if (o.destino === "inad_hoje") {
    // recua os ciclos para que o último vencido esteja na janela
    const alvo = somaDias(hoje, -rng.int(8, 25));
    // reconstrói ciclos terminando em `alvo`
    const lista: string[] = [alvo];
    let anterior = alvo;
    while (true) {
      const d = new Date(`${anterior}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
      const prev = d.toISOString().slice(0, 10);
      if (prev < vencimento) break;
      lista.unshift(prev); anterior = prev;
    }
    ciclos.length = 0; ciclos.push(...lista);
    cicloEvento = ciclos.length - 1;
  }

  let proximoVencimento: string | null = null;
  for (let i = 0; i < ciclos.length; i += 1) {
    const venc = ciclos[i];
    const geracaoData = i === 0 ? ativacaoData : somaDias(venc, -3);
    const geracaoEm = ateAgora(m, brt(...splitData(geracaoData), 9, rng.int(0, 25), rng.int(0, 59)));
    const ehEvento = i === cicloEvento;
    const pagId = rng.uuid();
    const chargeId = `pay_${rng.digits(16)}`;
    const base: Row = {
      id: pagId,
      oficina_id: o.id,
      valor: o.precoEfetivo,
      status: "pendente",
      mp_preference_id: null,
      mp_payment_id: null,
      descricao: `Mensalidade ${venc}`,
      vencimento: venc,
      tentativa: 1,
      created_at: iso(geracaoEm),
      updated_at: iso(geracaoEm),
      paid_at: null,
      gateway: "asaas",
      gateway_charge_id: chargeId,
      gateway_payment_id: chargeId,
      payment_url: `https://www.asaas.com/i/${rng.uuid().replace(/-/g, "").slice(0, 12)}`,
      external_reference: `oficina:${o.id}|venc:${venc}|t:1`,
    };
    // cobrança avisada por template
    m.outboundTemplate(o.conversa, { em: geracaoEm + 4000, template: "cobranca_mensalidade", params: [String(o.row.nome), `R$ ${o.precoEfetivo.toFixed(2).replace(".", ",")}`, String(base.payment_url)], body: `Oi ${o.row.nome}! Sua mensalidade do Quando Trocar (R$ ${o.precoEfetivo.toFixed(2).replace(".", ",")}) vence em ${formatBR(venc)}. Pague por aqui: ${base.payment_url}` });

    if (ehEvento && (o.destino === "inad_hoje" || o.destino === "inad_regularizada")) {
      // não paga → pausa em venc+7 (cron 09:30)
      const pausaData = somaDias(venc, GRACE_DIAS);
      const pausaEm = ateAgora(m, brt(...splitData(pausaData), 9, 30 + rng.int(0, 9), rng.int(0, 59)));
      o.periodos[o.periodos.length - 1].ate = pausaData;
      o.periodos.push({ de: pausaData, ate: null, status: "pausada" });
      o.pausaInadDe = pausaData;
      m.auditoria({ em: pausaEm, admin_id: null, acao: "oficina.auto_pausa_inadimplencia", entidade: "oficinas", entidade_id: o.id, payload: { before: { status: "ativa", motivo_pausa: null }, after: { status: "pausada", motivo_pausa: "inadimplencia" }, vencimento: venc, dias_atraso: GRACE_DIAS } });
      conversaCobranca(m, o, pausaEm, base, "inadimplente");
      if (o.destino === "inad_hoje") {
        o.pagamentos.push(base);
        o.row.status = "pausada";
        o.row.motivo_pausa = "inadimplencia";
        o.row.updated_at = iso(pausaEm);
        proximoVencimento = venc;
        break;
      }
      // regulariza entre 1 e 18 dias depois da pausa
      let pagoData = somaDias(pausaData, rng.int(1, 18));
      if (pagoData > hoje) pagoData = hoje;
      const pagoEm = ateAgora(m, momentoNoDia(rng, pagoData, 8, 22));
      base.status = "pago"; base.paid_at = iso(pagoEm); base.updated_at = iso(pagoEm + 2000);
      o.pagamentos.push(base);
      o.periodos[o.periodos.length - 1].ate = pagoData;
      o.periodos.push({ de: pagoData, ate: null, status: "ativa" });
      o.pausaInadAte = pagoData;
      m.auditoria({ em: pagoEm + 2000, admin_id: null, acao: "pagamento.webhook_confirmado", entidade: "pagamentos", entidade_id: null, payload: { gateway: "asaas", payment_id: chargeId, status: "pago", oficina_id: o.id, reativada: true } });
      proximoVencimento = somaUmMes(venc);
      continue;
    }

    if (ehEvento && o.destino === "cancelada") {
      // cancela antes de pagar este ciclo
      let cancelData = somaDias(venc, rng.int(-2, 6));
      if (cancelData > hoje) cancelData = hoje;
      const cancelEm = ateAgora(m, momentoNoDia(rng, cancelData, 9, 18));
      base.status = "cancelado"; base.updated_at = iso(cancelEm);
      o.pagamentos.push(base);
      o.periodos[o.periodos.length - 1].ate = cancelData;
      o.periodos.push({ de: cancelData, ate: null, status: "cancelada" });
      o.row.status = "cancelada";
      o.row.observacao = rng.pick(["Cancelou: disse que não viu retorno ainda.", "Cancelou: fechou a oficina.", "Cancelou: vai usar planilha.", "Cancelou por corte de custos."]);
      o.row.updated_at = iso(cancelEm);
      m.auditoria({ em: cancelEm, admin_id: admin, acao: "oficina.update_status", entidade: "oficinas", entidade_id: o.id, payload: { before: { status: "ativa", motivo_pausa: null }, after: { status: "cancelada", motivo_pausa: null }, motivo: o.row.observacao }, ip: ADMIN_IP.valor });
      m.auditoria({ em: cancelEm + 60_000, admin_id: admin, acao: "pagamento.cancelado_manual", entidade: "pagamentos", entidade_id: pagId, payload: { before: { status: "pendente" }, after: { status: "cancelado" }, oficina_id: o.id }, ip: ADMIN_IP.valor });
      proximoVencimento = venc;
      break;
    }

    if (ehEvento && o.destino === "vol_pausada") {
      const pausaData = somaDias(venc, rng.int(-6, -1));
      if (pausaData <= hoje) {
        const pausaEm = ateAgora(m, momentoNoDia(rng, pausaData, 9, 18));
        base.status = "cancelado"; base.updated_at = iso(pausaEm);
        o.pagamentos.push(base);
        o.periodos[o.periodos.length - 1].ate = pausaData;
        o.periodos.push({ de: pausaData, ate: null, status: "pausada" });
        o.row.status = "pausada"; o.row.motivo_pausa = "voluntaria"; o.row.updated_at = iso(pausaEm);
        o.row.observacao = rng.pick(["Pediu pausa: reforma na oficina.", "Pediu pausa por 1 mês (férias).", "Pausou: vai retomar depois da baixa temporada."]);
        m.auditoria({ em: pausaEm, admin_id: admin, acao: "oficina.update_status", entidade: "oficinas", entidade_id: o.id, payload: { before: { status: "ativa", motivo_pausa: null }, after: { status: "pausada", motivo_pausa: "voluntaria" }, motivo: o.row.observacao }, ip: ADMIN_IP.valor });
        conversaCobranca(m, o, pausaEm + 3 * DIA_MS, base, "winback");
        proximoVencimento = venc;
        break;
      }
    }

    // ── Ciclo normal: paga (ou falha e paga na 2ª tentativa) ─────────────
    const falha = rng.chance(0.06) && somaDias(venc, -2) <= hoje;
    if (falha) {
      const falhaEm = ateAgora(m, momentoNoDia(rng, somaDias(venc, rng.int(-2, 0)), 8, 22));
      base.status = "falhou"; base.updated_at = iso(falhaEm);
      o.pagamentos.push(base);
      m.auditoria({ em: falhaEm + 1500, admin_id: null, acao: "pagamento.webhook_falhou", entidade: "pagamentos", entidade_id: null, payload: { gateway: "asaas", payment_id: chargeId, status: "falhou", oficina_id: o.id } });
      const t2Id = rng.uuid();
      const t2Charge = `pay_${rng.digits(16)}`;
      const t2Em = ateAgora(m, falhaEm + rng.int(2, 30) * HORA_MS);
      const t2: Row = { ...base, id: t2Id, status: "pendente", tentativa: 2, created_at: iso(t2Em), updated_at: iso(t2Em), gateway_charge_id: t2Charge, gateway_payment_id: t2Charge, external_reference: `oficina:${o.id}|venc:${venc}|t:2`, payment_url: `https://www.asaas.com/i/${rng.uuid().replace(/-/g, "").slice(0, 12)}` };
      m.auditoria({ em: t2Em, admin_id: admin, acao: "pagamento.link_reenviado", entidade: "pagamentos", entidade_id: t2Id, payload: { oficina_id: o.id, vencimento: venc, tentativa: 2 }, ip: ADMIN_IP.valor });
      const pagoEmT2 = t2Em + rng.int(1, 60) * HORA_MS;
      if (somaDias(venc, 4) > hoje || pagoEmT2 > m.ate) {
        // ainda em aberto
        o.pagamentos.push(t2);
        proximoVencimento = venc;
        continue;
      }
      const pagoEm = pagoEmT2;
      t2.status = "pago"; t2.paid_at = iso(pagoEm); t2.updated_at = iso(pagoEm + 1500);
      o.pagamentos.push(t2);
      m.auditoria({ em: pagoEm + 1500, admin_id: null, acao: "pagamento.webhook_confirmado", entidade: "pagamentos", entidade_id: null, payload: { gateway: "asaas", payment_id: t2Charge, status: "pago", oficina_id: o.id } });
      proximoVencimento = somaUmMes(venc);
      continue;
    }

    // Pago entre D-2 e D+2 (cauda até D+6); se ainda não chegou a hora, fica pendente.
    const atrasoDias = rng.weighted([[-2, 10], [-1, 22], [0, 33], [1, 18], [2, 9], [3, 4], [5, 3], [6, 1]]);
    const pagoData = somaDias(venc, atrasoDias);
    if (pagoData > hoje || (pagoData === hoje && rng.chance(0.5))) {
      o.pagamentos.push(base);
      proximoVencimento = venc;
      continue;
    }
    const pagoEm = momentoNoDia(rng, pagoData, 7, 23);
    if (pagoEm > m.ate) { o.pagamentos.push(base); proximoVencimento = venc; continue; }
    base.status = "pago"; base.paid_at = iso(pagoEm); base.updated_at = iso(pagoEm + 1500);
    o.pagamentos.push(base);
    m.auditoria({ em: pagoEm + 1500, admin_id: null, acao: "pagamento.webhook_confirmado", entidade: "pagamentos", entidade_id: null, payload: { gateway: "asaas", payment_id: chargeId, status: "pago", oficina_id: o.id } });
    proximoVencimento = somaUmMes(venc);
  }

  if (proximoVencimento === null) proximoVencimento = v;
  o.row.proximo_vencimento = proximoVencimento;
  if (o.destino === "inad_regularizada" && o.row.status !== "ativa") { o.row.status = "ativa"; o.row.motivo_pausa = null; }
}

/** Conversa do cobranca-agent (inadimplente) ou winback (pausa voluntária). */
function conversaCobranca(m: Mundo, o: OficinaSim, em: number, pagamento: Row, modo: "inadimplente" | "winback") {
  const rng = m.rng;
  const c = o.conversa;
  const hoje = m.ate;
  let t = momento(rng, em + 2 * HORA_MS, Math.min(hoje, em + 3 * DIA_MS), "oficina");
  if (t > hoje) return;
  if (modo === "inadimplente") {
    const valor = `R$ ${Number(pagamento.valor).toFixed(2).replace(".", ",")}`;
    m.inbound(c, { em: t, body: rng.pick(C.FALAS_LEAD.cobranca_inad), nomePerfil: String(o.row.responsavel) });
    t += 4000;
    m.outboundTexto(c, { em: t, body: C.cobrancaPausado(valor, formatBR(String(pagamento.vencimento)), String(pagamento.payment_url)) });
    if (rng.chance(0.5)) {
      t += rng.int(1, 30) * 60_000;
      const fala = rng.pick(["ja paguei ontem", "vou pagar hoje", "posso pagar semana que vem?", "manda o link de novo"]);
      m.inbound(c, { em: t, body: fala, nomePerfil: String(o.row.responsavel) });
      t += 3500;
      if (fala.startsWith("ja")) { m.outboundTexto(c, { em: t, body: C.COBRANCA_JA_PAGUEI }); c.handoff_required = true; c.handoff_reason = "verificar_pagamento"; }
      else if (fala.startsWith("posso")) { m.outboundTexto(c, { em: t, body: C.COBRANCA_NEGOCIA }); c.handoff_required = true; c.handoff_reason = "negocia_prazo"; }
      else m.outboundTexto(c, { em: t, body: C.cobrancaLink(valor, formatBR(String(pagamento.vencimento)), String(pagamento.payment_url)) });
    }
  } else {
    m.inbound(c, { em: t, body: rng.pick(["oi", "quero cadastrar um cliente", "bom dia"]), nomePerfil: String(o.row.responsavel) });
    t += 4000;
    m.outboundTexto(c, { em: t, body: C.winbackAbertura(String(o.row.nome)) });
    t += rng.int(2, 40) * 60_000;
    const volta = rng.chance(0.4);
    m.inbound(c, { em: t, body: volta ? "quero voltar sim, mês que vem" : "por enquanto não, obrigado", nomePerfil: String(o.row.responsavel) });
    t += 3500;
    m.outboundTexto(c, { em: t, body: volta ? C.WINBACK_QUER_VOLTAR : C.WINBACK_NAO_VOLTA });
    if (volta) { c.handoff_required = true; c.handoff_reason = "quer_voltar"; }
  }
  if (o.pausaInadAte === null && o.destino === "inad_hoje") {
    // segue pausada: handoff resolvido não acontece
  }
}

/** Comissões (ADR-0019): uma por pagamento pago de oficina com representante. */
export function gerarComissoes(m: Mundo, oficinas: OficinaSim[], reps: Array<{ id: string; nome: string }>) {
  const rng = m.rng;
  const hoje = dataBRT(m.ate);
  const mesAtual = hoje.slice(0, 7);
  const lotes = new Map<string, { em: number; ids: string[]; total: number }>();
  for (const o of oficinas) {
    if (!o.repId) continue;
    const repRow = m.representantes.find((r) => r.id === o.repId);
    const taxa = repRow?.comissao_tipo === "percentual" && repRow.comissao_valor != null ? Number(repRow.comissao_valor) : 20;
    for (const p of o.pagamentos) {
      if (p.status !== "pago") continue;
      const pagoEm = Date.parse(String(p.paid_at));
      const base = Number(p.valor);
      const valor = Math.round(base * taxa) / 100;
      const mes = String(p.paid_at).slice(0, 7);
      const paga = mes < mesAtual;
      const id = rng.uuid();
      // payout em lote no 5º dia útil do mês seguinte
      let pagaEm: number | null = null;
      if (paga) {
        const [y, mo] = mes.split("-").map(Number);
        let d = new Date(Date.UTC(y, mo, 5)).toISOString().slice(0, 10);
        while (!ehDiaUtil(d)) d = somaDias(d, 1);
        pagaEm = brt(...splitData(d), 10, 15, 0);
        const chave = `${o.repId}|${mes}`;
        const lote = lotes.get(chave) ?? { em: pagaEm, ids: [], total: 0 };
        lote.ids.push(id); lote.total += valor; lotes.set(chave, lote);
      }
      m.comissoes.push({
        id,
        representante_id: o.repId,
        oficina_id: o.id,
        pagamento_id: p.id,
        base_valor: base,
        tipo: "percentual",
        taxa_aplicada: taxa,
        valor,
        status: paga ? "paga" : "prevista",
        paga_em: pagaEm ? iso(pagaEm) : null,
        cancelada_motivo: null,
        created_at: iso(pagoEm + 2500),
        updated_at: iso(pagaEm ?? pagoEm + 2500),
      });
    }
  }
  for (const [chave, lote] of lotes) {
    const [repId, mes] = chave.split("|");
    m.auditoria({ em: lote.em, admin_id: ADMIN_ID.valor, acao: "comissao.marcar_paga_lote", entidade: "comissoes", entidade_id: null, payload: { representante_id: repId, periodo: mes, quantidade: lote.ids.length, total: Math.round(lote.total * 100) / 100 }, ip: ADMIN_IP.valor });
  }
}

/** cobranca_jobs: 2 linhas por dia desde o início do billing. */
export function gerarCobrancaJobs(m: Mundo, oficinas: OficinaSim[]) {
  const hoje = dataBRT(m.ate);
  let d = BILLING_START;
  while (d <= hoje) {
    const avaliadas = oficinas.filter((o) => o.row.plano === "pago" && o.conversaoData <= d && statusEm(o, d) !== "cancelada").length;
    const geradas = m.pagamentos.filter((p) => String(p.created_at).slice(0, 10) === d).length
      + oficinas.reduce((acc, o) => acc + o.pagamentos.filter((p) => String(p.created_at).slice(0, 10) === d).length, 0);
    const pausas = m.audit.filter((a) => a.acao === "oficina.auto_pausa_inadimplencia" && String(a.created_at).slice(0, 10) === d).length;
    const em1 = brt(...splitData(d), 9, 0, m.rng.int(3, 40));
    const em2 = brt(...splitData(d), 9, 30, m.rng.int(2, 30));
    if (em1 <= m.ate) m.cobranca_jobs.push({ id: m.rng.uuid(), tipo: "cobranca_proxima", executado_em: iso(em1), oficinas_avaliadas: avaliadas, preferencias_geradas: geradas, pausas_aplicadas: 0, erros: null });
    if (em2 <= m.ate) m.cobranca_jobs.push({ id: m.rng.uuid(), tipo: "auto_pausa_inadimplencia", executado_em: iso(em2), oficinas_avaliadas: avaliadas, preferencias_geradas: 0, pausas_aplicadas: pausas, erros: null });
    d = somaDias(d, 1);
  }
}
