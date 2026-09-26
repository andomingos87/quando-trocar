// Copy REAL do bot (espelho das constantes em lib/whatsapp/*) + banco de falas dos humanos.
// Quando o texto do bot mudar no código, este arquivo precisa acompanhar — é dado, não regra.
import type { Rng } from "./prng";

export const HANDOFF_COMERCIAL = "+5511945207618"; // seed de configuracoes_vendedor (Anderson)
export const LINK_HANDOFF = `https://wa.me/${HANDOFF_COMERCIAL.replace("+", "")}`;
export const PRECO_PARTIDA = 59;

export const GREETING_PREFIX =
  "Fala chefe! Aqui e do Quando Trocar — a gente faz seu cliente voltar pra proxima troca de qualquer peca ou servico automotivo: oleo, amortecedor, filtro, revisao, alinhamento, freio...";

export const EXPLICADOR_LONGO =
  "Funciona assim chefe: voce cadastra o servico aqui (oleo, amortecedor, qualquer peca com retorno previsivel), o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Bora ativar 14 dias gratis pra voce ver rodando na sua oficina?";
export const EXPLICADOR_CURTO =
  "Lembra chefe: voce cadastra o servico aqui, o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Bora ativar 14 dias gratis pra testar?";

export const PRECO_PRIMEIRA = `Olha chefe, parte de R$ ${PRECO_PARTIDA}/mes. O valor final a gente fecha olhando o tamanho da sua oficina, mas antes de combinar preco, bora ativar 14 dias gratis pra voce ver rodando?`;
export const precoComRoi = (recuperado: string) =>
  `R$ ${PRECO_PARTIDA}/mes chefe, parte dai. Pra voce que ta recuperando uns ${recuperado}/mes, sai praticamente de graca. Bora ativar 14 dias gratis pra testar?`;
export const HANDOFF_COMERCIAL_BODY = `Chefe, pra esse caso eu prefiro o Anderson conversar direto contigo. Posso pedir pra ele te chamar agora: ${LINK_HANDOFF}`;
export const QUER_HUMANO_BODY = `Beleza chefe! Vou pedir pro Anderson te chamar direto agora: ${LINK_HANDOFF}`;
export const VAI_PENSAR_BODY =
  "Tranquilo chefe, sem pressa. Deixo aqui sem compromisso. Se quiser, te chamo daqui uns dias pra saber como ta pensando — ou e so me chamar quando der.";
export const CONFIRMACAO_NEUTRA_BODY =
  "Beleza chefe, to por aqui. Se quiser saber mais ou ja topar testar 14 dias gratis, e so me chamar.";
export const SMALL_TALK_BODY =
  "Hahaha nao to aqui pra isso chefe :) Mas se quiser ver como funciona ou ja topa testar 14 dias gratis, e so me chamar.";
export const PEDE_NOME_BODY = "Boa chefe! Antes de ativar seu teste, como chama a sua oficina?";
export const REPEDE_NOME_BODY = "So pra eu cadastrar certinho chefe: qual o nome da sua oficina?";
export const cadastraEmTeste = (nome: string) => `Show chefe! Vou cadastrar a ${nome} em teste por aqui mesmo.`;
export const PERDIDO_BODY = "Tranquilo chefe, deixo registrado. Se mudar de ideia, e so me chamar de novo.";
export const FALLBACK_LOOP_HANDOFF = `Chefe, vou te conectar direto com o Anderson — fica mais rapido a gente fechar isso por la: ${LINK_HANDOFF}`;
export const pedeComplemento = (falta: "volume" | "ticket") =>
  `Show chefe, sabe me dizer ${falta === "volume" ? "quantos servicos voce faz por mes?" : "qual o ticket medio?"} Se nao tiver de cabeca, sem stress — bora pro teste de 14 dias gratis.`;
export const roiBody = (pct: number, volume: number, ticket: string, recuperado: string) =>
  `Olha chefe, oficinas do seu tamanho costumam trazer de volta uns ${pct}% dos clientes que somem. Com ${volume} servicos/mes e ticket de ${ticket}, pra voce isso seria uns ${recuperado}/mes caindo de novo na oficina. Bora ativar 14 dias gratis pra testar?`;

