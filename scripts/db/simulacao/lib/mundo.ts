// Modelo em memória do mundo simulado: uma lista por tabela, com os mesmos nomes de coluna do banco.
// As funções aqui gravam o "rastro" que o webhook real deixaria (evento → mensagem → outbox → tool call).
import type { Rng } from "./prng";
import { iso } from "./tempo";
import { corpoInterativo, type Botao } from "./copy";

export type Row = Record<string, unknown>;

export type Conversa = {
  id: string;
  lead_id: string | null;
  oficina_id: string | null;
  cliente_id: string | null;
  participant_whatsapp: string;
  participant_type: "lead_oficina" | "oficina_cliente" | "cliente_final" | "contato_desconhecido";
  agent_mode: "vendas" | "onboarding" | "operacao" | "cliente_final_lembrete" | "suporte" | "cobranca";
  handoff_required: boolean;
  handoff_reason: string | null;
  last_message_at: number | null;
  created_at: number;
  updated_at: number;
  context: Row;
  bot_muted_until: null;
};

export class Mundo {
  readonly rng: Rng;
  readonly runId: string;
  readonly ate: number; // "agora" (ms)

  representantes: Row[] = [];
  admin_users_extra: Row[] = [];
  oficinas: Row[] = [];
  leads: Row[] = [];
  link_cliques: Row[] = [];
  clientes: Row[] = [];
  veiculos: Row[] = [];
  servicos: Row[] = [];
  lembretes: Row[] = [];
  conversas: Conversa[] = [];
  mensagens: Row[] = [];
  outbound: Row[] = [];
  eventos: Row[] = [];
  tool_calls: Row[] = [];
  pagamentos: Row[] = [];
  comissoes: Row[] = [];
  cobranca_jobs: Row[] = [];
  audit: Row[] = [];
  perguntas: Row[] = [];
  divergencias: Row[] = [];
  gatilhos: Row[] = [];
  prospeccao_areas: Row[] = [];
  prospeccao_execucoes: Row[] = [];
  prospeccao_estab: Row[] = [];
  ad_insights: Row[] = [];
  meta_phone_status: Row[] = [];
  oficina_members: Row[] = [];

  private wamidSeq = 0;
  private conversaPorChave = new Map<string, Conversa>();

  constructor(rng: Rng, runId: string, ate: number) {
    this.rng = rng;
    this.runId = runId;
    this.ate = ate;
  }

  wamid(): string {
    this.wamidSeq += 1;
    return `wamid.SIM.${this.runId}.${this.wamidSeq.toString(36).padStart(6, "0")}`;
  }

  conversa(input: {
    whatsapp: string;
    agent_mode: Conversa["agent_mode"];
    participant_type: Conversa["participant_type"];
    lead_id?: string | null;
    oficina_id?: string | null;
    cliente_id?: string | null;
    em: number;
  }): Conversa {
    const chave = `${input.whatsapp}|${input.agent_mode}`;
    const existente = this.conversaPorChave.get(chave);
    if (existente) return existente;
    const c: Conversa = {
      id: this.rng.uuid(),
      lead_id: input.lead_id ?? null,
      oficina_id: input.oficina_id ?? null,
      cliente_id: input.cliente_id ?? null,
      participant_whatsapp: input.whatsapp,
      participant_type: input.participant_type,
      agent_mode: input.agent_mode,
      handoff_required: false,
      handoff_reason: null,
      last_message_at: null,
      created_at: input.em,
      updated_at: input.em,
      context: {},
      bot_muted_until: null,
    };
    this.conversas.push(c);
    this.conversaPorChave.set(chave, c);
    return c;
  }

  /** Muda o modo da conversa mantendo a mesma linha (índice único é (whatsapp, agent_mode)). */
  mudarModo(c: Conversa, modo: Conversa["agent_mode"], tipo: Conversa["participant_type"], em: number) {
    this.conversaPorChave.delete(`${c.participant_whatsapp}|${c.agent_mode}`);
    c.agent_mode = modo;
    c.participant_type = tipo;
    c.updated_at = Math.max(c.updated_at, em);
    this.conversaPorChave.set(`${c.participant_whatsapp}|${modo}`, c);
  }

