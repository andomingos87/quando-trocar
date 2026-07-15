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
  | "suporte"
  | "cobranca";

export type SalesIntent =
  | "pergunta_funcionamento"
  | "informa_volume_ticket"
  | "pergunta_preco"
  | "pergunta_faq"
  | "small_talk"
  | "social_test"
  | "confirmacao_neutra"
  | "vai_pensar"
  | "quer_humano"
  | "quer_testar"
  | "sem_interesse"
  | "fora_escopo";

export type SalesClassification = {
  intent: SalesIntent;
  confidence: number;
  monthlyChanges?: number;
  averageTicket?: number;
  faqId?: string;
  painDetected?: boolean;
  scaleHandoff?: boolean;
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
  /** Nome da oficina capturado no fluxo de conversão (acompanha convertToOficina). */
  nomeOficina?: string | null;
  updatedContext?: ConversationContext;
  handoffRequired?: boolean;
  handoffReason?: string;
};

export type SalesConversationMemory = {
  volume_known?: number;
  ticket_known?: number;
  price_mentions?: number;
  pain_detected?: boolean;
  greeted?: boolean;
  funcionamento_explained?: boolean;
  consecutive_fallback?: number;
  /** Aguardando a oficina responder o nome antes de converter o lead. */
  awaiting_workshop_name?: boolean;
  /** Nome da oficina informado pelo lead durante a conversão. */
  workshop_name?: string;
};

export type FaqVendasRecord = {
  id: string;
  pergunta: string;
  resposta: string;
  palavras_chave: string[];
  ordem: number;
};

// Modo da camada de geracao conversacional (ADR-0020, fase CV1).
// - off: o bot envia apenas a resposta deterministica ("enlatada") — comportamento atual.
// - sombra: gera + valida + audita o que *diria*, mas ainda envia a enlatada.
// - on: envia a gerada quando aprovada no validador; senao cai na enlatada.
export type GeracaoLlmModo = "off" | "sombra" | "on";

export type ConfiguracoesVendedor = {
  taxaRecuperacaoRoi: number;
  whatsappHandoffComercial: string;
  frasesLanding: string[];
  precoPartida: number;
  geracaoLlmModo: GeracaoLlmModo;
};

// Uma linha do historico da conversa lida pelo gerador (continuidade de tom).
export type RecentMessage = {
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string | null;
};

// Resultado do validador deterministico de saida (ADR-0020, poder de veto).
export type ReplyValidationResult = { ok: true } | { ok: false; reason: string };

// Entrada do gerador conversacional. `deterministicReply` e o "esqueleto de
// fatos + CTA" que o LLM deve apenas reescrever (naturalizar), sem inventar.
export type ReplyGenerationInput = {
  deterministicReply: string;
  intent: string | null;
  agentMode: string;
  history: RecentMessage[];
  salesConfig: ConfiguracoesVendedor | null;
};

// Contrato do gerador. `generate` devolve a string reescrita ou `null` quando
// nao pode/nao deve gerar (sem key, erro, timeout) — o caller usa a enlatada.
export interface ReplyGenerator {
  generate(input: ReplyGenerationInput): Promise<string | null>;
}

export type TipoServico = "troca_oleo" | "amortecedor" | "revisao" | "outro";

export type MarcaAmortecedor = "perfect" | "monroe" | "cofap" | "nakata" | "outra";

export type ServiceDraft = {
  nome_cliente?: string;
  whatsapp_cliente?: string;
  veiculo?: string;
  servico?: string;
  data_servico?: string;
  valor?: number | null;
  consentimento_whatsapp?: boolean;
  tipo_servico?: TipoServico;
  marca_peca?: MarcaAmortecedor | null;
};

export type ConversationContext = {
  pending_action?: "registrar_primeira_troca";
  missing_field?:
    | "nome_cliente"
    | "whatsapp_cliente"
    | "veiculo"
    | "servico"
    | "data_servico"
    | "marca_peca";
  service_draft?: ServiceDraft;
  /**
   * Cadastro com todos os campos preenchidos aguardando a oficina confirmar
   * antes de gravar o serviço e disparar o template ao cliente final. Rede de
   * segurança contra captura ruim (ex.: alucinação do Whisper — ver ADR-0017).
   * Enquanto `true`, `service_draft` carrega o rascunho completo a confirmar.
   */
  awaiting_confirmation?: boolean;
  lastReminderId?: string;
  ambiguousReminderLookup?: boolean;
  supportHandoffReason?: string;
  sales?: SalesConversationMemory;
  /**
   * Conversa de oficina cujo cadastro ficou com nome placeholder
   * ("Oficina sem nome"): aguardando a oficina responder o nome real
   * antes de retomar o fluxo de onboarding/operação (backfill).
   */
  awaiting_workshop_name?: boolean;
  /**
   * Rotação das respostas neutras/conversacionais do agente de operação
   * (saudação, small-talk, "como funciona", genérico): índice incrementado a
   * cada turno para não repetir a mesma frase — o efeito "disco riscado".
   */
  neutral_turn?: number;
  /**
   * A oficina já recebeu a saudação completa (com exemplo copiável): a próxima
   * saudação é mais curta, sem repetir o explicador inteiro.
   */
  greeted?: boolean;
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
  tipoServico: TipoServico;
  marcaPeca: MarcaAmortecedor | null;
};