export const GREETING_AFTER_GREETED = [
  "Td certo chefe! Posso te ajudar com algo do produto, ou ja quer ver quanto vale pra sua oficina?",
  "Bom, td bem chefe! Tava te falando aqui — bora ver como funciona pro seu caso?",
  "Fala chefe! Se quiser eu te explico de novo, te mostro o numero, ou ja ativo o teste de 14 dias.",
  "Td bom chefe :) Se for so um oi tranquilo, mas se quiser saber mais do produto e so chamar.",
  "Tamo aqui chefe! Me diz no que posso ajudar: como funciona, preco, ou ja partir pro teste?",
];
export const FALLBACK_VARIATIONS = [
  "Nao entendi muito bem chefe. Se quiser ver como funciona ou ja topa testar 14 dias gratis, me fala.",
  "Pra eu te ajudar melhor chefe, e so tocar numa opcao:",
  "Pode reformular chefe? Ou se preferir, eu te explico de novo o produto, te passo o preco, ou ja ativo o teste.",
  "Hmm, me ajuda chefe :) Me diz se voce quer ver como funciona, saber o preco, ou ja topa um teste.",
  "Chefe, se preferir, posso te conectar direto com o Anderson. Senao, me diz o que precisa saber do produto.",
];
export const SOCIAL_TEST_VARIATIONS = [
  "Hahaha to por aqui chefe :) Qualquer coisa do produto e so chamar.",
  "Td bem chefe :) Quer ver como funciona ou ja partir pro teste de 14 dias?",
  "Chefe, se for so testando me avisa kkk. Senao, e so dizer o que precisa.",
  "Beleza chefe :) Quando quiser saber do Quando Trocar, me fala.",
  "Hahaha td bom chefe. Tamo aqui pra ajudar quando voce decidir o que quer saber.",
];

export type Botao = { id: string; title: string };
export const BOTOES_FALLBACK: Botao[] = [
  { id: "sales_fb_funcionamento", title: "Como funciona" },
  { id: "sales_fb_preco", title: "Quanto custa" },
  { id: "sales_fb_testar", title: "Quero testar" },
];
export const BOTOES_EXPLICADOR: Botao[] = [
  { id: "sales_fb_testar", title: "Quero testar" },
  { id: "sales_fb_preco", title: "Quanto custa" },
  { id: "sales_fb_humano", title: "Falar com o Anderson" },
];
export const BOTOES_PRECO: Botao[] = [
  { id: "sales_fb_testar", title: "Quero testar" },
  { id: "sales_fb_funcionamento", title: "Como funciona" },
  { id: "sales_fb_humano", title: "Falar com o Anderson" },
];
export const BOTOES_CONFIRMAR: Botao[] = [
  { id: "onb_confirmar", title: "Confirmar" },
  { id: "onb_corrigir", title: "Corrigir" },
];
export const BOTAO_CANONICO: Record<string, string> = {
  sales_fb_funcionamento: "como funciona",
  sales_fb_preco: "quanto custa",
  sales_fb_testar: "quero testar",
  sales_fb_humano: "quero falar com humano",
  onb_confirmar: "confirmar",
  onb_corrigir: "corrigir",
};

/** Espelho de renderInteractiveAuditBody (lib/whatsapp/interactive-audit.ts). */
export function corpoInterativo(body: string, botoes: Botao[]): string {
  return [body, "", "Opções oferecidas:", ...botoes.map((b) => `- [${b.id}] ${b.title}`)].join("\n");
}

export function introOnboarding(nome: string): string {
  return [
    `Pronto, a ${nome} esta cadastrada.`,
    "",
    "Para registrar uma troca, me mande assim:",
    "",
    "Nome do cliente, carro, servico feito hoje e WhatsApp do cliente.",
    "",
    "Exemplo:",
    "Joao Silva, Civic 2018, troca de oleo hoje, 41999990000.",
  ].join("\n");
}