  /** Mensagem recebida: whatsapp_events + mensagens(inbound). */
  inbound(c: Conversa, input: {
    em: number;
    body: string;
    nomePerfil?: string | null;
    media?: "audio" | "image";
    audioMs?: number;
    botao?: Botao;
    referral?: Row | null;
    contexto?: string | null;
  }): string {
    const id = this.wamid();
    const ts = Math.floor(input.em / 1000);
    const from = c.participant_whatsapp.replace("+", "");
    const msg: Row = { from, id, timestamp: String(ts) };
    if (input.botao) {
      msg.type = "interactive";
      msg.interactive = { type: "button_reply", button_reply: { id: input.botao.id, title: input.botao.title } };
    } else if (input.media === "audio") {
      msg.type = "audio";
      msg.audio = { id: `sim-audio-${id.slice(-8)}`, mime_type: "audio/ogg; codecs=opus", voice: true };
    } else {
      msg.type = "text";
      msg.text = { body: input.body };
    }
    if (input.referral) msg.referral = input.referral;
    if (input.contexto) msg.context = { id: input.contexto };
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "sim-waba-id",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "55 00 90000-0000", phone_number_id: "sim-phone-number-id" },
            contacts: [{ wa_id: from, profile: { name: input.nomePerfil ?? from } }],
            messages: [msg],
          },
        }],
      }],
      sim_run_id: this.runId,
    };
    this.eventos.push({
      id: this.rng.uuid(),
      provider_event_id: id,
      whatsapp_message_id: id,
      payload,
      processed_at: iso(input.em + this.rng.int(200, 1800)),
      created_at: iso(input.em + 120),
      processing_status: "processed",
    });
    this.mensagens.push({
      id: this.rng.uuid(),
      conversa_id: c.id,
      lead_id: c.lead_id,
      oficina_id: c.oficina_id,
      cliente_id: c.cliente_id,
      direction: "inbound",
      whatsapp_message_id: id,
      body: input.body,
      raw_payload: msg,
      sent_at: iso(input.em),
      created_at: iso(input.em + 150),
      media_type: input.media ?? "text",
      media_id: input.media === "audio" ? (msg.audio as Row).id : null,
      transcription: input.media === "audio" ? input.body : null,
      transcription_status: input.media === "audio" ? "success" : null,
      audio_duration_ms: input.media === "audio" ? (input.audioMs ?? this.rng.int(4000, 22000)) : null,
    });
    c.last_message_at = Math.max(c.last_message_at ?? 0, input.em);
    c.updated_at = Math.max(c.updated_at, input.em);
    return id;
  }

  /** Mensagem enviada pelo bot: outbound_messages(sent) + mensagens(outbound). */
  outboundTexto(c: Conversa, input: {
    em: number;
    body: string;
    botoes?: Botao[];
    status?: "sent" | "failed";
    erro?: { code: string; message: string };
  }): string {
    const id = this.wamid();
    const falhou = input.status === "failed";
    const corpoOutbox = input.botoes ? corpoInterativo(input.body, input.botoes) : input.body;
    this.outbound.push({
      id: this.rng.uuid(),
      conversa_id: c.id,
      lead_id: c.lead_id,
      oficina_id: c.oficina_id,
      cliente_id: c.cliente_id,
      to_whatsapp: c.participant_whatsapp,
      body: corpoOutbox,
      status: falhou ? "failed" : "sent",
      whatsapp_message_id: falhou ? null : id,
      provider_response: falhou ? null : { messaging_product: "whatsapp", messages: [{ id }] },
      error_message: falhou ? input.erro?.message ?? null : null,
      provider_error_code: falhou ? input.erro?.code ?? null : null,
      provider_error_message: falhou ? input.erro?.message ?? null : null,
      sent_at: falhou ? null : iso(input.em),
      created_at: iso(input.em - this.rng.int(300, 1500)),
      updated_at: iso(input.em),
      message_kind: "text",
      attempts: 1,
    });
    if (!falhou) {
      this.mensagens.push({
        id: this.rng.uuid(),
        conversa_id: c.id,
        lead_id: c.lead_id,
        oficina_id: c.oficina_id,
        cliente_id: c.cliente_id,
        direction: "outbound",
        whatsapp_message_id: id,
        body: input.body,
        raw_payload: { messaging_product: "whatsapp", messages: [{ id }] },
        provider_status: this.rng.weighted([["sent", 10], ["delivered", 55], ["read", 35]]),
        sent_at: iso(input.em),
        created_at: iso(input.em + 100),
        media_type: "text",
      });
    }
    c.updated_at = Math.max(c.updated_at, input.em);
    return id;
  }

  /** Template enviado (lembrete, confirmação, follow-up, cobrança). */
  outboundTemplate(c: Conversa, input: {
    em: number;
    template: string;
    params: string[] | Row;
    body: string;
    bodyMensagem?: string;
    lembrete_id?: string | null;
    status?: "sent" | "failed" | "pending";
    erro?: { code: string; message: string };
    attempts?: number;
  }): string {
    const id = this.wamid();
    const st = input.status ?? "sent";
    this.outbound.push({
      id: this.rng.uuid(),
      conversa_id: c.id,
      lead_id: c.lead_id,
      oficina_id: c.oficina_id,
      cliente_id: c.cliente_id,
      to_whatsapp: c.participant_whatsapp,
      body: input.body,
      status: st,
      whatsapp_message_id: st === "sent" ? id : null,
      provider_response: st === "sent" ? { messaging_product: "whatsapp", messages: [{ id, message_status: "accepted" }] } : null,
      error_message: st === "failed" ? input.erro?.message ?? null : null,
      provider_error_code: st === "failed" ? input.erro?.code ?? null : null,
      provider_error_message: st === "failed" ? input.erro?.message ?? null : null,
      sent_at: st === "sent" ? iso(input.em) : null,
      created_at: iso(input.em - this.rng.int(2000, 20000)),
      updated_at: iso(input.em),
      message_kind: "template",
      template_name: input.template,
      template_language: "pt_BR",
      template_params: input.params,
      lembrete_id: input.lembrete_id ?? null,
      attempts: input.attempts ?? (st === "pending" ? 0 : 1),
    });
    if (st === "sent") {
      this.mensagens.push({
        id: this.rng.uuid(),
        conversa_id: c.id,
        lead_id: c.lead_id,
        oficina_id: c.oficina_id,
        cliente_id: c.cliente_id,
        direction: "outbound",
        whatsapp_message_id: id,
        body: input.bodyMensagem ?? input.body,
        raw_payload: { messaging_product: "whatsapp", messages: [{ id, message_status: "accepted" }] },
        provider_status: this.rng.weighted([["sent", 12], ["delivered", 53], ["read", 35]]),
        sent_at: iso(input.em),
        created_at: iso(input.em + 100),
        media_type: "text",
      });
    }
    c.updated_at = Math.max(c.updated_at, input.em);
    return id;
  }

  tool(c: Conversa, input: { em: number; nome: string; input: Row; output: Row; cliente_id?: string | null }) {
    this.tool_calls.push({
      id: this.rng.uuid(),
      conversa_id: c.id,
      lead_id: c.lead_id,
      oficina_id: c.oficina_id,
      cliente_id: input.cliente_id ?? c.cliente_id,
      tool_name: input.nome,
      input: input.input,
      output: input.output,
      created_at: iso(input.em + this.rng.int(50, 900)),
    });
  }

  /** Auditoria da camada conversacional (reply_generation). */
  geracao(c: Conversa, input: {
    em: number;
    agentMode: string;
    intent: string | null;
    userMessage: string;
    deterministicReply: string;
    generated: string | null;
    mode?: "rewrite" | "respond";
  }) {
    const aprovado = input.generated !== null;
    this.tool(c, {
      em: input.em,
      nome: "reply_generation",
      input: {
        mode: "on",
        intent: input.intent,
        agentMode: input.agentMode,
        userMessage: input.userMessage,
        promptVersion: "cv2-2",
        generationMode: input.mode ?? "rewrite",
        deterministicReply: input.deterministicReply,
      },
      output: {
        approved: aprovado,
        generated: input.generated,
        usedFallback: !aprovado,
        rejectionReason: aprovado ? null : this.rng.weighted([["generation_failed_or_null", 50], ["literal_ausente", 20], ["link_nao_permitido", 15], ["muito_longa", 15]]),
      },
    });
  }

  auditoria(input: { em: number; admin_id: string | null; acao: string; entidade: string; entidade_id: string | null; payload: Row; ip?: string | null }) {
    this.audit.push({
      id: this.rng.uuid(),
      admin_id: input.admin_id,
      acao: input.acao,
      entidade: input.entidade,
      entidade_id: input.entidade_id,
      payload: { ...input.payload, sim_run_id: this.runId },
      ip: input.ip ?? null,
      created_at: iso(input.em),
    });
  }
}
