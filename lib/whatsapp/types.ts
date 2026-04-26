export type LeadStatus =
  | "novo"
  | "em_conversa"
  | "qualificado"
  | "interessado"
  | "teste_aceito"
  | "convertido"
  | "perdido";

export type LeadOrigin = "landing_page" | "manual_whatsapp";

export type ParticipantType =
  | "lead_oficina"
  | "oficina_cliente"
  | "cliente_final"
  | "contato_desconhecido";

export type ConversationAgentMode =
  | "vendas"
  | "onboarding"
  | "operacao"
  | "cliente_final_lembrete"
  | "suporte";

export type SalesIntent =
  | "pergunta_funcionamento"
  | "informa_volume_ticket"
  | "quer_testar"
  | "sem_interesse"
  | "fora_escopo";

export type SalesClassification = {
  intent: SalesIntent;
  confidence: number;
  monthlyChanges?: number;
  averageTicket?: number;
};

export type RoiCalculation = {
  monthlyChanges: number;
  averageTicket: number;
  recoveryRate: number;
  recoveredRevenue: number;
};

export type ToolCallRecord = {
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type AgentReply = {
  body: string;
  status: LeadStatus;
  toolCalls: ToolCallRecord[];
  convertToOficina?: boolean;
};

export type ServiceDraft = {
  nome_cliente?: string;
  whatsapp_cliente?: string;
  veiculo?: string;
  servico?: string;
  data_servico?: string;
  valor?: number | null;
  consentimento_whatsapp?: boolean;
};

export type ConversationContext = {
  pending_action?: "registrar_primeira_troca";
  missing_field?:
    | "nome_cliente"
    | "whatsapp_cliente"
    | "veiculo"
    | "servico"
    | "data_servico";
  service_draft?: ServiceDraft;
};

export type RegisterServiceInput = {
  oficinaId: string;
  nomeCliente: string;
  whatsappCliente: string;
  veiculo: string;
  servico: string;
  dataServico: string;
  valor: number | null;
  consentimentoWhatsapp: boolean;
};

export type RegisteredService = {
  clienteId: string;
  veiculoId: string;
  servicoId: string;
  lembreteId: string | null;
};

export type InboundWhatsappMessage = {
  providerEventId: string;
  whatsappMessageId: string;
  from: string;
  normalizedFrom: string;
  contactName: string | null;
  body: string;
  timestamp: Date | null;
  rawMessage: Record<string, unknown>;
};

export type SavedWhatsappEvent = {
  duplicate: boolean;
  eventId: string | null;
};

export type SavedLead = {
  id: string;
  status: LeadStatus;
  nome?: string | null;
  metadata?: Record<string, unknown>;
};

export type SavedConversation = {
  id: string;
  leadId?: string | null;
  oficinaId?: string | null;
  clienteId?: string | null;
  participantType?: ParticipantType;
  agentMode?: ConversationAgentMode;
  context?: ConversationContext;
};

export type SavedMessage = {
  duplicate: boolean;
  messageId: string | null;
};

export type WhatsappRepository = {
  saveWhatsappEvent(input: {
    providerEventId: string | null;
    whatsappMessageId: string | null;
    payload: unknown;
  }): Promise<SavedWhatsappEvent>;
  upsertLead(input: {
    whatsapp: string;
    nome: string | null;
    origem: LeadOrigin;
    status: LeadStatus;
  }): Promise<SavedLead>;
  upsertConversation(input: {
    leadId: string | null;
    whatsapp: string;
  }): Promise<SavedConversation>;
  getOficinaByWhatsapp?(input: {
    whatsapp: string;
  }): Promise<{
    id: string;
    nome: string;
    whatsappPrincipal: string;
    diasLembretePadrao: number;
  } | null>;
  getConversationByWhatsapp?(input: {
    whatsapp: string;
  }): Promise<SavedConversation | null>;
  upsertSalesLeadConversation?(input: {
    leadId: string | null;
    whatsapp: string;
  }): Promise<SavedConversation>;
  upsertOficinaConversation?(input: {
    oficinaId: string;
    whatsapp: string;
    agentMode?: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context?: ConversationContext;
  }): Promise<SavedConversation>;
  updateConversationModeAndContext?(input: {
    conversationId: string;
    agentMode?: ConversationAgentMode;
    context?: ConversationContext;
  }): Promise<void>;
  convertLeadToOficina?(input: {
    leadId: string;
    conversationId: string;
    whatsapp: string;
    responsavel: string | null;
    nomeOficina: string | null;
  }): Promise<{
    oficinaId: string;
    nome: string;
    diasLembretePadrao: number;
  }>;
  registerServiceWithReminder?(input: RegisterServiceInput): Promise<RegisteredService>;
  saveInboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    whatsappMessageId: string;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
  }): Promise<SavedMessage>;
  saveOutboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    whatsappMessageId: string | null;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
  }): Promise<SavedMessage>;
  saveAgentToolCall(input: {
    conversationId: string;
    leadId: string | null;
    toolName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<void>;
  markWhatsappEventProcessed(input: {
    eventId: string;
  }): Promise<void>;
  markWhatsappEventFailed(input: {
    eventId: string;
    errorType: string;
    errorMessage: string;
    errorContext: Record<string, unknown>;
  }): Promise<void>;
  updateLeadStatus(input: {
    leadId: string;
    status: LeadStatus;
  }): Promise<void>;
  createOutboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    to: string;
    body: string;
  }): Promise<{ id: string }>;
  markOutboundSent(input: {
    outboundMessageId: string;
    whatsappMessageId: string;
    response: unknown;
  }): Promise<void>;
  markOutboundFailed(input: {
    outboundMessageId: string;
    errorMessage: string;
  }): Promise<void>;
};

export type WhatsappSender = {
  sendTextMessage(input: { to: string; body: string }): Promise<{
    whatsappMessageId: string;
    response?: unknown;
  }>;
};

export type SalesAgent = {
  generateReply(input: {
    message: string;
    leadStatus: LeadStatus;
  }): Promise<AgentReply>;
};

export type OnboardingAgent = {
  generateReply(input: {
    message: string;
    mode: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context: ConversationContext;
    today: string;
  }): Promise<OnboardingAgentReply>;
};

export type OnboardingAgentReply = {
  body: string;
  context: ConversationContext;
  registerServiceInput: Omit<RegisterServiceInput, "oficinaId"> | null;
  nextAgentMode: Extract<ConversationAgentMode, "onboarding" | "operacao"> | null;
  toolCalls: ToolCallRecord[];
};
