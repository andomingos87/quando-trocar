import { detectLeadOrigin } from "./sales-agent";
import type {
  ConversationAgentMode,
  ConversationContext,
  LeadStatus,
  ParticipantType,
  SavedConversation,
  WhatsappRepository,
} from "./types";

type Phase2Repository = Pick<
  WhatsappRepository,
  | "getOficinaByWhatsapp"
  | "getConversationByWhatsapp"
  | "upsertOficinaConversation"
  | "upsertLead"
  | "upsertConversation"
  | "upsertSalesLeadConversation"
>;

export type ResolvedWhatsappConversation = {
  conversationId: string;
  leadId: string | null;
  leadStatus: LeadStatus | null;
  oficinaId: string | null;
  oficinaNome: string | null;
  diasLembretePadrao: number | null;
  participantType: ParticipantType;
  agentMode: ConversationAgentMode;
  context: ConversationContext;
};

function hasRequiredPhase2Methods(
  repository: Phase2Repository,
): repository is Required<Phase2Repository> {
  return Boolean(
    repository.getOficinaByWhatsapp &&
      repository.getConversationByWhatsapp &&
      repository.upsertOficinaConversation &&
      repository.upsertSalesLeadConversation,
  );
}

function agentModeForOficinaConversation(
  existing: SavedConversation | null,
): Extract<ConversationAgentMode, "onboarding" | "operacao"> {
  if (existing?.agentMode === "operacao") return "operacao";
  return "onboarding";
}

export async function resolveWhatsappConversation(input: {
  repository: Phase2Repository;
  whatsapp: string;
  contactName: string | null;
  body: string;
}): Promise<ResolvedWhatsappConversation> {
  if (!hasRequiredPhase2Methods(input.repository)) {
    const lead = await input.repository.upsertLead({
      whatsapp: input.whatsapp,
      nome: input.contactName,
      origem: detectLeadOrigin(input.body),
      status: "em_conversa",
    });
    const conversation = await input.repository.upsertConversation({
      leadId: lead.id,
      whatsapp: input.whatsapp,
    });

    return {
      conversationId: conversation.id,
      leadId: lead.id,
      leadStatus: lead.status,
      oficinaId: null,
      oficinaNome: null,
      diasLembretePadrao: null,
      participantType: "lead_oficina",
      agentMode: "vendas",
      context: {},
    };
  }

  const oficina = await input.repository.getOficinaByWhatsapp({ whatsapp: input.whatsapp });

  if (oficina) {
    const existingConversation = await input.repository.getConversationByWhatsapp({
      whatsapp: input.whatsapp,
    });
    const agentMode = agentModeForOficinaConversation(existingConversation);
    const conversation = await input.repository.upsertOficinaConversation({
      oficinaId: oficina.id,
      whatsapp: input.whatsapp,
      agentMode,
      context: existingConversation?.context ?? {},
    });

    return {
      conversationId: conversation.id,
      leadId: conversation.leadId ?? null,
      leadStatus: null,
      oficinaId: oficina.id,
      oficinaNome: oficina.nome,
      diasLembretePadrao: oficina.diasLembretePadrao,
      participantType: "oficina_cliente",
      agentMode: conversation.agentMode ?? agentMode,
      context: conversation.context ?? existingConversation?.context ?? {},
    };
  }

  const lead = await input.repository.upsertLead({
    whatsapp: input.whatsapp,
    nome: input.contactName,
    origem: detectLeadOrigin(input.body),
    status: "em_conversa",
  });
  const conversation = await input.repository.upsertSalesLeadConversation({
    leadId: lead.id,
    whatsapp: input.whatsapp,
  });

  return {
    conversationId: conversation.id,
    leadId: lead.id,
    leadStatus: lead.status,
    oficinaId: null,
    oficinaNome: null,
    diasLembretePadrao: null,
    participantType: "lead_oficina",
    agentMode: "vendas",
    context: conversation.context ?? {},
  };
}