export const EXEMPLO_CADASTRO = "Exemplo: Joao Silva, Civic 2018, troca de oleo, hoje, 41999990000.";
export const PERGUNTA_CAMPO: Record<string, string> = {
  nome_cliente: "Perfeito. Falta so o nome do cliente.",
  whatsapp_cliente: "Perfeito. Agora me passe o WhatsApp do cliente.",
  veiculo: "Certo. Qual e o carro do cliente?",
  servico: "Certo. Qual servico foi feito?",
  data_servico: "Certo. Qual foi a data do servico?",
  marca_peca: "Anotei amortecedor. Qual a marca da peca? (Cofap, Monroe, Nakata, Perfect, outra)",
};
export const CORRIGIR_BODY = [
  "Sem problema. Me diga o que corrigir.",
  'Ex.: "o carro e Gol" ou "o telefone e 41999990000".',
  "Ou reenvie tudo: nome do cliente, carro, servico, data e WhatsApp.",
].join("\n");
export const NAO_PEGUEI_BODY = [
  "Nao peguei bem. Se for registrar uma troca, me manda:",
  "nome do cliente, carro, servico, data e WhatsApp.",
  EXEMPLO_CADASTRO,
].join("\n");

export const LABEL_CAMPO: Record<string, string> = {
  nome_cliente: "Cliente",
  whatsapp_cliente: "WhatsApp",
  veiculo: "Carro",
  servico: "Servico",
  data_servico: "Data",
  marca_peca: "Marca da peca",
};
export const MARCA_LABEL: Record<string, string> = {
  perfect: "Perfect",
  monroe: "Monroe",
  cofap: "Cofap",
  nakata: "Nakata",
  outra: "outra marca",
};

export function cardConfirmacao(draft: {
  nome_cliente: string;
  veiculo: string;
  servico: string;
  data_servico: string; // yyyy-mm-dd
  whatsapp_cliente: string;
  marca_peca?: string | null;
}, alterados: string[] = []): string {
  const [y, m, d] = draft.data_servico.split("-");
  const servicoLinha = draft.marca_peca ? `${draft.servico} (${MARCA_LABEL[draft.marca_peca]})` : draft.servico;
  return [
    "Confere os dados antes de eu registrar:",
    ...(alterados.length ? [`✅ Atualizado agora: ${alterados.map((f) => `*${LABEL_CAMPO[f]}*`).join(", ")}`] : []),
    "",
    `• Cliente: ${draft.nome_cliente}`,
    `• Carro: ${draft.veiculo}`,
    `• Servico: ${servicoLinha}`,
    `• Data: ${d}/${m}/${y}`,
    `• WhatsApp: ${draft.whatsapp_cliente}`,
    "",
    'Esta correto? Responda *sim* pra confirmar, ou me diga o que corrigir (ex.: "o carro e Gol").',
  ].join("\n");
}

export const ackCadastro = (nome: string, dataBR: string, avisou: boolean) =>
  `Cliente cadastrado. Vou lembrar o ${nome} em ${dataBR} pra voltar com você.${avisou ? ` Já avisei o ${nome} que o serviço foi registrado.` : ""}`;
export const ackSemConsentimento = (nome: string) =>
  `Cliente cadastrado. Como não tem autorização de WhatsApp, não vou mandar lembrete pro ${nome}.`;

/** Variações "geradas" (camada conversacional em modo on) para os acks mais comuns. */
export function ackGerado(rng: Rng, nome: string, dataBR: string, avisou: boolean): string {
  const fim = avisou ? " Já avisei que o serviço tá registrado." : "";
  return rng.pick([
    `Fechou, chefe! Já cadastrei o ${nome} e vou lembrar ele pra voltar com você em ${dataBR}.${fim}`,
    `Beleza, chefe! ${nome} tá cadastrado. Vou avisar pra voltar com você em ${dataBR}.${fim}`,
    `Cliente cadastrado, chefe! Vou lembrar o ${nome} em ${dataBR} pra voltar com você.${fim}`,
    `Show, chefe! O ${nome} tá cadastrado. Vou lembrar ele em ${dataBR} pra voltar com você${avisou ? " e já avisei que o serviço foi registrado." : "."}`,
  ]);
}

