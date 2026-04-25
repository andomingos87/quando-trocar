import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeadStatus, WhatsappRepository } from "./types";

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
    const result = (await this.supabase
      .from("leads_oficina")
      .upsert(
        {
          whatsapp: input.whatsapp,
          nome: input.nome,
          origem: input.origem,
          status: input.status,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp" },
      )
      .select("id,status")
      .single()) as SupabaseResult<{ id: string; status: LeadStatus }>;

    throwIfError(result);
    return { id: result.data!.id, status: result.data!.status };
  }

  async upsertConversation(input: { leadId: string | null; whatsapp: string }) {
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
      .select("id")
      .single()) as SupabaseResult<{ id: string }>;

    throwIfError(result);
    return { id: result.data!.id };
  }

  async saveInboundMessage(input: {
    conversationId: string;
    leadId: string | null;
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
    to: string;
    body: string;
  }) {
    const result = (await this.supabase
      .from("outbound_messages")
      .insert({
        conversa_id: input.conversationId,
        lead_id: input.leadId,
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
