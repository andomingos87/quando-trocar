export type LeadStatus = "novo" | "em_conversa" | "qualificado" | "interessado" | "perdido";

export type LeadOrigin = "landing_page" | "manual_whatsapp";

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
};

export type SavedConversation = {
  id: string;
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
  saveInboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    whatsappMessageId: string;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
  }): Promise<SavedMessage>;
  saveOutboundMessage(input: {
    conversationId: string;
    leadId: string | null;
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
