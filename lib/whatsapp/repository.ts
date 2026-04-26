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
    toolName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }) {
    const result = (await this.supabase.from("agent_tool_calls").insert({
      conversa_id: input.conversationId,
      lead_id: input.leadId,
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
}
