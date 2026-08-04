// Contratos do harness de teste conversacional do bot WhatsApp.
//
// O harness roda o webhook REAL (`createWhatsappWebhookHandlers`) contra um
// repositório em memória e um sender que só grava. Nada sai para a Meta nem
// para o Supabase. O produto observável é o `TurnObservation`: o que o
// WhatsApp nunca mostra — intent aplicado, transição de estado, tool calls e
// auditoria da camada de geração.

import type {
  AgentReply,
  ConversationAgentMode,
  ConversationContext,
  GeracaoLlmModo,
  InboundMediaType,
  LeadStatus,
  OnboardingAgentReply,
  ReminderAgentReply,
  SalesButton,
  ServiceDraft,
  ToolCallRecord,
} from "@/lib/whatsapp/types";

/** Qual agente foi invocado no turno. Espelha `ConversationAgentMode`. */
export type AgentKind =
  | "sales"
  | "onboarding"
  | "reminder"
  | "concierge"
  | "support"
  | "cobranca";

/**
 * Uma invocação de agente gravada pelo decorator. `reply` é o objeto CRU —
 * é a única forma de observar `registerServiceInput`, `handoffRequired`,
 * `clienteStatus` e `updatedContext`, que não aparecem no texto enviado.
 */
export type AgentInvocation = {
  kind: AgentKind;
  input: unknown;
  reply: AgentReply | OnboardingAgentReply | ReminderAgentReply | unknown;
  durationMs: number;
  error: { message: string; stack: string | null } | null;
};

/** Uma mensagem que o sender fake recebeu, na ordem em que o webhook enviou. */
export type DeliveredMessage =
  | { kind: "text"; to: string; body: string }
  | {
      kind: "template";
      to: string;
      templateName: string;
      languageCode: string;
      bodyParameters: string[];
      bodyParameterNames?: string[];
    }
  | {
      kind: "interactive";
      to: string;
      body: string;
      buttons: ReadonlyArray<SalesButton>;
    };

/**
 * Estado observável do mundo depois de um turno. É daqui que saem
 * `status_after`, `lembrete_status_after`, `service_draft` e opt-out — por
 * observação de estado, não por adivinhação de nome de tool call.
 */
export type WorldSnapshot = {
  leads: Record<string, { status: LeadStatus; nome: string | null; nomeOficina: string | null }>;
  conversations: Record<
    string,
    {
      agentMode: ConversationAgentMode | null;
      context: ConversationContext;
      handoffReason: string | null;
      botMuted: boolean;
    }
  >;
  oficinas: Record<string, { nome: string }>;
  clientes: Record<string, { status: "ativo" | "opt_out" | "numero_errado" }>;
  lembretes: Record<string, { status: string }>;
  servicosRegistrados: number;
};

/** Diferença entre dois snapshots, em caminho pontilhado → [antes, depois]. */
export type WorldDiff = Record<string, [unknown, unknown]>;

export type TurnObservation = {
  turn: number;
  userMessage: string;
  mediaType: InboundMediaType;
  httpStatus: number;
  responseBody: unknown;
  /** Modo resolvido pelo router — não é configurado, é observado. */
  agentMode: ConversationAgentMode | null;
  agentInvocations: AgentInvocation[];
  delivered: DeliveredMessage[];
  /** Texto concatenado do que foi entregue. É isto que `reply_must_contain` testa. */
  deliveredText: string;
  toolCalls: ToolCallRecord[];
  serviceDraft: ServiceDraft | null;
  stateBefore: WorldSnapshot;
  stateAfter: WorldSnapshot;
  stateDiff: WorldDiff;
};

/** Perfil do participante — decide como o mundo é semeado antes do primeiro turno. */
export type HarnessProfile = "lead" | "oficina" | "cliente_final";

export type WorldSeed = {
  /** Telefone do participante (formato Meta, só dígitos). */
  from?: string;
  contactName?: string | null;
  profile?: HarnessProfile;
  /** Estado inicial do lead (só faz sentido em `profile: "lead"`). */
  leadStatus?: LeadStatus;
  /** Contexto inicial da conversa — use só para o que replay de mensagens não alcança. */
  context?: ConversationContext;
  /** Modo inicial da conversa de oficina. */
  agentMode?: Extract<ConversationAgentMode, "onboarding" | "operacao">;
  oficinaNome?: string;
  /** Lembrete pré-existente, para o fluxo `cliente_final_lembrete`. */
  lembrete?: {
    id: string;
    veiculo?: string;
    status?: string;
  };
};

export type HarnessOptions = {
  seed?: WorldSeed;
  /** `off` deixa os agentes determinísticos (`openai: null`). `real` usa a OpenAI. */
  openai?: "off" | "real";
  /** Camada de geração conversacional (ADR-0020). Default `off`. */
  geracaoLlmModo?: GeracaoLlmModo;
  /** Data de referência (YYYY-MM-DD) para resolver datas relativas. */
  today?: string;
  precoPartida?: number;
  whatsappHandoffComercial?: string;
  taxaRecuperacaoRoi?: number;
};

export type SendOptions = {
  mediaType?: InboundMediaType;
  /** Simula resposta a uma mensagem específica (usado no fluxo de lembrete). */
  contextWhatsappMessageId?: string | null;
  /** Simula clique em reply button: manda o `id` do botão em vez de texto livre. */
  buttonReplyId?: string;
};
