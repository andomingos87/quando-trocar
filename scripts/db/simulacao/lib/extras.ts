// Tabelas de apoio: representantes, anúncios, cliques de indicação, prospecção, volantes,
// status do número Meta e logins do admin.
import type { Mundo, Row } from "./mundo";
import type { Anuncio, Rep, Faq } from "./vendas";
import { ADMIN_ID, ADMIN_IP } from "./vendas";
import { iso, dataBRT, somaDias, momentoNoDia, momento, brt, splitData, ehDiaUtil, DIA_MS, HORA_MS } from "./tempo";
import { nomePessoa, cidade as sorteiaCidade, nomeOficina, cnpj, endereco, foneProspeccao, foneOficina, ipFicticio } from "./identidades";
import * as C from "./copy";

export function criarRepresentantes(m: Mundo, seqFone: { n: number }): Rep[] {
  const rng = m.rng;
  const defs = [
    { nome: "Carlos Menezes", codigo: "CARLOS", criado: "2026-04-02", forte: 1.0 },
    { nome: "Renata Albuquerque", codigo: "RENATA", criado: "2026-04-14", forte: 0.7 },
    { nome: "Jorge Tavares", codigo: "JORGE", criado: "2026-05-06", forte: 0.5 },
    { nome: "Paula Benevides", codigo: "PAULA", criado: "2026-06-18", forte: 0.15 },
  ];
  const reps: Rep[] = [];
  for (const d of defs) {
    seqFone.n += 1;
    const id = rng.uuid();
    const em = momentoNoDia(rng, d.criado, 9, 18);
    m.representantes.push({
      id, nome: d.nome, whatsapp: foneOficina(seqFone.n), codigo: d.codigo, ativo: true,
      comissao_tipo: d.codigo === "CARLOS" ? "percentual" : null, comissao_valor: d.codigo === "CARLOS" ? 25 : null, comissao_duracao_meses: null,
      created_at: iso(em), updated_at: iso(em), ultimo_acesso_em: iso(m.ate - rng.int(1, 12) * DIA_MS * d.forte - HORA_MS),
    });
    m.auditoria({ em, admin_id: ADMIN_ID.valor, acao: "representante.create", entidade: "representantes", entidade_id: id, payload: { nome: d.nome, codigo: d.codigo }, ip: ADMIN_IP.valor });
    m.auditoria({ em: em + 3 * 60_000, admin_id: ADMIN_ID.valor, acao: "representante.convite_enviado", entidade: "representantes", entidade_id: id, payload: { template: "convite_representates" }, ip: ADMIN_IP.valor });
    reps.push({ id, codigo: d.codigo, nome: d.nome });
  }
  return reps;
}

export function pesoRep(codigo: string): number {
  return { CARLOS: 45, RENATA: 30, JORGE: 20, PAULA: 5 }[codigo] ?? 10;
}

export function criarAdminExtra(m: Mundo, seqFone: { n: number }): string {
  seqFone.n += 1;
  const id = m.rng.uuid();
  m.admin_users_extra.push({ id, whatsapp: foneOficina(seqFone.n), nome: "Everton (comercial)", ativo: true, ultimo_acesso_em: iso(m.ate - 3 * DIA_MS), created_at: iso(brt(2026, 5, 20, 10)) });
  return id;
}

