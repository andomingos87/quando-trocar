import type { SupabaseClient } from "@supabase/supabase-js";

import { toPgVectorLiteral } from "./faq-embeddings";
import type {
  ClienteResumo,
  ConfiguracoesVendedor,
  ConversationAgentMode,
  ConversationContext,
  FaqVendasRecord,
  FollowupLeadCandidate,
  GeracaoLlmModo,
  InboundMediaType,
  LeadStatus,
  PromotableSalesIntent,
  ParticipantType,
  RecentMessage,
  RegisterServiceInput,
  SalesClassificationAudit,
  SalesIntentTrigger,
  RegisteredService,
  SavedConversation,
  TipoServico,
  UpcomingReminder,
  WhatsappRepository,
} from "./types";

const FAQ_CACHE_TTL_MS = 60_000;
const CONFIG_CACHE_TTL_MS = 60_000;

// Nome placeholder gravado quando a oficina é convertida sem informar o nome.
// Usado como sentinela pelo backfill (bot pergunta o nome real na próxima
// interação). Mantido em um único lugar pra evitar divergência de string.
export const OFICINA_SEM_NOME = "Oficina sem nome";

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
  private faqCache: { value: FaqVendasRecord[]; loadedAt: number } | null = null;
  private configCache: { value: ConfiguracoesVendedor; loadedAt: number } | null = null;
  private intentTriggersCache: { value: SalesIntentTrigger[]; loadedAt: number } | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  async listActiveFaqs(): Promise<FaqVendasRecord[]> {
    if (this.faqCache && Date.now() - this.faqCache.loadedAt < FAQ_CACHE_TTL_MS) {
      return this.faqCache.value;
    }

    const result = (await this.supabase
      .from("faq_vendas")
      .select("id,pergunta,resposta,palavras_chave,ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true })) as SupabaseResult<
      Array<{
        id: string;
        pergunta: string;
        resposta: string;
        palavras_chave: string[] | null;
        ordem: number;
      }>
    >;

    throwIfError(result);
    const value: FaqVendasRecord[] = (result.data ?? []).map((row) => ({
      id: row.id,
      pergunta: row.pergunta,
      resposta: row.resposta,
      palavras_chave: row.palavras_chave ?? [],
      ordem: row.ordem,
    }));
    this.faqCache = { value, loadedAt: Date.now() };
    return value;
  }

  async listActiveSalesIntentTriggers(): Promise<SalesIntentTrigger[]> {
    if (
      this.intentTriggersCache &&
      Date.now() - this.intentTriggersCache.loadedAt < FAQ_CACHE_TTL_MS
    ) {
      return this.intentTriggersCache.value;
    }

    const result = (await this.supabase
      .from("gatilhos_intencao_vendas")
      .select("id,padrao,intent")
      .eq("ativo", true)
      .order("created_at", { ascending: true })) as SupabaseResult<
      Array<{ id: string; padrao: string; intent: PromotableSalesIntent }>
    >;

    throwIfError(result);
    const value = (result.data ?? []).map((row) => ({
      id: row.id,
      pattern: row.padrao,
      intent: row.intent,
    }));
    this.intentTriggersCache = { value, loadedAt: Date.now() };
    return value;
  }

  async matchFaqByEmbedding(input: {
    embedding: number[];
    threshold: number;
    limit: number;
  }): Promise<FaqVendasRecord[]> {
    // pgvector aceita a forma textual canônica "[a,b,c]" tanto na RPC quanto no
    // update — evita ambiguidade de coerção JSON→vector do PostgREST.
    const result = (await this.supabase.rpc("match_faq_vendas", {
      query_embedding: toPgVectorLiteral(input.embedding),
      match_threshold: input.threshold,
      match_count: input.limit,
    })) as SupabaseResult<
      Array<{
        id: string;
        pergunta: string;
        resposta: string;
        palavras_chave: string[] | null;
        ordem: number;
        similarity: number;
      }>
    >;

    throwIfError(result);
    return (result.data ?? []).map((row) => ({
      id: row.id,
      pergunta: row.pergunta,
      resposta: row.resposta,
      palavras_chave: row.palavras_chave ?? [],
      ordem: row.ordem,
    }));
  }

  async updateFaqEmbedding(input: {
    id: string;
    embedding: number[];
  }): Promise<void> {
    const result = (await this.supabase
      .from("faq_vendas")
      .update({ embedding: toPgVectorLiteral(input.embedding) })
      .eq("id", input.id)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async listUpcomingReminders(input: {
    oficinaId: string;
    days: number;
    limit?: number;
  }): Promise<UpcomingReminder[]> {
    // CV6: lembretes a vencer, ESCOPADOS por oficina_id (nunca vaza outra
    // oficina). Só os que ainda vão sair (pendente/agendado/enfileirado).
    const nowIso = new Date().toISOString();
    const untilIso = new Date(
      Date.now() + input.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = (await this.supabase
      .from("lembretes")
      .select("scheduled_at, clientes_finais(nome), veiculos(descricao)")
      .eq("oficina_id", input.oficinaId)
      .in("status", ["pendente", "agendado", "enfileirado"])
      .gte("scheduled_at", nowIso)
      .lt("scheduled_at", untilIso)
      .order("scheduled_at", { ascending: true })
      .limit(input.limit ?? 10)) as SupabaseResult<
      Array<{
        scheduled_at: string;
        clientes_finais: { nome: string } | { nome: string }[] | null;
        veiculos: { descricao: string } | { descricao: string }[] | null;
      }>
    >;

    throwIfError(result);
    return (result.data ?? []).map((row) => {
      const cliente = Array.isArray(row.clientes_finais)
        ? row.clientes_finais[0]
        : row.clientes_finais;
      const veiculo = Array.isArray(row.veiculos) ? row.veiculos[0] : row.veiculos;
      return {
        clienteNome: cliente?.nome ?? "Cliente",
        veiculo: veiculo?.descricao ?? "veículo",
        scheduledAt: row.scheduled_at,
      };
    });
  }

  async countRemindersSentThisMonth(input: {
    oficinaId: string;
  }): Promise<number> {
    // CV6: quantos lembretes já saíram no mês corrente, ESCOPADO por oficina.
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();
    const result = (await this.supabase
      .from("lembretes")
      .select("id", { count: "exact", head: true })
      .eq("oficina_id", input.oficinaId)
      .in("status", ["enviado", "respondido", "sem_resposta"])
      .gte("sent_at", startOfMonth)) as SupabaseResult<null> & { count: number | null };

    throwIfError(result);
    return result.count ?? 0;
  }

  async getClienteResumo(input: {
    oficinaId: string;
    nomeOuTelefone: string;
  }): Promise<ClienteResumo | null> {
    // CV6: resumo de um cliente, ESCOPADO por oficina_id. Busca por telefone
    // (dígitos) quando o termo parece um número; senão por nome (ilike).
    const digits = input.nomeOuTelefone.replace(/\D/g, "");
    const byPhone = digits.length >= 8;

    let query = this.supabase
      .from("clientes_finais")
      .select("id, nome, whatsapp, status")
      .eq("oficina_id", input.oficinaId)
      .is("deleted_at", null);
    query = byPhone
      ? query.ilike("whatsapp", `%${digits}%`)
      : query.ilike("nome", `%${input.nomeOuTelefone.trim()}%`);

    const clienteResult = (await query
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SupabaseResult<{
      id: string;
      nome: string;
      whatsapp: string;
      status: string;
    }>;

    throwIfError(clienteResult);
    const cliente = clienteResult.data;
    if (!cliente) return null;

    // Serviços do cliente (escopados por oficina + cliente).
    const servicosResult = (await this.supabase
      .from("servicos")
      .select("tipo_servico, data_servico, veiculos(descricao)")
      .eq("oficina_id", input.oficinaId)
      .eq("cliente_id", cliente.id)
      .order("data_servico", { ascending: false })) as SupabaseResult<
      Array<{
        tipo_servico: string;
        data_servico: string;
        veiculos: { descricao: string } | { descricao: string }[] | null;
      }>
    >;

    throwIfError(servicosResult);
    const servicos = servicosResult.data ?? [];
    const ultimo = servicos[0];
    const ultimoVeiculo = ultimo
      ? Array.isArray(ultimo.veiculos)
        ? ultimo.veiculos[0]
        : ultimo.veiculos
      : null;

    // Próximo lembrete pendente do cliente (escopado por oficina).
    const lembreteResult = (await this.supabase
      .from("lembretes")
      .select("scheduled_at")
      .eq("oficina_id", input.oficinaId)
      .eq("cliente_id", cliente.id)
      .in("status", ["pendente", "agendado", "enfileirado"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle()) as SupabaseResult<{ scheduled_at: string }>;

    throwIfError(lembreteResult);

    return {
      nome: cliente.nome,
      whatsapp: cliente.whatsapp,
      status: cliente.status,
      totalServicos: servicos.length,
      ultimoServico: ultimo
        ? {
            tipo: ultimo.tipo_servico,
            data: ultimo.data_servico,
            veiculo: ultimoVeiculo?.descricao ?? "veículo",
          }
        : null,
      proximoLembreteAt: lembreteResult.data?.scheduled_at ?? null,
    };
  }

  async getConfiguracoesVendedor(): Promise<ConfiguracoesVendedor> {
    if (this.configCache && Date.now() - this.configCache.loadedAt < CONFIG_CACHE_TTL_MS) {
      return this.configCache.value;
    }

    const result = (await this.supabase
      .from("configuracoes_vendedor")
      .select("taxa_recuperacao_roi,whatsapp_handoff_comercial,frases_landing,geracao_llm_modo")
      .limit(1)
      .maybeSingle()) as SupabaseResult<{
      taxa_recuperacao_roi: number | string;
      whatsapp_handoff_comercial: string;
      frases_landing: string[] | null;
      geracao_llm_modo: GeracaoLlmModo | null;
    }>;

    throwIfError(result);

    const planResult = (await this.supabase
      .from("planos")
      .select("preco_base")
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()) as SupabaseResult<{ preco_base: number | string }>;

    throwIfError(planResult);

    const value: ConfiguracoesVendedor = {
      taxaRecuperacaoRoi: Number(result.data?.taxa_recuperacao_roi ?? 0.15),
      whatsappHandoffComercial: result.data?.whatsapp_handoff_comercial ?? "+5511945207618",
      frasesLanding: result.data?.frases_landing ?? ["oi quero testar o quando trocar"],
      precoPartida: Number(planResult.data?.preco_base ?? 59),
      geracaoLlmModo: result.data?.geracao_llm_modo ?? "off",
    };

    this.configCache = { value, loadedAt: Date.now() };
    return value;
  }

  async listRecentMessages(input: {
    conversationId: string;
    limit: number;
  }): Promise<RecentMessage[]> {
    // Ultimas N mensagens da conversa como contexto do gerador (ADR-0020).
    // Busca as mais recentes (desc) e devolve em ordem cronologica (asc) para
    // o prompt ler do mais antigo ao mais novo. Ordena por created_at (sempre
    // preenchido); sent_at pode ser nulo em inbound sem timestamp.
    const result = (await this.supabase
      .from("mensagens")
      .select("direction,body,sent_at,created_at")
      .eq("conversa_id", input.conversationId)
      .order("created_at", { ascending: false })
      .limit(input.limit)) as SupabaseResult<
      Array<{
        direction: "inbound" | "outbound";
        body: string | null;
        sent_at: string | null;
        created_at: string | null;
      }>
    >;

    throwIfError(result);
    return (result.data ?? [])
      .reverse()
      .map((row) => ({
        direction: row.direction,
        body: row.body ?? "",
        sentAt: row.sent_at ?? row.created_at ?? null,
      }));
  }

  async listFollowupCandidates(input: {
    limit: number;
  }): Promise<FollowupLeadCandidate[]> {
    // Leads ainda reengajáveis: status em_conversa/qualificado, não excluídos,
    // com menos de 2 follow-ups. Embute as conversas para pegar o id (necessário
    // para registrar o outbound em `mensagens`) e o flag de handoff (exclui o
    // lead — já é caso humano). A decisão de janela/cap fica na função pura
    // `selectLeadsForFollowup` (CV4).
    const result = (await this.supabase
      .from("leads_oficina")
      .select(
        "id,whatsapp,nome,status,followup_count,last_followup_at,last_message_at,created_at,conversas(id,agent_mode,handoff_required)",
      )
      .in("status", ["em_conversa", "qualificado"])
      .is("deleted_at", null)
      .lt("followup_count", 2)
      .order("last_message_at", { ascending: true, nullsFirst: true })
      .limit(input.limit)) as SupabaseResult<
      Array<{
        id: string;
        whatsapp: string;
        nome: string | null;
        status: LeadStatus;
        followup_count: number | null;
        last_followup_at: string | null;
        last_message_at: string | null;
        created_at: string;
        conversas:
          | Array<{ id: string; agent_mode: string; handoff_required: boolean }>
          | null;
      }>
    >;

    throwIfError(result);
    return (result.data ?? []).map((row) => {
      const conversas = row.conversas ?? [];
      // Preferimos a conversa de vendas; senão a primeira disponível.
      const vendas = conversas.find((c) => c.agent_mode === "vendas");
      const conversation = vendas ?? conversas[0] ?? null;
      return {
        leadId: row.id,
        conversationId: conversation?.id ?? null,
        whatsapp: row.whatsapp,
        nome: row.nome,
        status: row.status,
        followupCount: row.followup_count ?? 0,
        lastFollowupAt: row.last_followup_at,
        referenceAt: row.last_message_at ?? row.created_at,
        handoffRequired: conversas.some((c) => c.handoff_required),
      };
    });
  }

  async markLeadFollowup(input: {
    leadId: string;
    followupNumber: number;
    at: string;
  }): Promise<void> {
    const result = (await this.supabase
      .from("leads_oficina")
      .update({
        followup_count: input.followupNumber,
        last_followup_at: input.at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId)) as SupabaseResult<null>;

    throwIfError(result);
  }


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
    representanteCodigo?: string | null;
  }) {
    const existingResult = (await this.supabase
      .from("leads_oficina")
      .select("id,nome,origem,status,metadata,representante_id")
      .eq("whatsapp", input.whatsapp)
      .maybeSingle()) as SupabaseResult<{
      id: string;
      nome: string | null;
      origem: "landing_page" | "manual_whatsapp";
      status: LeadStatus;
      metadata: Record<string, unknown>;
      representante_id: string | null;
    }>;

    throwIfError(existingResult);

    const merged = mergeLeadForInbound(existingResult.data, {
      nome: input.nome,
      origem: input.origem,
      status: input.status,
    });

    // ADR-0019: atribui representante apenas se o lead ainda nao tem um e o
    // codigo resolve para um representante ativo. Codigo invalido e ignorado.
    let representanteId: string | null = null;
    if (input.representanteCodigo && !existingResult.data?.representante_id) {
      representanteId = await this.resolveRepresentanteIdByCodigo(input.representanteCodigo);
    }

    const result = (await this.supabase
      .from("leads_oficina")
      .upsert(
        {
          whatsapp: input.whatsapp,
          nome: merged.nome,
          origem: merged.origem,
          status: merged.status,
          ...(representanteId ? { representante_id: representanteId } : {}),
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

  private async resolveRepresentanteIdByCodigo(codigo: string): Promise<string | null> {
    const result = (await this.supabase
      .from("representantes")
      .select("id")
      .ilike("codigo", codigo)
      .eq("ativo", true)
      .is("deleted_at", null)
      .maybeSingle()) as SupabaseResult<{ id: string }>;

    if (result.error) return null;
    return result.data?.id ?? null;
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

  async getOficinaById(input: { oficinaId: string }) {
    const result = (await this.supabase
      .from("oficinas")
      .select("id,nome,whatsapp_principal,dias_lembrete_padrao")
      .eq("id", input.oficinaId)
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

    const distinctOffices = new Set(
      (fallback.data ?? [])
        .map((row) => row.oficina_id)
        .filter((value): value is string => Boolean(value)),
    );

    if (distinctOffices.size > 1) {
      return this.upsertSupportConversation({
        whatsapp: input.whatsapp,
        context: {
          ambiguousReminderLookup: true,
          supportHandoffReason: "cliente_final_ambiguo",
        },
      });
    }

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

  // Reconhece um cliente final que respondeu à CONFIRMAÇÃO de serviço, antes de
  // existir qualquer lembrete (ADR-0018). A confirmação cria a conversa
  // cliente_final em `conversas` (chaveada por participant_whatsapp), mas sem
  // lembrete — por isso `findReminderConversationByWhatsapp` não a acha. Aqui
  // vamos direto na conversa, e detectamos ambiguidade multi-oficina pelo
  // histórico de outbound (espelhando o lookup de lembrete).
  async findClienteFinalConversationByWhatsapp(input: { whatsapp: string }) {
    const outbound = (await this.supabase
      .from("outbound_messages")
      .select("oficina_id")
      .eq("to_whatsapp", input.whatsapp)
      .not("oficina_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(10)) as SupabaseResult<Array<{ oficina_id: string | null }>>;

    throwIfError(outbound);

    const distinctOffices = new Set(
      (outbound.data ?? [])
        .map((row) => row.oficina_id)
        .filter((value): value is string => Boolean(value)),
    );

    if (distinctOffices.size > 1) {
      return this.upsertSupportConversation({
        whatsapp: input.whatsapp,
        context: {
          ambiguousReminderLookup: true,
          supportHandoffReason: "cliente_final_ambiguo",
        },
      });
    }

    const conversation = (await this.supabase
      .from("conversas")
      .select("id,lead_id,oficina_id,cliente_id,participant_type,agent_mode,context")
      .eq("participant_whatsapp", input.whatsapp)
      .eq("participant_type", "cliente_final")
      .order("last_message_at", { ascending: false })
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

    throwIfError(conversation);

    if (!conversation.data?.cliente_id || !conversation.data.oficina_id) {
      return null;
    }

    return mapConversation(conversation.data);
  }

  async upsertSupportConversation(input: {
    whatsapp: string;
    context?: ConversationContext;
  }) {
    const result = (await this.supabase
      .from("conversas")
      .upsert(
        {
          lead_id: null,
          oficina_id: null,
          cliente_id: null,
          participant_whatsapp: input.whatsapp,
          participant_type: "contato_desconhecido",
          agent_mode: "suporte",
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
    // CV7: ao passar pro humano, silencia o bot por 24h (bot_muted) — resolve o
    // bot atropelar o humano no pós-handoff. Limpo quando o admin resolve o
    // handoff (lib/admin/conversas.ts) ou expira sozinho.
    const mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = (await this.supabase
      .from("conversas")
      .update({
        handoff_required: true,
        handoff_reason: input.reason,
        bot_muted_until: mutedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.conversationId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async saveMetaPhoneStatus(input: {
    displayPhoneNumber: string;
    qualityRating: string | null;
    event: string | null;
    currentLimit: string | null;
    raw: Record<string, unknown>;
  }): Promise<void> {
    // CV7: upsert do último evento de qualidade por número.
    const result = (await this.supabase.from("meta_phone_status").upsert(
      {
        display_phone_number: input.displayPhoneNumber,
        quality_rating: input.qualityRating,
        event: input.event,
        current_limit: input.currentLimit,
        raw: input.raw,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "display_phone_number" },
    )) as SupabaseResult<null>;

    throwIfError(result);
  }

  async isBotMuted(input: { conversationId: string }): Promise<boolean> {
    // CV7: true enquanto bot_muted_until estiver no futuro. Uma linha, escopada
    // pela conversa; o webhook usa isso como gate antes de responder.
    const result = (await this.supabase
      .from("conversas")
      .select("bot_muted_until")
      .eq("id", input.conversationId)
      .maybeSingle()) as SupabaseResult<{ bot_muted_until: string | null }>;

    throwIfError(result);
    const mutedUntil = result.data?.bot_muted_until;
    return mutedUntil ? new Date(mutedUntil).getTime() > Date.now() : false;
  }

  async getLatestPendingPagamento(input: { oficinaId: string }) {
    const result = (await this.supabase
      .from("pagamentos")
      .select("valor, vencimento, mp_preference_id")
      .eq("oficina_id", input.oficinaId)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SupabaseResult<{
      valor: number | string;
      vencimento: string | null;
      mp_preference_id: string | null;
    }>;

    if (result.error) throw new Error(result.error.message);
    if (!result.data) return null;

    return {
      valor:
        typeof result.data.valor === "number"
          ? result.data.valor
          : Number(result.data.valor),
      vencimento: result.data.vencimento,
      mpPreferenceId: result.data.mp_preference_id,
    };
  }

  async convertLeadToOficina(input: {
    leadId: string;
    conversationId: string;
    whatsapp: string;
    responsavel: string | null;
    nomeOficina: string | null;
  }) {
    const now = new Date().toISOString();

    // ADR-0019: a oficina herda o representante atribuido ao lead.
    const leadRepResult = (await this.supabase
      .from("leads_oficina")
      .select("representante_id,nome,nome_oficina,nome_responsavel")
      .eq("id", input.leadId)
      .maybeSingle()) as SupabaseResult<{
      representante_id: string | null;
      nome: string | null;
      nome_oficina: string | null;
      nome_responsavel: string | null;
    }>;
    throwIfError(leadRepResult);
    const lead = leadRepResult.data;
    const nome =
      lead?.nome_oficina?.trim() || input.nomeOficina?.trim() || OFICINA_SEM_NOME;
    const representanteId = leadRepResult.data?.representante_id ?? null;
    const responsavel =
      lead?.nome_responsavel?.trim() ||
      lead?.nome?.trim() ||
      input.responsavel?.trim() ||
      null;

    const oficinaResult = (await this.supabase
      .from("oficinas")
      .upsert(
        {
          nome,
          responsavel,
          whatsapp_principal: input.whatsapp,
          status: "ativa",
          plano: "teste",
          origem: "landing_whatsapp",
          ...(representanteId ? { representante_id: representanteId } : {}),
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

  async captureLeadWorkshopIdentity(input: {
    leadId: string;
    nomeOficina: string;
  }) {
    const nomeOficina = input.nomeOficina.trim();
    if (!nomeOficina) {
      throw new Error("Workshop name cannot be empty");
    }

    const current = (await this.supabase
      .from("leads_oficina")
      .select("nome,nome_oficina,nome_responsavel")
      .eq("id", input.leadId)
      .maybeSingle()) as SupabaseResult<{
      nome: string | null;
      nome_oficina: string | null;
      nome_responsavel: string | null;
    }>;
    throwIfError(current);
    if (!current.data) throw new Error("Lead not found");

    const nomeResponsavel =
      current.data.nome_responsavel?.trim() || current.data.nome?.trim() || null;
    const result = (await this.supabase
      .from("leads_oficina")
      .update({
        nome_oficina: nomeOficina,
        ...(current.data.nome_responsavel?.trim()
          ? {}
          : { nome_responsavel: nomeResponsavel }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId)) as SupabaseResult<null>;
    throwIfError(result);

    return { nomeOficina, nomeResponsavel };
  }

  async updateOficinaNome(input: { oficinaId: string; nome: string }) {
    const nome = input.nome.trim();
    if (!nome) return;

    const result = (await this.supabase
      .from("oficinas")
      .update({ nome, updated_at: new Date().toISOString() })
      .eq("id", input.oficinaId)) as SupabaseResult<null>;

    throwIfError(result);
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
      p_tipo_servico: input.tipoServico,
      p_marca_peca: input.marcaPeca,
    })) as SupabaseResult<{
      cliente_id: string;
      veiculo_id: string;
      servico_id: string;
      lembrete_id: string | null;
      scheduled_at: string | null;
      dias_lembrete: number;
    }>;

    throwIfError(result);

    return {
      clienteId: result.data!.cliente_id,
      veiculoId: result.data!.veiculo_id,
      servicoId: result.data!.servico_id,
      lembreteId: result.data!.lembrete_id,
      scheduledAt: result.data!.scheduled_at ?? null,
      diasLembrete: result.data!.dias_lembrete,
    };
  }

  async countInboundMediaInLastDay(input: { whatsappFrom: string }): Promise<number> {
    // Conta image+document inbound da mesma conversa (resolvida via número).
    // Janela rolling de 24h. Usamos `direction='inbound'` e
    // `media_type in ('image','document')` filtrando via inner-join com
    // `conversas.whatsapp_from`.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await this.supabase
      .from("mensagens")
      .select("id, conversas!inner(whatsapp_from)", { count: "exact", head: true })
      .eq("direction", "inbound")
      .in("media_type", ["image", "document"])
      .gte("created_at", cutoff)
      .eq("conversas.whatsapp_from", input.whatsappFrom);

    if (error) {
      // Falha do rate limit não deve quebrar o webhook — log e devolve 0
      // (permite a mensagem passar como se não houvesse limite).
      console.error("countInboundMediaInLastDay failed", error.message);
      return 0;
    }
    return count ?? 0;
  }

  async saveInboundMessage(input: {
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
    transcriptionStatus?: "success" | "failed" | "empty" | "timeout" | null;
    transcriptionError?: string | null;
    audioDurationMs?: number | null;
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
        media_type: input.mediaType ?? "text",
        media_id: input.mediaId ?? null,
        transcription: input.transcription ?? null,
        transcription_status: input.transcriptionStatus ?? null,
        transcription_error: input.transcriptionError ?? null,
        audio_duration_ms: input.audioDurationMs ?? null,
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

  async savePerguntaSemResposta(input: {
    conversationId: string;
    leadId: string | null;
    oficinaId?: string | null;
    agentMode: string;
    pergunta: string;
    respostaEnviada: string;
    motivo: "dont_know";
    geracaoModo: "sombra" | "on";
    promptVersion: string;
  }) {
    const result = (await this.supabase.from("perguntas_sem_resposta").insert({
      conversa_id: input.conversationId,
      lead_id: input.leadId,
      oficina_id: input.oficinaId ?? null,
      agent_mode: input.agentMode,
      pergunta: input.pergunta,
      resposta_enviada: input.respostaEnviada,
      motivo: input.motivo,
      geracao_modo: input.geracaoModo,
      prompt_version: input.promptVersion,
    })) as SupabaseResult<null>;

    throwIfError(result);
  }

  async saveSalesIntentDivergence(input: {
    conversationId: string;
    leadId: string | null;
    message: string;
    audit: SalesClassificationAudit;
  }) {
    const result = (await this.supabase.from("divergencias_intencao_vendas").insert({
      conversa_id: input.conversationId,
      lead_id: input.leadId,
      mensagem: input.message.slice(0, 500),
      intent_deterministico: input.audit.deterministicIntent,
      confidence_deterministica: input.audit.deterministicConfidence,
      intent_llm: input.audit.llmIntent,
      confidence_llm: input.audit.llmConfidence,
      intent_aplicado: input.audit.appliedIntent,
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
    messageKind?: "text" | "template";
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: unknown;
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
        message_kind: input.messageKind ?? "text",
        template_name: input.templateName ?? null,
        template_language: input.templateLanguage ?? null,
        template_params: input.templateParams ?? null,
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
        provider_error_code: null,
        provider_error_message: null,
        next_attempt_at: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.outboundMessageId)) as SupabaseResult<null>;

    throwIfError(result);
  }

  async markOutboundFailed(input: {
    outboundMessageId: string;
    errorMessage: string;
    providerErrorCode?: string | null;
    providerErrorMessage?: string | null;
    response?: unknown;
    attempts?: number;
  }) {
    const updates: Record<string, unknown> = {
      status: "failed",
      error_message: input.errorMessage,
      provider_error_code: input.providerErrorCode ?? null,
      provider_error_message: input.providerErrorMessage ?? null,
      provider_response: input.response ?? null,
      updated_at: new Date().toISOString(),
    };

    if (input.attempts !== undefined) {
      updates.attempts = input.attempts;
      updates.next_attempt_at = null;
    }

    const result = (await this.supabase
      .from("outbound_messages")
      .update(updates)
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
    lastAttemptAt?: string | null;
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

    if (input.lastAttemptAt !== undefined) {
      updates.last_attempt_at = input.lastAttemptAt;
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
        template_name?: string | null;
        template_language?: string | null;
        tipo_servico?: string | null;
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
      templateName: row.template_name ?? null,
      templateLanguage: row.template_language ?? null,
      tipoServico: (row.tipo_servico as TipoServico | undefined) ?? null,
    }));
  }

  async archiveReminderQueueMessage(input: { queueMessageId: number }) {
    const result = (await this.supabase.rpc("archive_whatsapp_reminder_message", {
      p_queue_message_id: input.queueMessageId,
    })) as SupabaseResult<boolean>;

    throwIfError(result);
    return Boolean(result.data);
  }

  async requeueReminderQueueMessage(input: {
    outboundMessageId: string;
    lembreteId: string;
    oficinaId: string;
    clienteId: string;
    delaySeconds: number;
  }) {
    const result = (await this.supabase.rpc("requeue_whatsapp_reminder_message", {
      p_outbound_message_id: input.outboundMessageId,
      p_lembrete_id: input.lembreteId,
      p_oficina_id: input.oficinaId,
      p_cliente_id: input.clienteId,
      p_delay_seconds: input.delaySeconds,
    })) as SupabaseResult<number>;

    throwIfError(result);
    return result.data ?? null;
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