export type RegisteredService = {
  clienteId: string;
  veiculoId: string;
  servicoId: string;
  lembreteId: string | null;
};

export type InboundMediaType =
  | "text"
  | "audio"
  | "image"
  | "document"
  | "sticker"
  | "video"
  | "location"
  | "contacts"
  | "unsupported";

// Subconjunto de mediaType que o webhook responde com fallback fixo (sem chamar
// agente). Mantemos separado de `audio` porque áudio tem seu próprio pipeline
// de transcrição (ADR-0015); o pipeline de imagem/PDF (ADR-0016) também
// recebe processamento próprio antes do fallback ser usado.
export type UnsupportedInboundMediaType =
  | "sticker"
  | "video"
  | "location"
  | "contacts"
  | "unsupported";

export type TranscriptionStatus = "success" | "failed" | "empty" | "timeout";

export type InboundWhatsappMessage = {
  providerEventId: string;
  whatsappMessageId: string;
  contextWhatsappMessageId?: string | null;
  from: string;
  normalizedFrom: string;
  contactName: string | null;
  body: string;
  timestamp: Date | null;
  rawMessage: Record<string, unknown>;
  mediaType: InboundMediaType;
  mediaId?: string | null;
  // Legenda enviada junto da mídia (apenas image/document/video trazem).
  mediaCaption?: string | null;
  // Mime declarado pelo Meta no webhook (pré-download). Útil para validação
  // rápida antes de gastar uma chamada de download/vision.
  mediaMimeType?: string | null;
  transcription?: string | null;
  transcriptionStatus?: TranscriptionStatus | null;
  transcriptionError?: string | null;
  audioDurationMs?: number | null;
};