export function gerarAnuncios(m: Mundo): Anuncio[] {
  const rng = m.rng;
  const hoje = dataBRT(m.ate);
  const campanhas = [
    { id: `1204${rng.digits(13)}`, nome: "[QT] Oficinas SP - Mensagem", conjuntos: [
      { id: `1205${rng.digits(13)}`, nome: "Donos de oficina 25-55 | SP capital", ads: [
        { nome: "Cliente sumiu depois da troca? (vídeo 15s)", headline: "Seu cliente trocou o óleo e sumiu?", inicio: "2026-04-01", fim: null, gasto: 45 },
        { nome: "Caderninho não lembra o cliente (imagem)", headline: "Troque o caderninho por lembrete automático", inicio: "2026-04-01", fim: "2026-06-30", gasto: 30 },
        { nome: "14 dias grátis - depoimento", headline: "14 dias grátis, sem cartão", inicio: "2026-06-15", fim: null, gasto: 55 },
      ] },
      { id: `1205${rng.digits(13)}`, nome: "Interior SP | Sorocaba, Campinas, Ribeirão", ads: [
        { nome: "Cliente sumiu depois da troca? (vídeo 15s)", headline: "Seu cliente trocou o óleo e sumiu?", inicio: "2026-05-10", fim: null, gasto: 35 },
        { nome: "R$ 59/mês - carrossel", headline: "A partir de R$ 59/mês", inicio: "2026-07-01", fim: null, gasto: 40 },
      ] },
    ] },
    { id: `1204${rng.digits(13)}`, nome: "[QT] Sul e Minas - Mensagem", conjuntos: [
      { id: `1205${rng.digits(13)}`, nome: "PR/SC/RS | oficinas e troca de óleo", ads: [
        { nome: "Cliente sumiu depois da troca? (vídeo 15s)", headline: "Seu cliente trocou o óleo e sumiu?", inicio: "2026-06-01", fim: null, gasto: 38 },
        { nome: "Amortecedor - retorno em 2 anos", headline: "Amortecedor também tem hora de trocar", inicio: "2026-08-05", fim: null, gasto: 28 },
      ] },
      { id: `1205${rng.digits(13)}`, nome: "MG | BH e Uberlândia", ads: [
        { nome: "14 dias grátis - depoimento", headline: "14 dias grátis, sem cartão", inicio: "2026-07-15", fim: null, gasto: 32 },
      ] },
    ] },
    { id: `1204${rng.digits(13)}`, nome: "[QT] Remarketing - visitou o site", conjuntos: [
      { id: `1205${rng.digits(13)}`, nome: "Visitantes 30d", ads: [
        { nome: "Ainda dá tempo de testar (imagem)", headline: "Ative seus 14 dias grátis", inicio: "2026-08-20", fim: null, gasto: 18 },
      ] },
    ] },
  ];
  const anuncios: Anuncio[] = [];
  for (const camp of campanhas) {
    for (const conj of camp.conjuntos) {
      for (const ad of conj.ads) {
        const adId = `1206${rng.digits(13)}`;
        anuncios.push({ ad_id: adId, ad_name: ad.nome, headline: ad.headline, inicio: ad.inicio, fim: ad.fim });
        let d = ad.inicio;
        const fim = ad.fim && ad.fim < hoje ? ad.fim : hoje;
        while (d <= fim) {
          const dow = new Date(Date.parse(`${d}T00:00:00Z`)).getUTCDay();
          const fator = (dow === 0 ? 0.6 : dow === 6 ? 0.8 : 1) * rng.float(0.65, 1.35);
          const spend = Math.round(ad.gasto * fator * 100) / 100;
          const impressions = Math.round(spend * rng.float(180, 320));
          const clicks = Math.round(impressions * rng.float(0.012, 0.03));
          const results = Math.max(0, Math.round(clicks * rng.float(0.08, 0.2)));
          m.ad_insights.push({
            id: rng.uuid(), date: d, ad_id: adId, ad_name: ad.nome, adset_id: conj.id, adset_name: conj.nome,
            campaign_id: camp.id, campaign_name: camp.nome, spend, impressions, clicks, results,
            cost_per_result: results > 0 ? Math.round((spend / results) * 100) / 100 : null,
            raw: { date: d, ad_id: adId, spend, clicks, ad_name: ad.nome, adset_id: conj.id, campaign: camp.nome, adset_name: conj.nome, campaign_id: camp.id, impressions, actions_onsite_conversion_messaging_conversation_started_7d: results, sim_run_id: m.runId },
            synced_at: iso(brt(...splitData(somaDias(d, 1)), 8, 30, rng.int(0, 59))),
          });
          d = somaDias(d, 1);
        }
      }
    }
  }
  return anuncios;
}

export function anuncioAtivoEm(rng: Mundo["rng"], anuncios: Anuncio[], data: string): Anuncio | undefined {
  const ativos = anuncios.filter((a) => a.inicio <= data && (!a.fim || a.fim >= data));
  return ativos.length ? rng.pick(ativos) : undefined;
}

