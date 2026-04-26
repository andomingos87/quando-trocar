import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ConversationAgentMode,
  ConversationContext,
  LeadStatus,
  ParticipantType,
  RegisterServiceInput,
  RegisteredService,
  SavedConversation,
  WhatsappRepository,
} from "./types";

type SupabaseResult<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

function isDuplicateError(error: { code?: string } | null) {
  return error?.code === "23505";
}

function throwIfError(result: SupabaseResult<unknown>) {
  if (result.error && !isDuplicateError(result.error)) {
    throw new Error(result.error.message);
  }
}

function mapConversation(row: {
  id: string;
  lead_id: string | null;
  oficina_id: string | null;
  cliente_id: string | null;
  participant_type: ParticipantType;
  agent_mode: ConversationAgentMode;
  context: ConversationContext | null;
}): SavedConversation {
  return {
    id: row.id,
    leadId: row.lead_id,
    oficinaId: row.oficina_id,
    clienteId: row.cliente_id,
    participantType: row.participant_type,
    agentMode: row.agent_mode,
    context: row.context ?? {},
  };
}

type LeadPersistenceInput = {
  nome: string | null;
  origem: "landing_page" | "manual_whatsapp";
  status: LeadStatus;
};

export function mergeLeadForInbound(
  existing: LeadPersistenceInput | null,
  incoming: LeadPersistenceInput,
): LeadPersistenceInput {
  if (!existing) {
    return incoming;
  }

  return {
    nome: incoming.nome ?? existing.nome,
    origem: existing.origem,
    status: existing.status,
  };
}