export type WhatsappStatusEvent = {
  providerEventId: string;
  whatsappMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string | null;
  recipientId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawStatus: Record<string, unknown>;
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
    representanteCodigo?: string | null;
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
  getOficinaById?(input: {
    oficinaId: string;
  }): Promise<{
    id: string;
    nome: string;
    whatsappPrincipal: string;
    diasLembretePadrao: number;
  } | null>;
  findClienteFinalConversationByWhatsapp?(input: {
    whatsapp: string;
  }): Promise<SavedConversation | null>;
  getConversationByWhatsapp?(input: {
    whatsapp: string;
  }): Promise<SavedConversation | null>;
  findReminderConversationByWhatsapp?(input: {
    whatsapp: string;
    contextWhatsappMessageId?: string | null;
  }): Promise<SavedConversation | null>;
  upsertSupportConversation?(input: {
    whatsapp: string;
    context?: ConversationContext;
  }): Promise<SavedConversation>;
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
  upsertClienteFinalConversation?(input: {
    oficinaId: string;
    clienteId: string;
    whatsapp: string;
    context?: ConversationContext;
  }): Promise<SavedConversation>;
  markConversationHandoff?(input: {
    conversationId: string;
    reason: string;
  }): Promise<void>;
  getLatestPendingPagamento?(input: {
    oficinaId: string;
  }): Promise<{
    valor: number;
    vencimento: string | null;
    mpPreferenceId: string | null;
  } | null>;
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
  // Atualiza apenas o nome de uma oficina já cadastrada. Usado no backfill de
  // oficinas que ficaram com o placeholder "Oficina sem nome".
  updateOficinaNome?(input: {
    oficinaId: string;
    nome: string;
  }): Promise<void>;
  registerServiceWithReminder?(input: RegisterServiceInput): Promise<RegisteredService>;
  // Conta mensagens inbound dos tipos image/document recebidas nas últimas
  // 24h da mesma conversa (whatsapp_from). Usado pelo rate limit de mídia.
  // Opcional: quando ausente, o webhook não aplica rate limit.
  countInboundMediaInLastDay?(input: {
    whatsappFrom: string;
  }): Promise<number>;
  saveInboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    whatsappMessageId: string;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
    mediaType?: InboundMediaType;
    mediaId?: string | null;
    transcription?: string | null;
    transcriptionStatus?: TranscriptionStatus | null;
    transcriptionError?: string | null;
    audioDurationMs?: number | null;
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
    oficinaId?: string | null;
    clienteId?: string | null;
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
    messageKind?: "text" | "template";
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: unknown;
  }): Promise<{ id: string }>;
  markOutboundSent(input: {
    outboundMessageId: string;
    whatsappMessageId: string;
    response: unknown;
  }): Promise<void>;
  markOutboundFailed(input: {
    outboundMessageId: string;
    errorMessage: string;
    providerErrorCode?: string | null;
    providerErrorMessage?: string | null;
    response?: unknown;
    attempts?: number;
  }): Promise<void>;
  updateClienteFinalStatus?(input: {
    clienteId: string;
    status: "ativo" | "opt_out" | "numero_errado";
    optOutAt?: string | null;
  }): Promise<void>;
  cancelFutureRemindersForCliente?(input: {
    clienteId: string;
  }): Promise<number>;
  updateReminderStatus?(input: {
    reminderId: string;
    status: "pendente" | "enfileirado" | "enviado" | "respondido" | "agendado" | "sem_resposta" | "cancelado" | "erro_envio";
    whatsappMessageId?: string | null;
    providerStatus?: string | null;
    providerErrorCode?: string | null;
    lastError?: string | null;
    lastAttemptAt?: string | null;
  }): Promise<void>;
  updateMessageStatusByWhatsappMessageId?(input: {
    whatsappMessageId: string;
    providerStatus: string;
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }): Promise<void>;
  updateOutboundStatusByWhatsappMessageId?(input: {
    whatsappMessageId: string;
    providerStatus: "sent" | "delivered" | "read" | "failed";
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }): Promise<void>;
  updateReminderDeliveryStatusByWhatsappMessageId?(input: {
    whatsappMessageId: string;
    providerStatus: "sent" | "delivered" | "read" | "failed";
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }): Promise<void>;
  dequeueReminderQueueMessages?(input: {
    batchSize: number;
    visibilityTimeoutSeconds: number;
  }): Promise<
    Array<{
      queueMessageId: number;
      outboundMessageId: string;
      lembreteId: string;
      conversaId: string;
      oficinaId: string;
      clienteId: string;
      toWhatsapp: string;
      customerName: string;
      workshopName: string;
      vehicleDescription: string;
      attempts?: number;
      templateName?: string | null;
      templateLanguage?: string | null;
      tipoServico?: TipoServico | null;
    }>
  >;
  archiveReminderQueueMessage?(input: { queueMessageId: number }): Promise<boolean>;
  requeueReminderQueueMessage?(input: {
    outboundMessageId: string;
    lembreteId: string;
    oficinaId: string;
    clienteId: string;
    delaySeconds: number;
  }): Promise<number | null>;
  markOutboundRetryScheduled?(input: {
    outboundMessageId: string;
    attempts: number;
    nextAttemptAt: string;
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    response: unknown;
  }): Promise<void>;
  listActiveFaqs?(): Promise<FaqVendasRecord[]>;
  getConfiguracoesVendedor?(): Promise<ConfiguracoesVendedor>;
  // Ultimas N mensagens da conversa (asc por tempo). Primeira leitura de
  // historico do projeto — usada como contexto do gerador conversacional
  // (ADR-0020). Opcional: quando ausente, o gerador roda sem historico.
  listRecentMessages?(input: {
    conversationId: string;
    limit: number;
  }): Promise<RecentMessage[]>;
};

export type WhatsappSender = {
  sendTextMessage(input: { to: string; body: string }): Promise<{
    whatsappMessageId: string;
    response?: unknown;
  }>;
  sendTemplateMessage?(input: {
    to: string;
    templateName: string;
    languageCode: string;
    bodyParameters: string[];
    /**
     * Optional names for the body parameters. When provided (and matching the
     * length of `bodyParameters`), the send uses NAMED parameters
     * (`parameter_name`) instead of positional ones — required for templates
     * created with named placeholders like `{{nome}}`.
     */
    bodyParameterNames?: string[];
    /**
     * Optional value for a URL button that contains a `{{1}}` placeholder
     * (used by AUTHENTICATION templates with COPY_CODE one-tap buttons).
     * When provided, an extra `button` component is appended to the request.
     */
    urlButtonParameter?: string;
  }): Promise<{
    whatsappMessageId: string;
    response?: unknown;
  }>;
};

export type SalesAgentInput = {
  message: string;
  leadStatus: LeadStatus;
  context?: ConversationContext;
  salesConfig?: ConfiguracoesVendedor;
  faqs?: ReadonlyArray<FaqVendasRecord>;
};