/** Cliques em /r/<codigo>: os que viraram lead + o resto (visitante anônimo). */
export function gerarLinkCliques(m: Mundo, reps: Rep[]) {
  const rng = m.rng;
  for (const rep of reps) {
    const criado = Date.parse(String(m.representantes.find((r) => r.id === rep.id)!.created_at));
    const leadsSite = m.leads.filter((l) => l.representante_id === rep.id && l.representante_atribuido_via === "site_link");
    for (const l of leadsSite) {
      const em = Date.parse(String(l.created_at)) - rng.int(2, 90) * 60_000;
      m.link_cliques.push({ id: rng.uuid(), representante_id: rep.id, codigo: rep.codigo, click_token: String(l.representante_click_token), atribuiu: true, referer: rng.pick([null, "https://www.instagram.com/", "https://l.facebook.com/", "https://www.google.com/"]), utm_source: rng.pick([null, "whatsapp", "instagram"]), utm_medium: null, utm_campaign: null, ip_hash: rng.uuid().replace(/-/g, ""), user_agent_hash: rng.uuid().replace(/-/g, ""), created_at: iso(em) });
    }
    const extras = Math.round((leadsSite.length + 3) * rng.float(2.5, 6));
    for (let i = 0; i < extras; i += 1) {
      const em = momento(rng, Math.max(criado, m.ate - 150 * DIA_MS), m.ate, "lead");
      m.link_cliques.push({ id: rng.uuid(), representante_id: rep.id, codigo: rep.codigo, click_token: rng.uuid().replace(/-/g, "").slice(0, 20) + rng.digits(4), atribuiu: rng.chance(0.9), referer: rng.pick([null, null, "https://www.instagram.com/", "https://l.facebook.com/"]), utm_source: rng.pick([null, "whatsapp", "instagram", "cartao"]), utm_medium: rng.pick([null, "social"]), utm_campaign: null, ip_hash: rng.uuid().replace(/-/g, ""), user_agent_hash: rng.uuid().replace(/-/g, ""), created_at: iso(em) });
    }
  }
}

