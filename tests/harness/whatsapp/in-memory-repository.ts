// Implementação em memória do `WhatsappRepository`.
//
// É a ÚNICA implementação fake do repositório no projeto: o REPL, o runner de
// eval e o simulador de persona consomem daqui. Não usa vitest — é TS puro,
// para rodar tanto sob `tsx` quanto sob `vitest`.
//
// Cobre os fluxos de vendas, onboarding/operação, cliente final e callbacks de
// status. Os 4 métodos do gate do router (`getOficinaByWhatsapp`,
// `getConversationByWhatsapp`, `upsertOficinaConversation`,
// `upsertSalesLeadConversation`) são obrigatórios: sem eles
// `conversation-router.ts` cai no caminho legado só-vendas.

import type {
  ClienteResumo,
  ConfiguracoesVendedor,
  ConversationAgentMode,
  ConversationContext,
  FaqVendasRecord,
  LeadStatus,
  ParticipantType,
  RecentMessage,
  RegisterServiceInput,
  RegisteredService,
  SavedConversation,
  SavedLead,
  SavedMessage,
  SavedWhatsappEvent,
  ToolCallRecord,
  UpcomingReminder,
  WhatsappRepository,
} from "@/lib/whatsapp/types";

import type { WorldSeed, WorldSnapshot } from "./types";

type LeadRow = {
  id: string;
  whatsapp: string;
  nome: string | null;
  nomeOficina: string | null;
  nomeResponsavel: string | null;
  status: LeadStatus;
  metadata: Record<string, unknown>;
};

type ConversationRow = {
  id: string;
  whatsapp: string;
  leadId: string | null;
  oficinaId: string | null;
  clienteId: string | null;
  participantType: ParticipantType;
  agentMode: ConversationAgentMode | null;
  context: ConversationContext;
  handoffReason: string | null;
  botMutedUntil: number | null;
};

type OficinaRow = {
  id: string;
  nome: string;
  whatsappPrincipal: string;
  diasLembretePadrao: number;
};

type ClienteRow = {
  id: string;
  oficinaId: string;
  nome: string;
  whatsapp: string;
  status: "ativo" | "opt_out" | "numero_errado";
};

type LembreteRow = {
  id: string;
  clienteId: string;
  oficinaId: string;
  veiculo: string;
  status: string;
  scheduledAt: string;
};

type MessageRow = {
  conversationId: string;
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string | null;
};

const DEFAULT_SALES_CONFIG: ConfiguracoesVendedor = {
  taxaRecuperacaoRoi: 0.1,
  whatsappHandoffComercial: "+5511999990099",
  frasesLanding: ["oi quero testar o quando trocar"],
  precoPartida: 59,
  geracaoLlmModo: "off",
};

export type InMemoryRepositoryOptions = {
  seed?: WorldSeed;
  salesConfig?: Partial<ConfiguracoesVendedor>;
  faqs?: FaqVendasRecord[];
};

export type InMemoryWhatsappRepository = WhatsappRepository & {
  /** Snapshot do estado observável — base do `stateDiff` de cada turno. */
  snapshot(): WorldSnapshot;
  /** Tool calls gravadas desde a última drenagem. */
  drainToolCalls(): ToolCallRecord[];
  /** Acesso direto ao estado, para o comando `/estado` do REPL. */
  dump(): {
    leads: LeadRow[];
    conversations: ConversationRow[];
    oficinas: OficinaRow[];
    clientes: ClienteRow[];
    lembretes: LembreteRow[];
    messages: MessageRow[];
  };
};