export function explicadorGerado(rng: Rng): string {
  return rng.pick([
    "E aí, chefe! Aqui é do Quando Trocar! A gente faz seu cliente voltar na próxima troca de qualquer peça ou serviço automotivo, tipo óleo, amortecedor, filtro, revisão e por aí vai...\n\nÉ simples: você cadastra o serviço aqui e o sistema avisa o cliente no dia certo pra voltar e ainda te avisa quem retornou. Que tal ativar 14 dias grátis pra testar?",
    "Fala, chefe! Aqui é do Quando Trocar. A gente faz o seu cliente voltar pra próxima troca: óleo, amortecedor, filtro, revisão, alinhamento, freio...\n\nFunciona assim: você cadastra o serviço por aqui, o sistema chama o cliente no dia certo e te avisa quem voltou. Bora ativar 14 dias grátis pra ver rodando na sua oficina?",
  ]);
}
export function precoGerado(rng: Rng): string {
  return rng.pick([
    `Olha, chefe, o plano começa a partir de R$ ${PRECO_PARTIDA}/mês. O valor final vai depender do tamanho da sua oficina, mas antes de a gente fechar qualquer coisa, que tal ativar 14 dias grátis pra você testar?`,
    `Parte de R$ ${PRECO_PARTIDA}/mês, chefe. O valor final a gente fecha olhando o tamanho da sua oficina. Mas antes de falar de preço, bora ativar os 14 dias grátis pra você ver rodando?`,
  ]);
}
export function pedeNomeGerado(rng: Rng): string {
  return rng.pick([
    "Show, chefe! Pra ativar seu teste, qual é o nome da sua oficina?",
    "Boa, chefe! Antes de ativar o teste, me diz: como chama a sua oficina?",
  ]);
}
export function introGerada(rng: Rng, nome: string): string {
  return rng.pick([
    `Beleza, chefe! A ${nome} tá cadastrada.\nAgora, pra registrar uma troca, manda pra mim assim:\nNome do cliente, carro, serviço feito hoje e o WhatsApp do cliente.\nExemplo: João Silva, Civic 2018, troca de óleo hoje, 41999990000.`,
    `Pronto, chefe! A ${nome} já tá cadastrada.\nPra registrar uma troca é só me mandar: nome do cliente, carro, serviço feito hoje e WhatsApp do cliente.\nExemplo: João Silva, Civic 2018, troca de óleo hoje, 41999990000.`,
  ]);
}