export function gerarProspeccao(m: Mundo, leadsManuais: Row[]) {
  const rng = m.rng;
  const areas = [
    { cidade: "Guarulhos", uf: "SP", status: "ingerida", n: 320, exec: "2026-07-12" },
    { cidade: "Campinas", uf: "SP", status: "ingerida", n: 260, exec: "2026-08-02" },
    { cidade: "Sorocaba", uf: "SP", status: "ingerida", n: 140, exec: "2026-08-21" },
    { cidade: "Curitiba", uf: "PR", status: "pendente", n: 0, exec: null },
  ];
  let seq = 0;
  let idxLead = 0;
  for (const a of areas) {
    const areaId = rng.uuid();
    const criado = brt(...splitData(a.exec ?? "2026-09-20"), 9, 12);
    m.prospeccao_areas.push({ id: areaId, cidade: a.cidade, uf: a.uf, codigo_ibge: null, codigo_municipio_rfb: null, bbox: null, status: a.status, created_at: iso(criado - HORA_MS), updated_at: iso(criado + 2 * HORA_MS) });
    if (!a.exec) continue;
    const lidos = rng.int(300_000, 520_000);
    m.prospeccao_execucoes.push({ id: rng.uuid(), area_id: areaId, fonte: "rfb", competencia: a.exec.slice(0, 7), iniciada_em: iso(criado), finalizada_em: iso(criado + rng.int(20, 55) * 60_000), metricas: { inseridos: a.n, atualizados: 0, linhasLidas: lidos, semTelefone: rng.int(5, 30), aptosPorCnae: Math.round(a.n * 2.4), normalizados: Math.round(a.n * 1.1), duplicadosNoLote: rng.int(10, 60), descartadosSituacao: rng.int(400, 1200), sim_run_id: m.runId }, lidos, descobertos: Math.round(a.n * 1.1), novos: a.n, erro: null });
    for (let i = 0; i < a.n; i += 1) {
      seq += 1;
      const resp = nomePessoa(rng);
      const nome = nomeOficina(rng, resp).toUpperCase();
      const end = endereco(rng);
      const status = rng.weighted([["descoberto", 52], ["qualificado", 22], ["descartado", 12], ["aprovado", 8], ["promovido", 4], ["duplicado", 2]]);
      const score = status === "descoberto" && rng.chance(0.5) ? null : rng.int(20, 96);
      const motivos = score === null ? [] : [
        ...(score > 60 ? ["cnae_principal_oficina"] : ["cnae_secundario"]),
        ...(rng.chance(0.6) ? ["telefone_movel"] : []),
        ...(rng.chance(0.4) ? ["porte_micro"] : []),
        ...(rng.chance(0.3) ? ["abertura_ha_mais_de_3_anos"] : []),
      ];
      const lead = status === "promovido" && idxLead < leadsManuais.length ? leadsManuais[idxLead++] : null;
      const em = criado + rng.int(5, 50) * 60_000;
      m.prospeccao_estab.push({
        id: rng.uuid(), area_id: areaId, fontes: ["rfb"], cnpj: cnpj(rng), google_place_id: null,
        razao_social: `${nome} LTDA`, nome_fantasia: nome, nome_canonico: nome.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
        cnae_principal: rng.pick(["4520001", "4520002", "4520005", "4520007", "4530703", "4530705", "4732600"]), cnae_secundarios: rng.chance(0.4) ? [rng.pick(["4530703", "4520001", "4530705"])] : [],
        situacao_cadastral: "ativa", data_abertura: somaDias("2026-09-26", -rng.int(200, 9000)), porte: rng.weighted([["micro", 60], ["pequeno", 30], ["demais", 10]]), matriz_filial: "matriz",
        logradouro: end.logradouro, numero: end.numero, complemento: null, bairro: end.bairro.toUpperCase(), cidade: a.cidade, uf: a.uf, cep: end.cep, email: null,
        places_cache: null, places_cached_at: null, telefone_e164: foneProspeccao(seq), telefone_secundario_e164: null, telefone_movel: rng.chance(0.7),
        score_icp: score, score_versao: score === null ? null : "v1", score_motivos: motivos, classificacao: score === null ? null : score > 60 ? "oficina" : rng.pick(["oficina", "autopecas", "outro"]), classificacao_origem: score === null ? null : rng.weighted([["regra", 70], ["llm", 25], ["humano", 5]]),
        status, motivo_descarte: status === "descartado" ? rng.pick(["Não é oficina (autopeças)", "Telefone inválido", "Fechada", "Fora da área"]) : null, duplicado_de: null,
        lead_id: lead ? lead.id : null, revisado_por: status === "aprovado" || status === "promovido" || status === "descartado" ? ADMIN_ID.valor : null,
        revisado_em: status === "aprovado" || status === "promovido" || status === "descartado" ? iso(em + rng.int(1, 20) * DIA_MS) : null,
        created_at: iso(em), updated_at: iso(em + rng.int(0, 20) * DIA_MS),
      });
    }
  }
}