export class SupabaseWhatsappRepository implements WhatsappRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveWhatsappEvent(input: {
    providerEventId: string | null;
    whatsappMessageId: string | null;
    payload: unknown;
  }) {
    const result = (await this.supabase
      .from("whatsapp_events")
      .insert({
        provider_event_id: input.providerEventId,
        whatsapp_message_id: input.whatsappMessageId,
        payload: input.payload,
      })
      .select("id")
      .single()) as SupabaseResult<{ id: string }>;

    if (isDuplicateError(result.error)) {
      return { duplicate: true, eventId: null };
    }

    throwIfError(result);
    return { duplicate: false, eventId: result.data?.id ?? null };
  }

  async upsertLead(input: {
    whatsapp: string;
    nome: string | null;
    origem: "landing_page" | "manual_whatsapp";
    status: LeadStatus;
  }) {
    const existingResult = (await this.supabase
      .from("leads_oficina")
      .select("id,nome,origem,status,metadata")
      .eq("whatsapp", input.whatsapp)
      .maybeSingle()) as SupabaseResult<{
      id: string;
      nome: string | null;
      origem: "landing_page" | "manual_whatsapp";
      status: LeadStatus;
      metadata: Record<string, unknown>;
    }>;

    throwIfError(existingResult);

    const merged = mergeLeadForInbound(existingResult.data, {
      nome: input.nome,
      origem: input.origem,
      status: input.status,
    });

    const result = (await this.supabase
      .from("leads_oficina")
      .upsert(
        {
          whatsapp: input.whatsapp,
          nome: merged.nome,
          origem: merged.origem,
          status: merged.status,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp" },
      )
      .select("id,status,nome,metadata")
      .single()) as SupabaseResult<{
      id: string;
      status: LeadStatus;
      nome: string | null;
      metadata: Record<string, unknown>;
    }>;

    throwIfError(result);
    return {
      id: result.data!.id,
      status: result.data!.status,
      nome: result.data!.nome,
      metadata: result.data!.metadata,
    };
  }

  async upsertConversation(input: { leadId: string | null; whatsapp: string }) {
    return this.upsertSalesLeadConversation(input);
  }

  async upsertSalesLeadConversation(input: { leadId: string | null; whatsapp: string }) {
    const result = (await this.supabase
      .from("conversas")
      .upsert(
        {
          lead_id: input.leadId,
          participant_whatsapp: input.whatsapp,
          participant_type: input.leadId ? "lead_oficina" : "contato_desconhecido",
          agent_mode: "vendas",
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_whatsapp,agent_mode" },
      )
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .single()) as SupabaseResult<{
      id: string;
      lead_id: string | null;
      oficina_id: string | null;
      cliente_id: string | null;
      participant_type: ParticipantType;
      agent_mode: ConversationAgentMode;
      context: ConversationContext | null;
    }>;

    throwIfError(result);
    return mapConversation(result.data!);
  }

  async getOficinaByWhatsapp(input: { whatsapp: string }) {
    const result = (await this.supabase
      .from("oficinas")
      .select("id,nome,whatsapp_principal,dias_lembrete_padrao")
      .eq("whatsapp_principal", input.whatsapp)
      .eq("status", "ativa")
      .maybeSingle()) as SupabaseResult<{
      id: string;
      nome: string;
      whatsapp_principal: string;
      dias_lembrete_padrao: number;
    }>;

    throwIfError(result);
    if (!result.data) return null;

    return {
      id: result.data.id,
      nome: result.data.nome,
      whatsappPrincipal: result.data.whatsapp_principal,
      diasLembretePadrao: result.data.dias_lembrete_padrao,
    };
  }

  async getConversationByWhatsapp(input: { whatsapp: string }) {
    const result = (await this.supabase
      .from("conversas")
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .eq("participant_whatsapp", input.whatsapp)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SupabaseResult<{
      id: string;
      lead_id: string | null;
      oficina_id: string | null;
      cliente_id: string | null;
      participant_type: ParticipantType;
      agent_mode: ConversationAgentMode;
      context: ConversationContext | null;
    }>;

    throwIfError(result);
    return result.data ? mapConversation(result.data) : null;
  }

  async findReminderConversationByWhatsapp(input: {
    whatsapp: string;
    contextWhatsappMessageId?: string | null;
  }) {
    if (input.contextWhatsappMessageId) {
      const byReplyContext = (await this.supabase
        .from("outbound_messages")
        .select("conversa_id,oficina_id,cliente_id,lembrete_id")
        .eq("whatsapp_message_id", input.contextWhatsappMessageId)
        .not("lembrete_id", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as SupabaseResult<{
        conversa_id: string;
        oficina_id: string | null;
        cliente_id: string | null;
        lembrete_id: string | null;
      }>;

      throwIfError(byReplyContext);

      if (byReplyContext.data?.conversa_id) {
        const conversation = (await this.supabase
          .from("conversas")
          .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
          .eq("id", byReplyContext.data.conversa_id)
          .maybeSingle()) as SupabaseResult<{
          id: string;
          lead_id: string | null;
          oficina_id: string | null;
          cliente_id: string | null;
          participant_type: ParticipantType;
          agent_mode: ConversationAgentMode;
          context: ConversationContext | null;
        }>;

        throwIfError(conversation);
        if (conversation.data) {
          return mapConversation({
            ...conversation.data,
            context: {
              ...(conversation.data.context ?? {}),
              lastReminderId: byReplyContext.data.lembrete_id ?? undefined,
            },
          });
        }
      }
    }

    const fallback = (await this.supabase
      .from("outbound_messages")
      .select("conversa_id,oficina_id,cliente_id,lembrete_id,sent_at")
      .eq("to_whatsapp", input.whatsapp)
      .not("lembrete_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(2)) as SupabaseResult<
      Array<{
        conversa_id: string;
        oficina_id: string | null;
        cliente_id: string | null;
        lembrete_id: string | null;
        sent_at: string | null;
      }>
    >;

    throwIfError(fallback);

    const candidate = fallback.data?.[0];
    if (!candidate?.conversa_id || !candidate.oficina_id || !candidate.cliente_id) {
      return null;
    }

    const conversation = (await this.supabase
      .from("conversas")
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .eq("id", candidate.conversa_id)
      .maybeSingle()) as SupabaseResult<{
      id: string;
      lead_id: string | null;
      oficina_id: string | null;
      cliente_id: string | null;
      participant_type: ParticipantType;
      agent_mode: ConversationAgentMode;
      context: ConversationContext | null;
    }>;

    throwIfError(conversation);
    return conversation.data
      ? mapConversation({
          ...conversation.data,
          context: {
            ...(conversation.data.context ?? {}),
            lastReminderId: candidate.lembrete_id ?? undefined,
          },
        })
      : null;
  }

  async upsertOficinaConversation(input: {
    oficinaId: string;
    whatsapp: string;
    agentMode?: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context?: ConversationContext;
  }) {
    const result = (await this.supabase
      .from("conversas")
      .upsert(
        {
          oficina_id: input.oficinaId,
          lead_id: null,
          participant_whatsapp: input.whatsapp,
          participant_type: "oficina_cliente",
          agent_mode: input.agentMode ?? "onboarding",
          context: input.context ?? {},
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_whatsapp,agent_mode" },
      )
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .single()) as SupabaseResult<{
      id: string;
      lead_id: string | null;
      oficina_id: string | null;
      cliente_id: string | null;
      participant_type: ParticipantType;
      agent_mode: ConversationAgentMode;
      context: ConversationContext | null;
    }>;

    throwIfError(result);
    return mapConversation(result.data!);
  }

  async updateConversationModeAndContext(input: {
    conversationId: string;
    agentMode?: ConversationAgentMode;
    context?: ConversationContext;
  }) {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.agentMode) update.agent_mode = input.agentMode;
    if (input.context) update.context = input.context;

    const result = (await this.supabase
      .from("conversas")
      .update(update)
      .eq("id", input.conversationId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async upsertClienteFinalConversation(input: {
    oficinaId: string;
    clienteId: string;
    whatsapp: string;
    context?: ConversationContext;
  }) {
    const result = (await this.supabase
      .from("conversas")
      .upsert(
        {
          oficina_id: input.oficinaId,
          cliente_id: input.clienteId,
          lead_id: null,
          participant_whatsapp: input.whatsapp,
          participant_type: "cliente_final",
          agent_mode: "cliente_final_lembrete",
          context: input.context ?? {},
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_whatsapp,agent_mode" },
      )
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .single()) as SupabaseResult<{
      id: string;
      lead_id: string | null;
      oficina_id: string | null;
      cliente_id: string | null;
      participant_type: ParticipantType;
      agent_mode: ConversationAgentMode;
      context: ConversationContext | null;
    }>;

    throwIfError(result);
    return mapConversation(result.data!);
  }

  async markConversationHandoff(input: { conversationId: string; reason: string }) {
    const result = (await this.supabase
      .from("conversas")
      .update({
        handoff_required: true,
        handoff_reason: input.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.conversationId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async convertLeadToOficina(input: {
    leadId: string;
    conversationId: string;
    whatsapp: string;
    responsavel: string | null;
    nomeOficina: string | null;
  }) {
    const now = new Date().toISOString();
    const nome = input.nomeOficina ?? "Oficina sem nome";
    const oficinaResult = (await this.supabase
      .from("oficinas")
      .upsert(
        {
          nome,
          responsavel: input.responsavel,
          whatsapp_principal: input.whatsapp,
          status: "ativa",
          plano: "teste",
          origem: "landing_whatsapp",
          updated_at: now,
        },
        { onConflict: "whatsapp_principal" },
      )
      .select("id,nome,dias_lembrete_padrao")
      .single()) as SupabaseResult<{
      id: string;
      nome: string;
      dias_lembrete_padrao: number;
    }>;

    throwIfError(oficinaResult);

    const leadResult = (await this.supabase
      .from("leads_oficina")
      .update({
        status: "convertido",
        oficina_id: oficinaResult.data!.id,
        converted_at: now,
        updated_at: now,
      })
      .eq("id", input.leadId)) as SupabaseResult<null>;

    throwIfError(leadResult);

    await this.updateConversationModeAndContext({
      conversationId: input.conversationId,
      agentMode: "onboarding",
      context: {},
    });

    const conversationResult = (await this.supabase
      .from("conversas")
      .update({
        oficina_id: oficinaResult.data!.id,
        participant_type: "oficina_cliente",
        updated_at: now,
      })
      .eq("id", input.conversationId)) as SupabaseResult<null>;

    throwIfError(conversationResult);

    return {
      oficinaId: oficinaResult.data!.id,
      nome: oficinaResult.data!.nome,
      diasLembretePadrao: oficinaResult.data!.dias_lembrete_padrao,
    };
  }

  async registerServiceWithReminder(input: RegisterServiceInput): Promise<RegisteredService> {
    const result = (await this.supabase.rpc("register_service_with_reminder", {
      p_oficina_id: input.oficinaId,
      p_nome_cliente: input.nomeCliente,
      p_whatsapp_cliente: input.whatsappCliente,
      p_veiculo: input.veiculo,
      p_servico: input.servico,
      p_data_servico: input.dataServico,
      p_valor: input.valor,
      p_consentimento_whatsapp: input.consentimentoWhatsapp,
    })) as SupabaseResult<{
      cliente_id: string;
      veiculo_id: string;
      servico_id: string;
      lembrete_id: string | null;
    }>;

    throwIfError(result);

    return {
      clienteId: result.data!.cliente_id,
      veiculoId: result.data!.veiculo_id,
      servicoId: result.data!.servico_id,
      lembreteId: result.data!.lembrete_id,
    };
  }

  async saveInboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    whatsappMessageId: string;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
  }) {
    const result = (await this.supabase
      .from("mensagens")
      .insert({
        conversa_id: input.conversationId,
        lead_id: input.leadId,
        oficina_id: input.oficinaId ?? null,
        direction: "inbound",
        whatsapp_message_id: input.whatsappMessageId,
        body: input.body,
        raw_payload: input.rawMessage,
        sent_at: input.sentAt,
      })
      .select("id")
      .single()) as SupabaseResult<{ id: string }>;

    if (isDuplicateError(result.error)) {
      return { duplicate: true, messageId: null };
    }

    throwIfError(result);
    return { duplicate: false, messageId: result.data?.id ?? null };
  }

  async saveOutboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    whatsappMessageId: string | null;
    body: string;
    rawMessage: unknown;
    sentAt: string | null;
  }) {
    const result = (await this.supabase
      .from("mensagens")
      .insert({
        conversa_id: input.conversationId,
        lead_id: input.leadId,
        oficina_id: input.oficinaId ?? null,
        direction: "outbound",
        whatsapp_message_id: input.whatsappMessageId,
        body: input.body,
        raw_payload: input.rawMessage,
        sent_at: input.sentAt,
      })
      .select("id")
      .single()) as SupabaseResult<{ id: string }>;

    if (isDuplicateError(result.error)) {
      return { duplicate: true, messageId: null };
    }

    throwIfError(result);
    return { duplicate: false, messageId: result.data?.id ?? null };
  }

  async saveAgentToolCall(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    clienteId?: string | null;
    toolName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }) {
    const result = (await this.supabase.from("agent_tool_calls").insert({
      conversa_id: input.conversationId,
      lead_id: input.leadId,
      oficina_id: input.oficinaId ?? null,
      cliente_id: input.clienteId ?? null,
      tool_name: input.toolName,
      input: input.input,
      output: input.output,
    })) as SupabaseResult<null>;

    throwIfError(result);
  }

  async markWhatsappEventProcessed(input: { eventId: string }) {
    const result = (await this.supabase
      .from("whatsapp_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_status: "processed",
        processing_error_type: null,
        processing_error_message: null,
        processing_error_context: null,
      })
      .eq("id", input.eventId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async markWhatsappEventFailed(input: {
    eventId: string;
    errorType: string;
    errorMessage: string;
    errorContext: Record<string, unknown>;
  }) {
    const result = (await this.supabase
      .from("whatsapp_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_status: "failed",
        processing_error_type: input.errorType,
        processing_error_message: input.errorMessage,
        processing_error_context: input.errorContext,
      })
      .eq("id", input.eventId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async updateLeadStatus(input: { leadId: string; status: LeadStatus }) {
    const result = (await this.supabase
      .from("leads_oficina")
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async createOutboundMessage(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    to: string;
    body: string;
  }) {
    const result = (await this.supabase
      .from("outbound_messages")
      .insert({
        conversa_id: input.conversationId,
        lead_id: input.leadId,
        oficina_id: input.oficinaId ?? null,
        to_whatsapp: input.to,
        body: input.body,
        status: "pending",
      })
      .select("id")
      .single()) as SupabaseResult<{ id: string }>;

    throwIfError(result);
    return { id: result.data!.id };
  }

  async markOutboundSent(input: {
    outboundMessageId: string;
    whatsappMessageId: string;
    response: unknown;
  }) {
    const result = (await this.supabase
      .from("outbound_messages")
      .update({
        status: "sent",
        whatsapp_message_id: input.whatsappMessageId,
        provider_response: input.response,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.outboundMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async markOutboundFailed(input: { outboundMessageId: string; errorMessage: string }) {
    const result = (await this.supabase
      .from("outbound_messages")
      .update({
        status: "failed",
        error_message: input.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.outboundMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async updateClienteFinalStatus(input: {
    clienteId: string;
    status: "ativo" | "opt_out" | "numero_errado";
    optOutAt?: string | null;
  }) {
    const result = (await this.supabase
      .from("clientes_finais")
      .update({
        status: input.status,
        opt_out_at: input.status === "opt_out" ? input.optOutAt ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.clienteId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async cancelFutureRemindersForCliente(input: { clienteId: string }) {
    const result = (await this.supabase
      .from("lembretes")
      .update({
        status: "cancelado",
        updated_at: new Date().toISOString(),
      })
      .eq("cliente_id", input.clienteId)
      .in("status", ["pendente", "enfileirado"])) as SupabaseResult<null>;

    throwIfError(result);
    return 0;
  }

  async updateReminderStatus(input: {
    reminderId: string;
    status: "pendente" | "enfileirado" | "enviado" | "respondido" | "agendado" | "sem_resposta" | "cancelado" | "erro_envio";
    whatsappMessageId?: string | null;
    providerStatus?: string | null;
    providerErrorCode?: string | null;
    lastError?: string | null;
  }) {
    const updates: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
      provider_status: input.providerStatus ?? null,
      provider_error_code: input.providerErrorCode ?? null,
      last_error: input.lastError ?? null,
    };

    if (input.whatsappMessageId !== undefined) {
      updates.whatsapp_message_id = input.whatsappMessageId;
    }

    if (input.status === "enviado") {
      updates.sent_at = new Date().toISOString();
    }

    const result = (await this.supabase
      .from("lembretes")
      .update(updates)
      .eq("id", input.reminderId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async updateMessageStatusByWhatsappMessageId(input: {
    whatsappMessageId: string;
    providerStatus: string;
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }) {
    const result = (await this.supabase
      .from("mensagens")
      .update({
        provider_status: input.providerStatus,
        provider_error_code: input.providerErrorCode,
        provider_error_message: input.providerErrorMessage,
        raw_payload: input.rawStatus,
      })
      .eq("whatsapp_message_id", input.whatsappMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async updateOutboundStatusByWhatsappMessageId(input: {
    whatsappMessageId: string;
    providerStatus: "sent" | "delivered" | "read" | "failed";
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }) {
    const nextStatus = input.providerStatus === "failed" ? "failed" : "sent";
    const result = (await this.supabase
      .from("outbound_messages")
      .update({
        status: nextStatus,
        provider_response: input.rawStatus,
        provider_error_code: input.providerErrorCode,
        provider_error_message: input.providerErrorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("whatsapp_message_id", input.whatsappMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async updateReminderDeliveryStatusByWhatsappMessageId(input: {
    whatsappMessageId: string;
    providerStatus: "sent" | "delivered" | "read" | "failed";
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    rawStatus: unknown;
  }) {
    const reminderStatus = input.providerStatus === "failed" ? "erro_envio" : "enviado";
    const updates: Record<string, unknown> = {
      status: reminderStatus,
      provider_status: input.providerStatus,
      provider_error_code: input.providerErrorCode,
      last_error: input.providerErrorMessage,
      updated_at: new Date().toISOString(),
    };
    if (input.providerStatus !== "failed") {
      updates.sent_at = new Date().toISOString();
    }

    const result = (await this.supabase
      .from("lembretes")
      .update(updates)
      .eq("whatsapp_message_id", input.whatsappMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async dequeueReminderQueueMessages(input: {
    batchSize: number;
    visibilityTimeoutSeconds: number;
  }) {
    const result = (await this.supabase.rpc("dequeue_whatsapp_reminder_messages", {
      p_batch_size: input.batchSize,
      p_visibility_timeout_seconds: input.visibilityTimeoutSeconds,
    })) as SupabaseResult<
      Array<{
        queue_message_id: number;
        outbound_message_id: string;
        lembrete_id: string;
        conversa_id: string;
        oficina_id: string;
        cliente_id: string;
        to_whatsapp: string;
        customer_name: string;
        workshop_name: string;
        vehicle_description: string;
        attempts: number;
      }>
    >;

    throwIfError(result);

    return (result.data ?? []).map((row) => ({
      queueMessageId: row.queue_message_id,
      outboundMessageId: row.outbound_message_id,
      lembreteId: row.lembrete_id,
      conversaId: row.conversa_id,
      oficinaId: row.oficina_id,
      clienteId: row.cliente_id,
      toWhatsapp: row.to_whatsapp,
      customerName: row.customer_name,
      workshopName: row.workshop_name,
      vehicleDescription: row.vehicle_description,
      attempts: row.attempts,
    }));
  }

  async archiveReminderQueueMessage(input: { queueMessageId: number }) {
    const result = (await this.supabase.rpc("archive_whatsapp_reminder_message", {
      p_queue_message_id: input.queueMessageId,
    })) as SupabaseResult<boolean>;

    throwIfError(result);
    return Boolean(result.data);
  }

  async markOutboundRetryScheduled(input: {
    outboundMessageId: string;
    attempts: number;
    nextAttemptAt: string;
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    response: unknown;
  }) {
    const result = (await this.supabase
      .from("outbound_messages")
      .update({
        status: "retry_scheduled",
        attempts: input.attempts,
        next_attempt_at: input.nextAttemptAt,
        provider_error_code: input.providerErrorCode,
        provider_error_message: input.providerErrorMessage,
        provider_response: input.response,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.outboundMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }
}