// ─── Operação: saudações e respostas neutras (onboarding-agent) ────────────
export function saudacaoTemporal(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
export const SAUDACAO_INICIAL = [
  (s: string) => `${s}. Posso registrar a troca por aqui.\nMe envie em uma mensagem: nome do cliente, carro, servico, data e WhatsApp.\n${EXEMPLO_CADASTRO}`,
  (s: string) => `${s}, tudo bem? Pode registrar a troca comigo.\nE so mandar: nome do cliente, carro, servico, data e WhatsApp do cliente.\n${EXEMPLO_CADASTRO}`,
  (s: string) => `${s}. Por aqui voce registra a troca rapidinho.\nManda em uma linha: nome, carro, servico, data e WhatsApp.\n${EXEMPLO_CADASTRO}`,
];
export const SAUDACAO_SUBSEQUENTE = [
  (s: string) => `${s}. Quando tiver uma troca pra registrar, e so mandar os dados do cliente.`,
  (s: string) => `${s} de novo. Estou por aqui, manda a proxima troca quando quiser.`,
  (s: string) => `${s}. Seguimos: e so me passar nome, carro, servico, data e WhatsApp.`,
];
export const AGRADECIMENTO_RESPOSTAS = [
  "Disponha. Quando tiver uma troca, e so mandar.",
  "Estou por aqui. Manda a proxima troca quando quiser.",
  "Combinado. Qualquer troca nova, e so me passar os dados.",
];
export const AJUDA_BODY = [
  "Aqui é o assistente da sua oficina 🛠️ Posso te ajudar com:",
  "• Registrar uma troca: manda nome do cliente, carro, serviço, data e WhatsApp.",
  "• Consultar: \"quantos lembretes saíram esse mês?\", \"próximos lembretes\", \"cliente Fulano\".",
  "Comandos: /suporte fala com o suporte.",
].join("\n");
export const lembretesMes = (n: number) =>
  n === 0 ? "Ainda não saiu nenhum lembrete este mês, chefe." : `Este mês já saíram ${n} ${n === 1 ? "lembrete" : "lembretes"} pros seus clientes, chefe.`;
export const proximosLembretes = (linhas: string[], dias: number) =>
  linhas.length === 0
    ? `Não tem lembrete pra sair nos próximos ${dias} dias, chefe. Tudo em dia por aqui!`
    : [linhas.length === 1 ? `Tem 1 lembrete pra sair nos próximos ${dias} dias:` : `Tem ${linhas.length} lembretes pra sair nos próximos ${dias} dias:`, ...linhas].join("\n");

// ─── Cliente final ─────────────────────────────────────────────────────────
export function corpoLembrete(tipo: string, cliente: string, oficina: string, veiculo: string): string {
  if (tipo === "amortecedor")
    return `Oi ${cliente}, aqui e da ${oficina}.\nJa faz um tempo que voce trocou os amortecedores do seu ${veiculo}. Recomendamos uma checagem. Quer agendar?`;
  if (tipo === "revisao") return `Oi ${cliente}, aqui e da ${oficina}.\nJa esta na hora da proxima revisao do seu ${veiculo}. Quer agendar?`;
  if (tipo === "outro") return `Oi ${cliente}, aqui e da ${oficina}.\nEsta na hora do proximo servico do seu ${veiculo}. Quer agendar?`;
  return `Oi ${cliente}, aqui e da ${oficina}.\nJa esta na hora da proxima troca de oleo do seu ${veiculo}.\nQuer agendar?`;
}
export const TEMPLATE_POR_TIPO: Record<string, string> = {
  troca_oleo: "lembrete_troca_oleo",
  amortecedor: "lembrete_amortecedor",
  revisao: "lembrete_revisao_geral",
  outro: "lembrete_revisao_geral",
};
export const PRODUTO_LABEL: Record<string, string> = {
  troca_oleo: "óleo",
  amortecedor: "amortecedor",
  revisao: "revisão",
  outro: "revisão",
};
export function corpoConfirmacaoServico(nome: string, produto: string, carro: string, oficina: string): string {
  return [
    `Oi ${nome}! Aqui é da Quando Trocar 😃`,
    `Registramos a troca de ${produto} do seu carro: ${carro}`,
    `No local: ${oficina}`,
    "Vamos te avisar quando estiver perto da próxima troca. Se precisar de algo, é só responder por aqui.",
  ].join("\n");
}

export type IntentCliente =
  | "opt_out" | "numero_errado" | "pergunta_preco" | "pergunta_horario" | "quer_agendar"
  | "quer_reagendar" | "ja_fez_servico" | "nao_tem_interesse" | "mensagem_indefinida";

export const RESPOSTA_BOT_CLIENTE: Record<IntentCliente, string> = {
  opt_out: "Tudo certo. Vou parar por aqui e nao envio mais lembretes.",
  numero_errado: "Entendi. Vou parar os lembretes para este numero.",
  pergunta_preco: "Vou avisar a oficina para falar com voce sobre valores.",
  pergunta_horario: "Vou avisar a oficina para confirmar os horarios com voce.",
  quer_agendar: "Perfeito. Vou avisar a oficina para seguir com voce pelo melhor horario.",
  quer_reagendar: "Perfeito. Vou avisar a oficina para seguir com voce pelo melhor horario.",
  ja_fez_servico: "Perfeito. Obrigado por avisar, vou registrar aqui.",
  nao_tem_interesse: "Tudo bem. Obrigado por responder.",
  mensagem_indefinida: "Recebi sua mensagem. Vou avisar a oficina para falar com voce.",
};
export const HANDOFF_REASON_CLIENTE: Partial<Record<IntentCliente, string>> = {
  pergunta_preco: "pergunta_preco",
  pergunta_horario: "pergunta_horario",
  quer_agendar: "pedido_agendamento",
  quer_reagendar: "pedido_agendamento",
  mensagem_indefinida: "mensagem_ambigua",
};

export const FALAS_CLIENTE: Record<IntentCliente, string[]> = {
  opt_out: ["parar", "não quero mais receber mensagem", "pode parar de mandar", "cancelar", "remover meu número por favor", "Nao quero"],
  numero_errado: ["acho que é engano, não tenho esse carro", "número errado", "quem é? não conheço essa oficina", "Engano, esse numero é novo"],
  pergunta_preco: ["quanto ta a troca de óleo?", "qual o valor?", "quanto fica com filtro?", "tá quanto a revisão?"],
  pergunta_horario: ["que horas vcs abrem?", "abre sábado?", "funciona no domingo?", "até que horas atende?"],
  quer_agendar: ["quero agendar sim", "pode marcar pra sexta?", "tem horário amanhã de manhã?", "vamos marcar", "Sim, posso ir na quinta", "bora, pode agendar"],
  quer_reagendar: ["consigo só semana que vem", "essa semana não dá, depois marco", "pode ser dia 15?"],
  ja_fez_servico: ["já troquei semana passada", "ja fiz, obrigado", "troquei em outro lugar", "já fiz a revisão", "Ja troquei o oleo"],
  nao_tem_interesse: ["não tenho interesse", "vendi o carro", "não preciso agora", "Não, obrigado"],
  mensagem_indefinida: ["?", "oi", "kk", "quem fala?", "ok", "👍", "depois vejo"],
};

// ─── Cobrança ──────────────────────────────────────────────────────────────
export const COBRANCA_SUSPENSO = "Seu acesso ao Quando Trocar esta suspenso por falta de pagamento. Para reativar, conclua o pagamento no link enviado pelo WhatsApp. Em caso de duvida, fale com o suporte.";
export const cobrancaPausado = (valor: string, vencimentoBR: string, link: string) =>
  `Seu acesso esta pausado por falta de pagamento. Em aberto: ${valor} (vencimento ${vencimentoBR}).\nLink: ${link}\nSe ja pagou ou precisa falar com a equipe, me avise.`;
export const cobrancaLink = (valor: string, vencimentoBR: string, link: string) =>
  `Voce tem ${valor} em aberto, com vencimento em ${vencimentoBR}.\nLink: ${link}`;
export const COBRANCA_JA_PAGUEI = "Vou conferir com a equipe e te aviso. Se confirmar, reativo seu acesso.";
export const COBRANCA_NEGOCIA = "Vou pedir para a equipe avaliar com voce. Te respondem por aqui.";
export const winbackAbertura = (nome: string) =>
  `Oi, ${nome}! Vi que voce pausou o uso do Quando Trocar. O que faltou para a gente? Posso pedir para a equipe te chamar para conversar.`;
export const WINBACK_NAO_VOLTA = "Tudo bem. Se precisar de algo, e so chamar por aqui. Obrigado!";
export const WINBACK_QUER_VOLTAR = "Que bom! Vou pedir para a equipe te chamar para reativar seu acesso.";

// ─── Falas dos leads por intent ────────────────────────────────────────────
export const FALAS_LEAD = {
  landing: ["oi quero testar o quando trocar", "Oi quero testar o Quando Trocar", "oi quero testar o quando trocar "],
  oi: ["oi", "Oi", "bom dia", "Boa tarde", "olá", "Ola, tudo bem?", "e ai", "boa noite", "Opa", "Oi tudo bem"],
  funcionamento: [
    "como funciona isso?", "como que funciona", "me explica como funciona", "vi o anúncio, como é?", "o que é o quando trocar?",
    "como funciona esse negócio de lembrete", "funciona como? o cliente recebe mensagem?", "Como funciona na prática",
    "Vi no instagram, como funciona", "queria entender melhor como funciona", "Me manda mais informação", "quero saber mais",
    "Como que faz pro cliente voltar?", "explica ai como é", "é tipo um sistema de agendamento?",
  ],
  funcionamento_dor: [
    "meu problema é que o cliente troca o óleo e some, como funciona?", "perco muito cliente que não volta, como isso funciona?",
    "o cliente esquece de voltar, vcs resolvem isso?", "aqui a gente anota em caderno e ninguém liga, como funciona?",
  ],
  preco: ["quanto custa?", "qual o valor", "quanto fica por mes", "e o preço?", "quanto sai por mês?", "Qual valor mensal", "e quanto custa isso", "tem mensalidade? quanto?", "preço?"],
  preco_insistente: ["mas quanto fica exatamente", "sim mas qual o valor final", "me passa o valor certo", "meu contador precisa do valor fechado", "não gosto desse a partir de, quanto é?", "então me passa uma faixa pelo menos"],
  volume_ticket: (v: number, t: number) => [
    `faço umas ${v} trocas por mes, ticket uns ${t} reais`, `${v} trocas/mes, ticket medio R$ ${t}`, `atendo uns ${v} carros por mês, cada troca sai ${t}`,
    `Uns ${v} serviços por mês, média de ${t} reais`, `${v} por mes. ticket ${t}`,
  ],
  volume_so: (v: number) => [`faço umas ${v} trocas por mes`, `${v} trocas por mês mais ou menos`, `atendo uns ${v} carros por mês`],
  ticket_so: (t: number) => [`ticket uns ${t} reais`, `média ${t} reais por troca`, `R$ ${t} mais ou menos`],
  faq: {
    teste: ["quanto tempo dura o teste?", "o teste é grátis mesmo?", "quantos dias de teste"],
    cartao: ["precisa de cartão pra testar?", "vai cobrar no cartão?"],
    fidelidade: ["tem fidelidade?", "tem contrato? multa?", "posso cancelar quando quiser?"],
    numero: ["a mensagem sai do meu número ou do de vocês?", "sai de qual whatsapp?"],
    ja_uso: ["já mando mensagem no whatsapp pros meus clientes, qual a diferença?", "ja faço isso manualmente"],
    nao_responde: ["e se o cliente não responder?", "e quando o cliente não responde a mensagem"],
    app: ["tem aplicativo?", "precisa baixar app?"],
    integracao: ["precisa integrar com meu sistema?", "funciona com o meu erp?"],
    pequena: ["funciona pra oficina pequena? sou eu sozinho", "tenho pouco movimento, serve?"],
    outros: ["serve pra amortecedor e revisão também?", "funciona só pra óleo?", "serve pra alinhamento?"],
    nota: ["tem nota fiscal?", "emite nota?"],
    ia: ["você é robô?", "to falando com uma IA?", "quem é você?"],
    spam: ["isso não é spam? e a lgpd?", "o cliente não vai achar chato?"],
    tempo: ["não tenho tempo pra mais um sistema", "muito corrido aqui, não paro"],
    caderno: ["já controlo no caderno", "anoto tudo no caderninho"],
    cliente_zap: ["meu cliente é mais velho, não usa whatsapp", "cliente não usa zap"],
  },
  quer_testar: ["quero testar", "bora testar", "pode ativar o teste", "vamos fazer o teste então", "quero testar sim", "Ok pode liberar o teste", "Vamos testar", "quero experimentar", "Bora, ativa ai", "pode cadastrar"],
  nome_oficina_wrap: (nome: string) => [nome, `${nome}`, `é a ${nome}`, `minha oficina se chama ${nome}`, `o nome é ${nome}`, `${nome} aqui de ${"{cidade}"}`],
  sem_interesse: ["não tenho interesse, obrigado", "nao quero", "não é pra mim", "obrigado mas não tenho interesse", "vou passar, valeu", "Não preciso disso", "Pode tirar meu numero"],
  vai_pensar: ["vou pensar e te falo", "deixa eu ver com meu sócio", "depois te falo", "vou analisar aqui", "me dá uns dias"],
  humano: ["quero falar com uma pessoa", "passa pro anderson", "tem como falar com um humano?", "me liga", "quero falar com alguém do comercial"],
  neutro: ["ok", "blz", "entendi", "certo", "ta bom", "beleza", "hmm", "ah ta"],
  social: ["kkkk", "testando", "?", "kk", "rs", "...", "."],
  small_talk: ["viu o jogo ontem?", "e o corinthians hein", "ta calor ai?", "kkk que horas voce almoça"],
  rede: ["tenho 4 filiais, funciona pra rede?", "somos uma franquia, atende matriz e filial?"],
  corrigir: ["corrigir", "errei o carro"],
  correcoes: ["o carro é Gol 2015", "o telefone certo é {fone}", "o nome é {nome}", "é revisão, não troca de óleo", "a data foi ontem"],
  cadastro_formatos: [
    "{nome}, {carro}, {servico} hoje, {fone}",
    "{nome} {carro} {servico} hoje {fone}",
    "{nome}, {carro}, {servico}, hoje, {fone}",
    "cliente {nome}, {carro}, fiz {servico} hoje, zap {fone}",
    "{nome} - {carro} - {servico} - {data} - {fone}",
    "Troca do {nomeP}: {carro}, {servico}, {fone}",
    "{nome}, {fone}, {carro}, {servico} {data}",
    "cadastra ai: {nome} {fone} {carro} {servico} hoje",
    "{nome}\n{carro}\n{servico}\n{fone}",
    "acabei de fazer {servico} no {carro} do {nome}, {fone}, hoje",
  ],
  cadastro_audio: [
    "ó então, troquei o {servico} do {nomeP} hoje, ele tem um {carro}, o telefone dele é {fone}",
    "bom dia, cadastra aí o {nome}, {carro}, fiz {servico} agora de manhã, o zap é {fone}",
    "então o cliente {nome} veio hoje fez {servico} no {carro} dele o número {fone}",
  ],
  oficina_saudacao: ["bom dia", "boa tarde", "Oi", "opa", "e ai", "Boa noite"],
  oficina_agradece: ["valeu", "obrigado", "show", "top", "ok obrigado", "beleza valeu"],
  oficina_consulta_mes: ["quantos lembretes saíram esse mês?", "quantas mensagens foram esse mes", "quantos lembretes ja saiu"],
  oficina_consulta_proximos: ["próximos lembretes", "quem vai receber lembrete essa semana?", "quais lembretes vão sair"],
  oficina_ajuda: ["/ajuda", "ajuda", "como faz pra cadastrar?"],
  cobranca_inad: ["oi, não consigo cadastrar", "por que travou?", "manda o link de novo", "ja paguei ontem", "posso pagar semana que vem?", "quero cadastrar um cliente"],
};

export const NOMES_SERVICO: Record<string, string[]> = {
  troca_oleo: ["troca de óleo", "troca de oleo", "óleo e filtro", "troca de óleo e filtro", "oleo", "troca de óleo 5w30"],
  amortecedor: ["amortecedor", "troca de amortecedor", "amortecedores dianteiros", "par de amortecedor traseiro", "amortecedor {marca}"],
  revisao: ["revisão", "revisão geral", "revisão completa", "revisão dos 10 mil", "revisao"],
  outro: ["pastilha de freio", "alinhamento e balanceamento", "correia dentada", "bateria", "filtro de ar", "velas"],
};

export const PERGUNTAS_SEM_RESPOSTA = [
  "vocês fazem integração com o sistema da Bosch?", "tem desconto pra pagar anual?", "funciona pra moto?",
  "posso usar em duas oficinas com o mesmo número?", "dá pra mandar foto do orçamento pelo sistema?",
  "vocês têm suporte por telefone?", "o cliente consegue agendar sozinho?", "consigo importar minha planilha de clientes?",
  "tem relatório de quanto voltou?", "serve pra caminhão?", "posso mudar o texto do lembrete?", "o lembrete sai em qual horário?",
  "aceita pix?", "tem versão em espanhol?", "consigo mandar promoção pros clientes?", "funciona com telefone fixo?",
  "vocês são de onde?", "dá pra colocar o logo da oficina na mensagem?", "e se eu trocar de número?", "tem limite de clientes?",
];
export const RESPOSTA_DONT_KNOW =
  "Essa eu não sei te responder agora chefe. Vou deixar registrado e alguém do time te responde por aqui. Se quiser, já ativo o teste de 14 dias gratis.";