export function gerarVolantes(m: Mundo, faqs: Faq[]) {
  const rng = m.rng;
  const conversasVendas = m.conversas.filter((c) => c.lead_id && (c.agent_mode === "vendas"));
  const conversasOperacao = m.conversas.filter((c) => c.agent_mode === "operacao");
  if (conversasVendas.length === 0) return;
  // perguntas sem resposta
  for (let i = 0; i < 82; i += 1) {
    const emOperacao = rng.chance(0.25);
    const c = emOperacao && conversasOperacao.length ? rng.pick(conversasOperacao) : rng.pick(conversasVendas);
    const em = Math.max(Date.parse(String(c.created_at ? iso(c.created_at) : iso(m.ate))), brt(2026, 7, 16, 9)) + rng.int(0, 60) * 60_000;
    if (em > m.ate) continue;
    const status = rng.weighted([["aberta", 62], ["resolvida", 25], ["ignorada", 13]]);
    m.perguntas.push({
      id: rng.uuid(), conversa_id: c.id, lead_id: c.lead_id, oficina_id: c.oficina_id, agent_mode: c.agent_mode === "operacao" ? "operacao" : "vendas",
      pergunta: rng.pick(C.PERGUNTAS_SEM_RESPOSTA), resposta_enviada: C.RESPOSTA_DONT_KNOW, motivo: "dont_know", geracao_modo: "on", prompt_version: "cv2-2", status, created_at: iso(em),
    });
  }
  // divergências determinístico x LLM
  const pares: Array<[string, string, string, string]> = [
    ["quanto sai por mês?", "fora_escopo", "pergunta_preco", "pergunta_preco"],
    ["bora ver isso então", "confirmacao_neutra", "quer_testar", "confirmacao_neutra"],
    ["me chama no zap pra gente fechar", "fora_escopo", "quer_humano", "quer_humano"],
    ["vou ver com meu sócio e te retorno", "fora_escopo", "vai_pensar", "vai_pensar"],
    ["como que o cliente recebe?", "fora_escopo", "pergunta_funcionamento", "pergunta_funcionamento"],
    ["libera aí pra mim", "fora_escopo", "quer_testar", "quer_testar"],
    ["não sei se compensa", "fora_escopo", "sem_interesse", "fora_escopo"],
    ["ta caro", "fora_escopo", "pergunta_preco", "fora_escopo"],
  ];
  for (let i = 0; i < 64; i += 1) {
    const c = rng.pick(conversasVendas);
    const [msg, det, llm, aplicado] = rng.pick(pares);
    const em = Math.max(c.created_at, brt(2026, 7, 26, 9)) + rng.int(0, 90) * 60_000;
    if (em > m.ate) continue;
    m.divergencias.push({ id: rng.uuid(), conversa_id: c.id, lead_id: c.lead_id, mensagem: msg, intent_deterministico: det, confidence_deterministica: Math.round(rng.float(0.55, 0.9) * 100) / 100, intent_llm: llm, confidence_llm: Math.round(rng.float(0.6, 0.95) * 100) / 100, intent_aplicado: aplicado, status: rng.weighted([["aberta", 70], ["promovida", 10], ["ignorada", 20]]), created_at: iso(em) });
  }
  const promovidas = m.divergencias.filter((d) => d.status === "promovida").slice(0, 5);
  const usados = new Set<string>();
  for (const d of promovidas) {
    const padrao = String(d.mensagem).replace(/[?]/g, "").trim();
    if (usados.has(padrao) || !["quer_testar", "pergunta_preco", "pergunta_funcionamento", "quer_humano", "vai_pensar"].includes(String(d.intent_llm))) continue;
    usados.add(padrao);
    m.gatilhos.push({ id: rng.uuid(), padrao, intent: d.intent_llm, ativo: true, origem_divergencia_id: d.id, created_at: iso(Date.parse(String(d.created_at)) + 2 * DIA_MS) });
  }
  void faqs;
}

export function gerarMetaPhoneStatus(m: Mundo) {
  const em = m.ate - m.rng.int(2, 9) * DIA_MS;
  m.meta_phone_status.push({
    id: m.rng.uuid(), display_phone_number: "+55 00 90000-0000", quality_rating: "GREEN", event: "PHONE_NUMBER_QUALITY_UPDATE", current_limit: "TIER_10K",
    raw: { display_phone_number: "+55 00 90000-0000", event: "PHONE_NUMBER_QUALITY_UPDATE", current_limit: "TIER_10K", quality_rating: "GREEN", sim_run_id: m.runId }, updated_at: iso(em),
  });
}

export function gerarLoginsAdmin(m: Mundo, adminIds: string[]) {
  const rng = m.rng;
  const hoje = dataBRT(m.ate);
  let d = "2026-05-18";
  while (d <= hoje) {
    if (ehDiaUtil(d) ? rng.chance(0.55) : rng.chance(0.12)) {
      const em = momentoNoDia(rng, d, 8, 22);
      if (em <= m.ate) m.auditoria({ em, admin_id: rng.chance(0.85) ? adminIds[0] : adminIds[adminIds.length - 1], acao: "admin.login", entidade: "admin_users", entidade_id: null, payload: { via: "otp_whatsapp" }, ip: ipFicticio(rng) });
    }
    d = somaDias(d, 1);
  }
}