export type SalesAgent = {
  generateReply(input: SalesAgentInput): Promise<AgentReply>;
};

export type OnboardingAgent = {
  generateReply(input: {
    message: string;
    mode: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context: ConversationContext;
    today: string;
    /**
     * Hora local (0-23) no fuso America/Sao_Paulo, usada para a saudação
     * temporal (bom dia / boa tarde / boa noite). Ausente → saudação neutra.
     */
    hourSaoPaulo?: number;
  }): Promise<OnboardingAgentReply>;
};

export type OnboardingAgentReply = {
  body: string;
  context: ConversationContext;
  registerServiceInput: Omit<RegisterServiceInput, "oficinaId"> | null;
  nextAgentMode: Extract<ConversationAgentMode, "onboarding" | "operacao"> | null;
  toolCalls: ToolCallRecord[];
  /**
   * `true` só quando `body` é conversa livre (saudação, small-talk, "como
   * funciona") e pode ser reescrito com naturalidade pela camada CV1 (ADR-0020).
   * Respostas transacionais (pergunta de campo, resumo de confirmação, "cliente
   * cadastrado") deixam isto `false`/ausente para permanecerem determinísticas
   * — preserva a rede de segurança da ADR-0017 (a oficina confere o dado exato).
   */
  allowConversationalGeneration?: boolean;
};

export type ReminderIntent =
  | "quer_agendar"
  | "quer_reagendar"
  | "pergunta_preco"
  | "pergunta_horario"
  | "nao_tem_interesse"
  | "ja_fez_servico"
  | "numero_errado"
  | "mensagem_indefinida"
  | "opt_out";

export type ReminderAgentReply = {
  intent: ReminderIntent;
  confidence: number;
  handoffRequired: boolean;
  handoffReason: string | null;
  lembreteStatus: "respondido" | "cancelado" | "sem_resposta" | "agendado" | null;
  clienteStatus: "ativo" | "opt_out" | "numero_errado" | null;
  shouldCancelFutureReminders: boolean;
  replyBody: string;
  toolCalls: ToolCallRecord[];
};

export type ReminderAgent = {
  generateReply(input: {
    message: string;
    conversationContext: ConversationContext;
  }): Promise<ReminderAgentReply>;
};

// Concierge do cliente final ANTES de qualquer lembrete (resposta à confirmação).
export type ClienteFinalConciergeIntent =
  | "agradecimento"
  | "quem_e"
  | "opt_out"
  | "numero_errado"
  | "nao_reconhece"
  | "pedido_oficina"
  | "mensagem_indefinida";

export type ClienteFinalConciergeReply = {
  intent: ClienteFinalConciergeIntent;
  replyBody: string;
  handoffRequired: boolean;
  handoffReason: string | null;
  clienteStatus: "ativo" | "opt_out" | "numero_errado" | null;
  shouldCancelFutureReminders: boolean;
  toolCalls: ToolCallRecord[];
};

export type ClienteFinalConciergeAgent = {
  generateReply(input: {
    message: string;
    workshopName: string;
    workshopWhatsapp: string | null;
  }): ClienteFinalConciergeReply;
};

export type SupportIntent =
  | "duvida_uso"
  | "bug_ou_travamento"
  | "cobranca"
  | "outro";

export type SupportAgentReply = {
  intent: SupportIntent;
  confidence: number;
  replyBody: string;
  handoffRequired: boolean;
  handoffReason: string | null;
  toolCalls: ToolCallRecord[];
};

export type SupportAgent = {
  generateReply(input: {
    message: string;
    context: ConversationContext;
    oficinaNome: string | null;
  }): Promise<SupportAgentReply>;
};

export type CobrancaSubmode = "cobranca_inadimplente" | "cobranca_winback";

export type CobrancaIntent =
  | "pediu_link"
  | "vai_pagar"
  | "ja_paguei"
  | "negocia_prazo"
  | "quer_voltar"
  | "nao_quer_voltar"
  | "disputa"
  | "outro";

export type CobrancaPendingPayment = {
  valor: number;
  vencimento: string | null;
  mpPreferenceId: string | null;
};

export type CobrancaAgentReply = {
  intent: CobrancaIntent;
  confidence: number;
  submode: CobrancaSubmode;
  replyBody: string;
  handoffRequired: boolean;
  handoffReason: string | null;
  toolCalls: ToolCallRecord[];
};

export type CobrancaAgent = {
  generateReply(input: {
    message: string;
    submode: CobrancaSubmode;
    oficinaNome: string | null;
    proximoVencimento: string | null;
    pendingPayment: CobrancaPendingPayment | null;
    context: ConversationContext;
  }): Promise<CobrancaAgentReply>;
};