export function createInMemoryRepository(
  options: InMemoryRepositoryOptions = {},
): InMemoryWhatsappRepository {
  const seed = options.seed ?? {};
  const salesConfig: ConfiguracoesVendedor = { ...DEFAULT_SALES_CONFIG, ...options.salesConfig };
  const faqs = options.faqs ?? [];

  const leads = new Map<string, LeadRow>();
  const conversations = new Map<string, ConversationRow>();
  const oficinas = new Map<string, OficinaRow>();
  const clientes = new Map<string, ClienteRow>();
  const lembretes = new Map<string, LembreteRow>();
  const messages: MessageRow[] = [];
  const events = new Set<string>();
  const inboundMessageIds = new Set<string>();
  const outbound = new Map<string, { id: string; status: string; whatsappMessageId: string | null }>();
  let toolCalls: ToolCallRecord[] = [];
  let servicosRegistrados = 0;

  // Contadores determinísticos: sem Math.random, para o mesmo roteiro produzir
  // sempre os mesmos ids (diff de eval entre execuções fica legível).
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;

  const now = () => new Date().toISOString();

  // ─── Seed do mundo ────────────────────────────────────────────────────────

  const from = seed.from ?? "5511999990001";
  const normalized = `+${from}`;

  if (seed.profile === "oficina" || seed.profile === "cliente_final") {
    const oficina: OficinaRow = {
      id: "oficina-seed",
      nome: seed.oficinaNome ?? "Auto Center Exemplo",
      whatsappPrincipal: seed.profile === "oficina" ? normalized : "+5511999990050",
      diasLembretePadrao: 90,
    };
    oficinas.set(oficina.id, oficina);

    if (seed.profile === "oficina") {
      conversations.set("conversa-seed", {
        id: "conversa-seed",
        whatsapp: normalized,
        leadId: null,
        oficinaId: oficina.id,
        clienteId: null,
        participantType: "oficina_cliente",
        agentMode: seed.agentMode ?? "onboarding",
        context: seed.context ?? {},
        handoffReason: null,
        botMutedUntil: null,
      });
    } else {
      const cliente: ClienteRow = {
        id: "cliente-seed",
        oficinaId: oficina.id,
        nome: "Carlos Silva",
        whatsapp: normalized,
        status: "ativo",
      };
      clientes.set(cliente.id, cliente);

      const lembreteId = seed.lembrete?.id ?? "lembrete-seed";
      lembretes.set(lembreteId, {
        id: lembreteId,
        clienteId: cliente.id,
        oficinaId: oficina.id,
        veiculo: seed.lembrete?.veiculo ?? "Onix 2018",
        status: seed.lembrete?.status ?? "enviado",
        scheduledAt: now(),
      });

      conversations.set("conversa-seed", {
        id: "conversa-seed",
        whatsapp: normalized,
        leadId: null,
        oficinaId: oficina.id,
        clienteId: cliente.id,
        participantType: "cliente_final",
        agentMode: "cliente_final_lembrete",
        context: { lastReminderId: lembreteId, ...seed.context },
        handoffReason: null,
        botMutedUntil: null,
      });
    }
  } else if (seed.leadStatus || seed.context) {
    // Lead com estado inicial explícito. Sem isso, o lead nasce no primeiro
    // `upsertLead` do webhook, que é o caminho mais fiel.
    const lead: LeadRow = {
      id: "lead-seed",
      whatsapp: normalized,
      nome: seed.contactName ?? null,
      nomeOficina: null,
      nomeResponsavel: null,
      status: seed.leadStatus ?? "novo",
      metadata: {},
    };
    leads.set(lead.id, lead);
    conversations.set("conversa-seed", {
      id: "conversa-seed",
      whatsapp: normalized,
      leadId: lead.id,
      oficinaId: null,
      clienteId: null,
      participantType: "lead_oficina",
      agentMode: "vendas",
      context: seed.context ?? {},
      handoffReason: null,
      botMutedUntil: null,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const findConversationByWhatsapp = (whatsapp: string) =>
    [...conversations.values()].find((c) => c.whatsapp === whatsapp) ?? null;

  const toSavedConversation = (row: ConversationRow): SavedConversation => ({
    id: row.id,
    leadId: row.leadId,
    oficinaId: row.oficinaId,
    clienteId: row.clienteId,
    participantType: row.participantType,
    agentMode: row.agentMode ?? undefined,
    context: row.context,
  });

  // ─── Repositório ──────────────────────────────────────────────────────────

  const repository: InMemoryWhatsappRepository = {
    // ── Eventos / idempotência ──
    async saveWhatsappEvent(input): Promise<SavedWhatsappEvent> {
      const key = input.providerEventId ?? input.whatsappMessageId;
      if (key && events.has(key)) return { duplicate: true, eventId: key };
      if (key) events.add(key);
      return { duplicate: false, eventId: key ?? nextId("event") };
    },
    async markWhatsappEventProcessed() {},
    async markWhatsappEventFailed() {},

    // ── Leads ──
    async upsertLead(input): Promise<SavedLead> {
      const existing = [...leads.values()].find((l) => l.whatsapp === input.whatsapp);
      if (existing) {
        if (input.nome && !existing.nome) existing.nome = input.nome;
        return {
          id: existing.id,
          status: existing.status,
          nome: existing.nome,
          metadata: existing.metadata,
        };
      }
      const lead: LeadRow = {
        id: nextId("lead"),
        whatsapp: input.whatsapp,
        nome: input.nome,
        nomeOficina: null,
        nomeResponsavel: null,
        status: input.status,
        metadata: {},
      };
      leads.set(lead.id, lead);
      return { id: lead.id, status: lead.status, nome: lead.nome, metadata: lead.metadata };
    },
    async updateLeadStatus(input) {
      const lead = leads.get(input.leadId);
      if (lead) lead.status = input.status;
    },
    async captureLeadWorkshopIdentity(input) {
      const lead = leads.get(input.leadId);
      if (!lead) return { nomeOficina: input.nomeOficina, nomeResponsavel: null };
      lead.nomeOficina = input.nomeOficina;
      if (!lead.nomeResponsavel && lead.nome) lead.nomeResponsavel = lead.nome;
      return { nomeOficina: lead.nomeOficina, nomeResponsavel: lead.nomeResponsavel };
    },
    async convertLeadToOficina(input) {
      const lead = leads.get(input.leadId);
      if (lead) lead.status = "convertido";
      const oficina: OficinaRow = {
        id: nextId("oficina"),
        nome: input.nomeOficina ?? "Oficina sem nome",
        whatsappPrincipal: input.whatsapp,
        diasLembretePadrao: 90,
      };
      oficinas.set(oficina.id, oficina);
      const conversation = conversations.get(input.conversationId);
      if (conversation) {
        conversation.oficinaId = oficina.id;
        conversation.leadId = null;
        conversation.participantType = "oficina_cliente";
        conversation.agentMode = "onboarding";
      }
      return { oficinaId: oficina.id, nome: oficina.nome, diasLembretePadrao: oficina.diasLembretePadrao };
    },

    // ── Conversas (inclui os 4 métodos do gate do router) ──
    async upsertConversation(input): Promise<SavedConversation> {
      const existing = findConversationByWhatsapp(input.whatsapp);
      if (existing) return toSavedConversation(existing);
      const row: ConversationRow = {
        id: nextId("conversa"),
        whatsapp: input.whatsapp,
        leadId: input.leadId,
        oficinaId: null,
        clienteId: null,
        participantType: "lead_oficina",
        agentMode: "vendas",
        context: {},
        handoffReason: null,
        botMutedUntil: null,
      };
      conversations.set(row.id, row);
      return toSavedConversation(row);
    },
    async upsertSalesLeadConversation(input): Promise<SavedConversation> {
      const existing = findConversationByWhatsapp(input.whatsapp);
      if (existing) {
        existing.leadId = input.leadId;
        existing.participantType = "lead_oficina";
        existing.agentMode = existing.agentMode ?? "vendas";
        return toSavedConversation(existing);
      }
      return repository.upsertConversation(input);
    },
    async upsertOficinaConversation(input): Promise<SavedConversation> {
      const existing = findConversationByWhatsapp(input.whatsapp);
      if (existing) {
        existing.oficinaId = input.oficinaId;
        existing.participantType = "oficina_cliente";
        if (input.agentMode) existing.agentMode = input.agentMode;
        if (input.context) existing.context = { ...existing.context, ...input.context };
        return toSavedConversation(existing);
      }
      const row: ConversationRow = {
        id: nextId("conversa"),
        whatsapp: input.whatsapp,
        leadId: null,
        oficinaId: input.oficinaId,
        clienteId: null,
        participantType: "oficina_cliente",
        agentMode: input.agentMode ?? "onboarding",
        context: input.context ?? {},
        handoffReason: null,
        botMutedUntil: null,
      };
      conversations.set(row.id, row);
      return toSavedConversation(row);
    },
    async getConversationByWhatsapp(input) {
      const row = findConversationByWhatsapp(input.whatsapp);
      return row ? toSavedConversation(row) : null;
    },
    async getOficinaByWhatsapp(input) {
      const oficina = [...oficinas.values()].find((o) => o.whatsappPrincipal === input.whatsapp);
      return oficina ? { ...oficina } : null;
    },
    async getOficinaById(input) {
      const oficina = oficinas.get(input.oficinaId);
      return oficina ? { ...oficina } : null;
    },
    async findClienteFinalConversationByWhatsapp(input) {
      const row = findConversationByWhatsapp(input.whatsapp);
      return row && row.participantType === "cliente_final" ? toSavedConversation(row) : null;
    },
    async findReminderConversationByWhatsapp(input) {
      const row = findConversationByWhatsapp(input.whatsapp);
      return row && row.clienteId ? toSavedConversation(row) : null;
    },
    async upsertSupportConversation(input): Promise<SavedConversation> {
      const existing = findConversationByWhatsapp(input.whatsapp);
      if (existing) {
        existing.participantType = "contato_desconhecido";
        existing.agentMode = "suporte";
        return toSavedConversation(existing);
      }
      const row: ConversationRow = {
        id: nextId("conversa"),
        whatsapp: input.whatsapp,
        leadId: null,
        oficinaId: null,
        clienteId: null,
        participantType: "contato_desconhecido",
        agentMode: "suporte",
        context: input.context ?? {},
        handoffReason: null,
        botMutedUntil: null,
      };
      conversations.set(row.id, row);
      return toSavedConversation(row);
    },
    async upsertClienteFinalConversation(input): Promise<SavedConversation> {
      const existing = findConversationByWhatsapp(input.whatsapp);
      if (existing) {
        existing.oficinaId = input.oficinaId;
        existing.clienteId = input.clienteId;
        existing.participantType = "cliente_final";
        existing.agentMode = "cliente_final_lembrete";
        if (input.context) existing.context = { ...existing.context, ...input.context };
        return toSavedConversation(existing);
      }
      const row: ConversationRow = {
        id: nextId("conversa"),
        whatsapp: input.whatsapp,
        leadId: null,
        oficinaId: input.oficinaId,
        clienteId: input.clienteId,
        participantType: "cliente_final",
        agentMode: "cliente_final_lembrete",
        context: input.context ?? {},
        handoffReason: null,
        botMutedUntil: null,
      };
      conversations.set(row.id, row);
      return toSavedConversation(row);
    },
    async updateConversationModeAndContext(input) {
      const row = conversations.get(input.conversationId);
      if (!row) return;
      if (input.agentMode) row.agentMode = input.agentMode;
      if (input.context) row.context = input.context;
    },
    async markConversationHandoff(input) {
      const row = conversations.get(input.conversationId);
      if (!row) return;
      row.handoffReason = input.reason;
      row.botMutedUntil = Date.now() + 24 * 60 * 60 * 1000;
    },
    async isBotMuted(input) {
      const row = conversations.get(input.conversationId);
      return Boolean(row?.botMutedUntil && row.botMutedUntil > Date.now());
    },

    // ── Oficina ──
    async updateOficinaNome(input) {
      const oficina = oficinas.get(input.oficinaId);
      if (oficina) oficina.nome = input.nome;
    },

    // ── Mensagens ──
    async saveInboundMessage(input): Promise<SavedMessage> {
      if (inboundMessageIds.has(input.whatsappMessageId)) {
        return { duplicate: true, messageId: input.whatsappMessageId };
      }
      inboundMessageIds.add(input.whatsappMessageId);
      messages.push({
        conversationId: input.conversationId,
        direction: "inbound",
        body: input.transcription ?? input.body,
        sentAt: input.sentAt,
      });
      return { duplicate: false, messageId: input.whatsappMessageId };
    },
    async saveOutboundMessage(input): Promise<SavedMessage> {
      messages.push({
        conversationId: input.conversationId,
        direction: "outbound",
        body: input.body,
        sentAt: input.sentAt,
      });
      return { duplicate: false, messageId: input.whatsappMessageId ?? nextId("msg") };
    },
    async listRecentMessages(input): Promise<RecentMessage[]> {
      return messages
        .filter((m) => m.conversationId === input.conversationId)
        .slice(-input.limit)
        .map((m) => ({ direction: m.direction, body: m.body, sentAt: m.sentAt }));
    },

    // ── Outbox ──
    async createOutboundMessage() {
      const id = nextId("outbound");
      outbound.set(id, { id, status: "pendente", whatsappMessageId: null });
      return { id };
    },
    async markOutboundSent(input) {
      const row = outbound.get(input.outboundMessageId);
      if (row) {
        row.status = "enviado";
        row.whatsappMessageId = input.whatsappMessageId;
      }
    },
    async markOutboundFailed(input) {
      const row = outbound.get(input.outboundMessageId);
      if (row) row.status = "erro_envio";
    },
    async updateMessageStatusByWhatsappMessageId() {},
    async updateOutboundStatusByWhatsappMessageId() {},
    async updateReminderDeliveryStatusByWhatsappMessageId() {},
    async saveMetaPhoneStatus() {},

    // ── Auditoria ──
    async saveAgentToolCall(input) {
      toolCalls.push({ toolName: input.toolName, input: input.input, output: input.output });
    },
    async savePerguntaSemResposta() {},
    async saveSalesIntentDivergence() {},
    async listActiveSalesIntentTriggers() {
      return [];
    },

    // ── Cadastro de serviço ──
    async registerServiceWithReminder(input: RegisterServiceInput): Promise<RegisteredService> {
      servicosRegistrados += 1;
      const clienteId = nextId("cliente");
      clientes.set(clienteId, {
        id: clienteId,
        oficinaId: input.oficinaId,
        nome: input.nomeCliente,
        whatsapp: input.whatsappCliente,
        status: "ativo",
      });
      const diasLembrete = 90;
      const scheduledAt = input.consentimentoWhatsapp
        ? new Date(Date.now() + diasLembrete * 24 * 60 * 60 * 1000).toISOString()
        : null;
      let lembreteId: string | null = null;
      if (scheduledAt) {
        lembreteId = nextId("lembrete");
        lembretes.set(lembreteId, {
          id: lembreteId,
          clienteId,
          oficinaId: input.oficinaId,
          veiculo: input.veiculo,
          status: "pendente",
          scheduledAt,
        });
      }
      return {
        clienteId,
        veiculoId: nextId("veiculo"),
        servicoId: nextId("servico"),
        lembreteId,
        scheduledAt,
        diasLembrete,
      };
    },

    // ── Cliente final / lembretes ──
    async updateClienteFinalStatus(input) {
      const cliente = clientes.get(input.clienteId);
      if (cliente) cliente.status = input.status;
    },
    async cancelFutureRemindersForCliente(input) {
      let count = 0;
      for (const lembrete of lembretes.values()) {
        if (lembrete.clienteId === input.clienteId && lembrete.status === "pendente") {
          lembrete.status = "cancelado";
          count += 1;
        }
      }
      return count;
    },
    async updateReminderStatus(input) {
      const lembrete = lembretes.get(input.reminderId);
      if (lembrete) lembrete.status = input.status;
    },

    // ── Consultas read-only da operação (CV6) ──
    async listUpcomingReminders(input): Promise<UpcomingReminder[]> {
      return [...lembretes.values()]
        .filter((l) => l.oficinaId === input.oficinaId && l.status === "pendente")
        .slice(0, input.limit ?? 10)
        .map((l) => ({
          clienteNome: clientes.get(l.clienteId)?.nome ?? "Cliente",
          veiculo: l.veiculo,
          scheduledAt: l.scheduledAt,
        }));
    },
    async countRemindersSentThisMonth() {
      return [...lembretes.values()].filter((l) => l.status === "enviado").length;
    },
    async getClienteResumo(input): Promise<ClienteResumo | null> {
      const alvo = input.nomeOuTelefone.toLowerCase();
      const cliente = [...clientes.values()].find(
        (c) =>
          c.oficinaId === input.oficinaId &&
          (c.nome.toLowerCase().includes(alvo) || c.whatsapp.includes(alvo)),
      );
      if (!cliente) return null;
      return {
        nome: cliente.nome,
        whatsapp: cliente.whatsapp,
        status: cliente.status,
        totalServicos: 1,
        ultimoServico: null,
        proximoLembreteAt: null,
      };
    },
    async countInboundMediaInLastDay() {
      return 0;
    },
    async getLatestPendingPagamento() {
      return null;
    },

    // ── Configuração / FAQ ──
    async getConfiguracoesVendedor() {
      return salesConfig;
    },
    async listActiveFaqs() {
      return faqs;
    },

    // ── Observabilidade do harness ──
    snapshot(): WorldSnapshot {
      return {
        leads: Object.fromEntries(
          [...leads.values()].map((l) => [
            l.id,
            { status: l.status, nome: l.nome, nomeOficina: l.nomeOficina },
          ]),
        ),
        conversations: Object.fromEntries(
          [...conversations.values()].map((c) => [
            c.id,
            {
              agentMode: c.agentMode,
              context: structuredClone(c.context),
              handoffReason: c.handoffReason,
              botMuted: Boolean(c.botMutedUntil && c.botMutedUntil > Date.now()),
            },
          ]),
        ),
        oficinas: Object.fromEntries([...oficinas.values()].map((o) => [o.id, { nome: o.nome }])),
        clientes: Object.fromEntries([...clientes.values()].map((c) => [c.id, { status: c.status }])),
        lembretes: Object.fromEntries([...lembretes.values()].map((l) => [l.id, { status: l.status }])),
        servicosRegistrados,
      };
    },
    drainToolCalls() {
      const drained = toolCalls;
      toolCalls = [];
      return drained;
    },
    dump() {
      return {
        leads: [...leads.values()],
        conversations: [...conversations.values()],
        oficinas: [...oficinas.values()],
        clientes: [...clientes.values()],
        lembretes: [...lembretes.values()],
        messages: [...messages],
      };
    },
  };

  return repository;
}
