import OpenAI from "openai";

import { audioFallbackMessage } from "./audio-fallbacks";
import {
  productLabelForConfirmation,
  renderServiceConfirmation,
  serviceConfirmationParams,
  SERVICE_CONFIRMATION_PARAM_NAMES,
  SERVICE_CONFIRMATION_TEMPLATE,
} from "./service-confirmation";
import { unsupportedMediaFallback } from "./unsupported-media-fallbacks";
import { WhatsappCobrancaAgent } from "./cobranca-agent";
import { resolveWhatsappConversation } from "./conversation-router";
import {
  ADMIN_PAUSA_MESSAGE,
  getOficinaPauseState,
  INADIMPLENCIA_MESSAGE,
} from "./inadimplencia-guard";
import { WhatsappOnboardingAgent } from "./onboarding-agent";
import { extractRepresentanteCodigo, extractWorkshopName } from "./sales-agent";
import { OFICINA_SEM_NOME } from "./repository";
import { WhatsappReminderAgent } from "./reminder-agent";
import { WhatsappClienteFinalConciergeAgent } from "./cliente-final-concierge";
import { WhatsappSupportAgent } from "./support-agent";
import {
  OpenAiReplyGenerator,
  REPLY_GENERATOR_PROMPT_VERSION,
  maybeGenerateConversationalReply,
} from "./reply-generator";
import {
  buildOperationKnowledge,
  buildSalesKnowledge,
} from "./product-knowledge";
import {
  HANDOFF_SUMMARY_PROMPT_VERSION,
  OpenAiHandoffSummarizer,
  type HandoffSummarizer,
} from "./handoff-summary";
import { siteConfig, whatsappLink } from "../config";
import {
  extractInboundMessages,
  extractProviderEventId,
  extractStatusEvents,
  extractWhatsappMessageId,
} from "./payload";
import { verifyMetaSignature } from "./signature";
import { transcribeAudio, type TranscriptionResult } from "./transcription";
import { describeImage, type ImageVisionResult } from "./image-vision";
import {
  extractDocumentText,
  type DocumentExtractionResult,
} from "./document-text";
import type {
  ClienteFinalConciergeAgent,
  CobrancaAgent,
  CobrancaSubmode,
  ConversationAgentMode,
  InboundWhatsappMessage,
  OnboardingAgent,
  RecentMessage,
  RegisterServiceInput,
  ReminderAgent,
  ReplyGenerationMode,
  ReplyGenerator,
  SalesAgent,
  SalesButton,
  SupportAgent,
  TranscriptionStatus,
  WhatsappRepository,
  WhatsappSender,
} from "./types";

type WebhookEnv = {
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
};

export type MediaDownloader = {
  getMediaMetadata(mediaId: string): Promise<{ url: string; mimeType: string }>;
  downloadMedia(url: string): Promise<Buffer>;
};

export type AudioTranscriber = {
  transcribe(input: {
    audioBuffer: Buffer;
    mimeType: string;
  }): Promise<TranscriptionResult>;
};

export type ImageDescriber = {
  describe(input: {
    imageBuffer: Buffer;
    mimeType: string;
    caption?: string | null;
  }): Promise<ImageVisionResult>;
};

export type DocumentExtractor = {
  extract(input: {
    documentBuffer: Buffer;
    mimeType: string;
  }): Promise<DocumentExtractionResult>;
};

class OpenAiAudioTranscriber implements AudioTranscriber {
  private readonly openai: OpenAI | null;

  constructor(input?: { openai?: OpenAI | null }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null);
  }

  async transcribe(input: {
    audioBuffer: Buffer;
    mimeType: string;
  }): Promise<TranscriptionResult> {
    if (!this.openai) {
      return { status: "failed", error: "missing_openai_key" };
    }
    return transcribeAudio({
      openai: this.openai,
      audioBuffer: input.audioBuffer,
      mimeType: input.mimeType,
    });
  }
}

class DefaultDocumentExtractor implements DocumentExtractor {
  async extract(input: {
    documentBuffer: Buffer;
    mimeType: string;
  }): Promise<DocumentExtractionResult> {
    return extractDocumentText({
      documentBuffer: input.documentBuffer,
      mimeType: input.mimeType,
    });
  }
}

class OpenAiImageDescriber implements ImageDescriber {
  private readonly openai: OpenAI | null;

  constructor(input?: { openai?: OpenAI | null }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null);
  }

  async describe(input: {
    imageBuffer: Buffer;
    mimeType: string;
    caption?: string | null;
  }): Promise<ImageVisionResult> {
    if (!this.openai) {
      return { status: "failed", error: "missing_openai_key" };
    }
    return describeImage({
      openai: this.openai,
      imageBuffer: input.imageBuffer,
      mimeType: input.mimeType,
      caption: input.caption,
    });
  }
}

type HandlerDeps = {
  env: WebhookEnv;
  repository: WhatsappRepository;
  whatsapp: WhatsappSender;
  agent: SalesAgent;
  onboardingAgent?: OnboardingAgent;
  reminderAgent?: ReminderAgent;
  conciergeAgent?: ClienteFinalConciergeAgent;
  supportAgent?: SupportAgent;
  cobrancaAgent?: CobrancaAgent;
  replyGenerator?: ReplyGenerator;
  handoffSummarizer?: HandoffSummarizer;
  mediaDownloader?: MediaDownloader;
  audioTranscriber?: AudioTranscriber;
  imageDescriber?: ImageDescriber;
  documentExtractor?: DocumentExtractor;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown processing error";
}

function errorDetails(error: unknown) {
  const typed = error as {
    code?: string | number;
    providerMessage?: string;
    message?: string;
    response?: unknown;
  };

  return {
    message: typed.providerMessage ?? typed.message ?? "Unknown processing error",
    code: typed.code ? String(typed.code) : null,
    response: typed.response ?? null,
  };
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? null : null;
}

// Resumo de handoff de vendas (fase CV3). Gera um resumo curto da conversa e o
// envia ao WhatsApp comercial para o humano assumir com contexto. É BEST-EFFORT:
// qualquer falha (geração, envio, timeout) é engolida — nunca bloqueia o handoff
// nem a resposta ao lead (o link wa.me já saiu). Só roda quando a camada de
// geração está ativa (mode != off), para honrar "off = comportamento anterior".
async function sendHandoffSummary(input: {
  summarizer: HandoffSummarizer | undefined;
  whatsapp: WhatsappSender;
  repository: WhatsappRepository;
  handoffComercial: string;
  history: RecentMessage[];
  handoffReason: string;
  leadName: string | null;
  conversationId: string;
  leadId: string | null;
  oficinaId?: string | null;
}): Promise<void> {
  if (!input.summarizer) return;
  try {
    const summary = await input.summarizer.summarizeHandoff({
      history: input.history,
      handoffReason: input.handoffReason,
      leadName: input.leadName,
    });
    if (!summary) return;

    const sent = await input.whatsapp.sendTextMessage({
      to: input.handoffComercial,
      body: `Lead pra assumir (${input.handoffReason}):\n\n${summary}`,
    });

    await input.repository.saveAgentToolCall({
      conversationId: input.conversationId,
      leadId: input.leadId,
      oficinaId: input.oficinaId,
      toolName: "handoff_summary",
      input: {
        handoffReason: input.handoffReason,
        promptVersion: HANDOFF_SUMMARY_PROMPT_VERSION,
      },
      output: { summary, whatsappMessageId: sent.whatsappMessageId },
    });
  } catch {
    // best-effort: o resumo é conveniência para o humano, nunca um gate.
  }
}

function onboardingIntroMessage(nomeOficina?: string | null) {
  const nome = nomeOficina?.trim();
  const header =
    nome && nome !== OFICINA_SEM_NOME
      ? `Pronto, a ${nome} esta cadastrada.`
      : "Pronto, sua oficina esta cadastrada.";
  return [
    header,
    "",
    "Para registrar uma troca, me mande assim:",
    "",
    "Nome do cliente, carro, servico feito hoje e WhatsApp do cliente.",
    "",
    "Exemplo:",
    "Joao Silva, Civic 2018, troca de oleo hoje, 41999990000.",
  ].join("\n");
}

function localDateSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Hora local (0-23) no fuso America/Sao_Paulo — usada pela saudação temporal do
// agente de operação (bom dia / boa tarde / boa noite).
function localHourSaoPaulo() {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const value = hour.find((item) => item.type === "hour")?.value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed % 24;
}

function isOperationalMode(
  mode: ConversationAgentMode,
): mode is Extract<ConversationAgentMode, "onboarding" | "operacao"> {
  return mode === "onboarding" || mode === "operacao";
}

function isAudioMessage(inbound: InboundWhatsappMessage): inbound is InboundWhatsappMessage & {
  mediaType: "audio";
  mediaId: string;
} {
  return inbound.mediaType === "audio" && Boolean(inbound.mediaId);
}

function isImageMessage(inbound: InboundWhatsappMessage): inbound is InboundWhatsappMessage & {
  mediaType: "image";
  mediaId: string;
} {
  return inbound.mediaType === "image" && Boolean(inbound.mediaId);
}

function isDocumentMessage(inbound: InboundWhatsappMessage): inbound is InboundWhatsappMessage & {
  mediaType: "document";
  mediaId: string;
} {
  return inbound.mediaType === "document" && Boolean(inbound.mediaId);
}

async function processAudio(input: {
  inbound: InboundWhatsappMessage & { mediaType: "audio"; mediaId: string };
  mediaDownloader: MediaDownloader | null;
  audioTranscriber: AudioTranscriber | null;
}): Promise<{
  status: TranscriptionStatus;
  text: string;
  durationMs: number | null;
  error: string | null;
}> {
  if (!input.mediaDownloader || !input.audioTranscriber) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: "missing_audio_dependencies",
    };
  }

  let metadata: { url: string; mimeType: string };
  try {
    metadata = await input.mediaDownloader.getMediaMetadata(input.inbound.mediaId);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_metadata_failed",
    };
  }

  let buffer: Buffer;
  try {
    buffer = await input.mediaDownloader.downloadMedia(metadata.url);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_download_failed",
    };
  }

  const result = await input.audioTranscriber.transcribe({
    audioBuffer: buffer,
    mimeType: metadata.mimeType,
  });

  if (result.status === "success") {
    return {
      status: "success",
      text: result.text,
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "empty") {
    return {
      status: "empty",
      text: "",
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "timeout") {
    return {
      status: "timeout",
      text: "",
      durationMs: null,
      error: null,
    };
  }

  return {
    status: "failed",
    text: "",
    durationMs: null,
    error: result.error,
  };
}

// Processamento de imagem (ADR-0016). Mesmo formato de retorno de `processAudio`,
// reusa a coluna `transcription` para armazenar a descrição extraída — o nome
// da coluna fica "transcription" historicamente mas comporta também
// imagem/PDF (documentado em regras-de-negocio.md §17.7).
async function processImage(input: {
  inbound: InboundWhatsappMessage & { mediaType: "image"; mediaId: string };
  mediaDownloader: MediaDownloader | null;
  imageDescriber: ImageDescriber | null;
}): Promise<{
  status: ImageVisionResult["status"];
  text: string;
  durationMs: number | null;
  error: string | null;
}> {
  if (!input.mediaDownloader || !input.imageDescriber) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: "missing_image_dependencies",
    };
  }

  let metadata: { url: string; mimeType: string };
  try {
    metadata = await input.mediaDownloader.getMediaMetadata(input.inbound.mediaId);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_metadata_failed",
    };
  }

  let buffer: Buffer;
  try {
    buffer = await input.mediaDownloader.downloadMedia(metadata.url);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_download_failed",
    };
  }

  const result = await input.imageDescriber.describe({
    imageBuffer: buffer,
    mimeType: metadata.mimeType,
    caption: input.inbound.mediaCaption ?? null,
  });

  if (result.status === "success") {
    return {
      status: "success",
      text: result.text,
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "empty") {
    return {
      status: "empty",
      text: "",
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "timeout") {
    return {
      status: "timeout",
      text: "",
      durationMs: null,
      error: null,
    };
  }

  return {
    status: "failed",
    text: "",
    durationMs: null,
    error: result.error,
  };
}

function formatImageBody(description: string, caption: string | null | undefined): string {
  const captionFragment = caption?.trim()
    ? ` (legenda do usuário: "${caption.trim()}")`
    : "";
  return `[imagem] ${description}${captionFragment}`;
}

function formatDocumentBody(extracted: string, caption: string | null | undefined): string {
  const captionFragment = caption?.trim()
    ? ` (legenda do usuário: "${caption.trim()}")`
    : "";
  return `[documento] ${extracted}${captionFragment}`;
}

// Processamento de documento PDF (ADR-0016). Mesma estrutura de retorno de
// `processImage`/`processAudio`. Reusa as colunas `transcription`/`transcriptionStatus`.
async function processDocument(input: {
  inbound: InboundWhatsappMessage & { mediaType: "document"; mediaId: string };
  mediaDownloader: MediaDownloader | null;
  documentExtractor: DocumentExtractor | null;
}): Promise<{
  status: DocumentExtractionResult["status"];
  text: string;
  durationMs: number | null;
  error: string | null;
}> {
  if (!input.mediaDownloader || !input.documentExtractor) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: "missing_document_dependencies",
    };
  }

  let metadata: { url: string; mimeType: string };
  try {
    metadata = await input.mediaDownloader.getMediaMetadata(input.inbound.mediaId);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_metadata_failed",
    };
  }

  let buffer: Buffer;
  try {
    buffer = await input.mediaDownloader.downloadMedia(metadata.url);
  } catch (error) {
    return {
      status: "failed",
      text: "",
      durationMs: null,
      error: error instanceof Error ? error.message : "media_download_failed",
    };
  }

  const result = await input.documentExtractor.extract({
    documentBuffer: buffer,
    mimeType: metadata.mimeType,
  });

  if (result.status === "success") {
    return {
      status: "success",
      text: result.text,
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "empty") {
    return {
      status: "empty",
      text: "",
      durationMs: result.durationMs,
      error: null,
    };
  }

  if (result.status === "timeout") {
    return {
      status: "timeout",
      text: "",
      durationMs: null,
      error: null,
    };
  }

  return {
    status: "failed",
    text: "",
    durationMs: null,
    error: result.error,
  };
}

// Envia a confirmação de serviço ao cliente final via template aprovado.
// Retorna `true` apenas quando a mensagem foi efetivamente enviada. Qualquer
// pré-condição não satisfeita (sem consentimento, sem suporte a template, sem
// método de conversa) ou falha de envio retorna `false` sem lançar — a resposta
// para a oficina não pode depender deste envio.
async function sendServiceConfirmation(input: {
  deps: HandlerDeps;
  oficinaId: string;
  oficinaNome: string | null;
  clienteId: string;
  serviceInput: Omit<RegisterServiceInput, "oficinaId">;
}): Promise<boolean> {
  const { deps, oficinaId, clienteId, serviceInput } = input;

  if (!serviceInput.consentimentoWhatsapp) {
    return false;
  }
  if (!deps.whatsapp.sendTemplateMessage) {
    return false;
  }
  if (!deps.repository.upsertClienteFinalConversation) {
    return false;
  }

  const workshopName = input.oficinaNome ?? "sua oficina";
  const confirmationArgs = {
    customerName: serviceInput.nomeCliente,
    workshopName,
    vehicleDescription: serviceInput.veiculo,
    productLabel: productLabelForConfirmation({
      tipoServico: serviceInput.tipoServico,
      servico: serviceInput.servico,
    }),
  };
  const renderedBody = renderServiceConfirmation(confirmationArgs);
  const params = serviceConfirmationParams(confirmationArgs);

  // Botão "Chamar no WhatsApp" como CTA wa.me da oficina (ADR-0018). Gated por
  // env: só manda o parâmetro depois que o template na Meta tiver o botão de URL
  // `https://wa.me/{{1}}`. Enviar o componente antes da edição do template
  // quebraria o send (mismatch). O `{{1}}` é o número da oficina (só dígitos).
  let urlButtonParameter: string | undefined;
  if (
    process.env.WHATSAPP_CONFIRMACAO_BUTTON_WA_ME === "true" &&
    deps.repository.getOficinaById
  ) {
    const oficina = await deps.repository.getOficinaById({ oficinaId });
    const digits = oficina?.whatsappPrincipal?.replace(/\D/g, "");
    if (digits && digits.length >= 10) {
      urlButtonParameter = digits;
    }
  }

  let conversationId: string;
  try {
    const conversation = await deps.repository.upsertClienteFinalConversation({
      oficinaId,
      clienteId,
      whatsapp: serviceInput.whatsappCliente,
    });
    conversationId = conversation.id;
  } catch {
    // Sem conversa não há como persistir o outbound de forma consistente.
    return false;
  }

  const outbox = await deps.repository.createOutboundMessage({
    conversationId,
    leadId: null,
    oficinaId,
    to: serviceInput.whatsappCliente,
    body: renderedBody,
    messageKind: "template",
    templateName: SERVICE_CONFIRMATION_TEMPLATE.name,
    templateLanguage: SERVICE_CONFIRMATION_TEMPLATE.language,
    templateParams: params,
  });

  try {
    const sent = await deps.whatsapp.sendTemplateMessage({
      to: serviceInput.whatsappCliente,
      templateName: SERVICE_CONFIRMATION_TEMPLATE.name,
      languageCode: SERVICE_CONFIRMATION_TEMPLATE.language,
      bodyParameters: params,
      bodyParameterNames: [...SERVICE_CONFIRMATION_PARAM_NAMES],
      urlButtonParameter,
    });
    await deps.repository.markOutboundSent({
      outboundMessageId: outbox.id,
      whatsappMessageId: sent.whatsappMessageId,
      response: sent.response ?? null,
    });
    await deps.repository.saveOutboundMessage({
      conversationId,
      leadId: null,
      oficinaId,
      whatsappMessageId: sent.whatsappMessageId,
      body: renderedBody,
      rawMessage: sent.response ?? null,
      sentAt: new Date().toISOString(),
    });
    await deps.repository.saveAgentToolCall({
      conversationId,
      leadId: null,
      oficinaId,
      clienteId,
      toolName: "notify_cliente_confirmacao",
      input: { whatsapp: serviceInput.whatsappCliente, template: SERVICE_CONFIRMATION_TEMPLATE.name },
      output: { sent: true, whatsappMessageId: sent.whatsappMessageId },
    });
    return true;
  } catch (error) {
    const outboundError = errorDetails(error);
    await deps.repository.markOutboundFailed({
      outboundMessageId: outbox.id,
      errorMessage: outboundError.message,
      providerErrorCode: outboundError.code,
      providerErrorMessage: outboundError.message,
      response: outboundError.response,
    });
    await deps.repository.saveAgentToolCall({
      conversationId,
      leadId: null,
      oficinaId,
      clienteId,
      toolName: "notify_cliente_confirmacao",
      input: { whatsapp: serviceInput.whatsappCliente, template: SERVICE_CONFIRMATION_TEMPLATE.name },
      output: { sent: false, error: outboundError.message },
    });
    return false;
  }
}

export function createWhatsappWebhookHandlers(deps: HandlerDeps) {
  const onboardingAgent = deps.onboardingAgent ?? new WhatsappOnboardingAgent();
  const reminderAgent = deps.reminderAgent ?? new WhatsappReminderAgent();
  const conciergeAgent =
    deps.conciergeAgent ?? new WhatsappClienteFinalConciergeAgent();
  const supportAgent = deps.supportAgent ?? new WhatsappSupportAgent();
  const cobrancaAgent = deps.cobrancaAgent ?? new WhatsappCobrancaAgent();
  // Gerador conversacional (ADR-0020). So existe quando ha OPENAI key; ausente
  // => modo off efetivo (maybeGenerateConversationalReply cai na enlatada).
  const replyGenerator: ReplyGenerator | undefined =
    deps.replyGenerator ??
    (process.env.OPENAI_API_KEY ? new OpenAiReplyGenerator() : undefined);
  const handoffSummarizer: HandoffSummarizer | undefined =
    deps.handoffSummarizer ??
    (process.env.OPENAI_API_KEY ? new OpenAiHandoffSummarizer() : undefined);
  const mediaDownloader: MediaDownloader | null =
    deps.mediaDownloader ??
    (typeof (deps.whatsapp as Partial<MediaDownloader>).getMediaMetadata === "function" &&
    typeof (deps.whatsapp as Partial<MediaDownloader>).downloadMedia === "function"
      ? (deps.whatsapp as unknown as MediaDownloader)
      : null);
  const audioTranscriber: AudioTranscriber =
    deps.audioTranscriber ?? new OpenAiAudioTranscriber();
  const imageDescriber: ImageDescriber =
    deps.imageDescriber ?? new OpenAiImageDescriber();
  const documentExtractor: DocumentExtractor =
    deps.documentExtractor ?? new DefaultDocumentExtractor();

  return {
    async GET(request: Request) {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === deps.env.WHATSAPP_VERIFY_TOKEN && challenge) {
        return new Response(challenge, {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      return new Response("Forbidden", { status: 403 });
    },

    async POST(request: Request) {
      const appSecret = deps.env.WHATSAPP_APP_SECRET;
      if (!appSecret) {
        return jsonResponse({ ok: false, error: "missing_app_secret" }, { status: 500 });
      }

      const rawBody = await request.text();
      const validSignature = verifyMetaSignature({
        rawBody,
        signatureHeader: request.headers.get("x-hub-signature-256"),
        appSecret,
      });

      if (!validSignature) {
        return jsonResponse({ ok: false, error: "invalid_signature" }, { status: 401 });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
      }

      const savedEvent = await deps.repository.saveWhatsappEvent({
        providerEventId: extractProviderEventId(payload),
        whatsappMessageId: extractWhatsappMessageId(payload),
        payload,
      });

      if (savedEvent.duplicate) {
        return jsonResponse({ ok: true, duplicate: true });
      }

      const inboundMessages = extractInboundMessages(payload);
      const statusEvents = extractStatusEvents(payload);
      const processingErrors: Array<{
        whatsappMessageId: string;
        errorType: string;
        message: string;
      }> = [];

      for (const statusEvent of statusEvents) {
        try {
          if (deps.repository.updateMessageStatusByWhatsappMessageId) {
            await deps.repository.updateMessageStatusByWhatsappMessageId({
              whatsappMessageId: statusEvent.whatsappMessageId,
              providerStatus: statusEvent.status,
              providerErrorCode: statusEvent.errorCode,
              providerErrorMessage: statusEvent.errorMessage,
              rawStatus: statusEvent.rawStatus,
            });
          }

          if (deps.repository.updateOutboundStatusByWhatsappMessageId) {
            await deps.repository.updateOutboundStatusByWhatsappMessageId({
              whatsappMessageId: statusEvent.whatsappMessageId,
              providerStatus: statusEvent.status,
              providerErrorCode: statusEvent.errorCode,
              providerErrorMessage: statusEvent.errorMessage,
              rawStatus: statusEvent.rawStatus,
            });
          }

          if (deps.repository.updateReminderDeliveryStatusByWhatsappMessageId) {
            await deps.repository.updateReminderDeliveryStatusByWhatsappMessageId({
              whatsappMessageId: statusEvent.whatsappMessageId,
              providerStatus: statusEvent.status,
              providerErrorCode: statusEvent.errorCode,
              providerErrorMessage: statusEvent.errorMessage,
              rawStatus: statusEvent.rawStatus,
            });
          }
        } catch (error) {
          processingErrors.push({
            whatsappMessageId: statusEvent.whatsappMessageId,
            errorType: "status_processing_failed",
            message: errorMessage(error),
          });
        }
      }

      const salesConfig = deps.repository.getConfiguracoesVendedor
        ? await deps.repository.getConfiguracoesVendedor()
        : undefined;
      const faqs = deps.repository.listActiveFaqs
        ? await deps.repository.listActiveFaqs()
        : [];

      for (const inbound of inboundMessages) {
        // Transcrição de áudio (síncrona, timeout 15s). Resultado vira o
        // `inbound.body` consumido pelos agentes; em caso de falha o handler
        // envia um fallback contextual e não chama o agente.
        if (isAudioMessage(inbound)) {
          const audioResult = await processAudio({
            inbound,
            mediaDownloader,
            audioTranscriber,
          });
          inbound.transcriptionStatus = audioResult.status;
          inbound.transcriptionError = audioResult.error;
          inbound.audioDurationMs = audioResult.durationMs;
          if (audioResult.status === "success") {
            inbound.transcription = audioResult.text;
            inbound.body = audioResult.text;
          } else {
            inbound.transcription = null;
            inbound.body = "";
          }
        }

        // Rate limit por conversa (image+document, 24h). Antes de qualquer
        // chamada paga (vision/PDF) o webhook checa o contador. Excedido →
        // marca como `failed` e cai no fallback contextual já existente.
        // Configurável via `WHATSAPP_MEDIA_DAILY_LIMIT` (default 50).
        if (
          (isImageMessage(inbound) || isDocumentMessage(inbound)) &&
          typeof deps.repository.countInboundMediaInLastDay === "function"
        ) {
          const limit = Number.parseInt(
            process.env.WHATSAPP_MEDIA_DAILY_LIMIT ?? "50",
            10,
          );
          const count = await deps.repository.countInboundMediaInLastDay({
            whatsappFrom: inbound.normalizedFrom,
          });
          if (Number.isFinite(limit) && count >= limit) {
            inbound.transcriptionStatus = "failed";
            inbound.transcriptionError = "rate_limit";
            inbound.transcription = null;
            inbound.body = "";
            // Pula image/document processing — o branch genérico de fallback
            // abaixo enviará a mensagem contextual de `image`/`document`.
          }
        }

        // Descrição de imagem (ADR-0016). Reusa `transcription` e
        // `transcriptionStatus` para guardar a saída do vision — o agente em
        // cena consome o `inbound.body` formatado como "[imagem] ...". Em
        // falha/empty/timeout, o branch genérico abaixo (que cobre
        // mediaType ≠ text/audio) envia o fallback contextual de `image`.
        if (isImageMessage(inbound) && inbound.transcriptionError !== "rate_limit") {
          const imageResult = await processImage({
            inbound,
            mediaDownloader,
            imageDescriber,
          });
          inbound.transcriptionStatus =
            imageResult.status === "success"
              ? "success"
              : imageResult.status === "empty"
                ? "empty"
                : imageResult.status === "timeout"
                  ? "timeout"
                  : "failed";
          inbound.transcriptionError = imageResult.error;
          if (imageResult.status === "success") {
            inbound.transcription = imageResult.text;
            inbound.body = formatImageBody(imageResult.text, inbound.mediaCaption);
          } else {
            inbound.transcription = null;
            inbound.body = "";
          }
        }

        // Extração de texto de PDF (ADR-0016). PDFs escaneados (texto útil
        // < 50 chars) caem em `empty` e disparam fallback contextual. Não
        // roteamos pra vision pra evitar custos imprevisíveis com PDFs
        // grandes — fica como melhoria futura.
        if (isDocumentMessage(inbound) && inbound.transcriptionError !== "rate_limit") {
          const docResult = await processDocument({
            inbound,
            mediaDownloader,
            documentExtractor,
          });
          inbound.transcriptionStatus =
            docResult.status === "success"
              ? "success"
              : docResult.status === "empty"
                ? "empty"
                : docResult.status === "timeout"
                  ? "timeout"
                  : "failed";
          inbound.transcriptionError = docResult.error;
          if (docResult.status === "success") {
            inbound.transcription = docResult.text;
            inbound.body = formatDocumentBody(docResult.text, inbound.mediaCaption);
          } else {
            inbound.transcription = null;
            inbound.body = "";
          }
        }

        const resolved = await resolveWhatsappConversation({
          repository: deps.repository,
          whatsapp: inbound.normalizedFrom,
          contactName: inbound.contactName,
          body: inbound.body,
          contextWhatsappMessageId: inbound.contextWhatsappMessageId,
          landingPhrases: salesConfig?.frasesLanding,
        });

        // ADR-0019: o router ja extraiu/atribuiu o codigo do representante.
        // Remove o token do body para o agente e a mensagem persistida nao o
        // carregarem (o payload bruto preserva o original para auditoria).
        const repToken = extractRepresentanteCodigo(inbound.body);
        if (repToken.codigo) {
          inbound.body = repToken.cleaned;
        }
        const savedInbound = await deps.repository.saveInboundMessage({
          conversationId: resolved.conversationId,
          leadId: resolved.leadId,
          oficinaId: resolved.oficinaId,
          whatsappMessageId: inbound.whatsappMessageId,
          body: inbound.body,
          rawMessage: inbound.rawMessage,
          sentAt: inbound.timestamp?.toISOString() ?? null,
          mediaType: inbound.mediaType,
          mediaId: inbound.mediaId ?? null,
          transcription: inbound.transcription ?? null,
          transcriptionStatus: inbound.transcriptionStatus ?? null,
          transcriptionError: inbound.transcriptionError ?? null,
          audioDurationMs: inbound.audioDurationMs ?? null,
        });

        if (savedInbound.duplicate) {
          continue;
        }

        // Áudio que não transcreveu: responde com fallback do agente em cena
        // e pula o roteamento normal. Roteamento foi feito acima só para
        // resolvermos `agent_mode`. Persiste o outbound normalmente.
        if (
          inbound.mediaType === "audio" &&
          inbound.transcriptionStatus &&
          inbound.transcriptionStatus !== "success"
        ) {
          const fallbackBody = audioFallbackMessage(
            resolved.agentMode,
            inbound.transcriptionStatus,
          );
          const outbox = await deps.repository.createOutboundMessage({
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            to: inbound.normalizedFrom,
            body: fallbackBody,
          });
          try {
            const sent = await deps.whatsapp.sendTextMessage({
              to: inbound.normalizedFrom,
              body: fallbackBody,
            });
            await deps.repository.markOutboundSent({
              outboundMessageId: outbox.id,
              whatsappMessageId: sent.whatsappMessageId,
              response: sent.response ?? null,
            });
            await deps.repository.saveOutboundMessage({
              conversationId: resolved.conversationId,
              leadId: resolved.leadId,
              oficinaId: resolved.oficinaId,
              whatsappMessageId: sent.whatsappMessageId,
              body: fallbackBody,
              rawMessage: sent.response ?? null,
              sentAt: new Date().toISOString(),
            });
          } catch (error) {
            const outboundError = errorDetails(error);
            await deps.repository.markOutboundFailed({
              outboundMessageId: outbox.id,
              errorMessage: outboundError.message,
              providerErrorCode: outboundError.code,
              providerErrorMessage: outboundError.message,
              response: outboundError.response,
            });
          }
          continue;
        }

        // Mídia não-texto e não-áudio: imagem, documento, sticker, vídeo,
        // localização, contatos ou tipo desconhecido. Imagem e documento têm
        // pipeline próprio (ADR-0016) — se `transcriptionStatus === 'success'`
        // foi processada com êxito antes deste branch e segue para o agente.
        // Os demais (sticker/video/location/contacts/unsupported) e os casos
        // de falha de image/document caem aqui em fallback contextual.
        const imageOrDocumentProcessed =
          (inbound.mediaType === "image" || inbound.mediaType === "document") &&
          inbound.transcriptionStatus === "success";

        if (
          inbound.mediaType !== "text" &&
          inbound.mediaType !== "audio" &&
          !imageOrDocumentProcessed
        ) {
          const fallbackBody = unsupportedMediaFallback(
            resolved.agentMode,
            inbound.mediaType,
          );
          const outbox = await deps.repository.createOutboundMessage({
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            to: inbound.normalizedFrom,
            body: fallbackBody,
          });
          try {
            const sent = await deps.whatsapp.sendTextMessage({
              to: inbound.normalizedFrom,
              body: fallbackBody,
            });
            await deps.repository.markOutboundSent({
              outboundMessageId: outbox.id,
              whatsappMessageId: sent.whatsappMessageId,
              response: sent.response ?? null,
            });
            await deps.repository.saveOutboundMessage({
              conversationId: resolved.conversationId,
              leadId: resolved.leadId,
              oficinaId: resolved.oficinaId,
              whatsappMessageId: sent.whatsappMessageId,
              body: fallbackBody,
              rawMessage: sent.response ?? null,
              sentAt: new Date().toISOString(),
            });
          } catch (error) {
            const outboundError = errorDetails(error);
            await deps.repository.markOutboundFailed({
              outboundMessageId: outbox.id,
              errorMessage: outboundError.message,
              providerErrorCode: outboundError.code,
              providerErrorMessage: outboundError.message,
              response: outboundError.response,
            });
          }
          continue;
        }

        // Estado de pausa da oficina: rotear para cobranca-agent (inadimplencia/winback)
        // ou responder com mensagem fixa (pausa administrativa, ou mensagem que nao
        // veio da oficina-cliente).
        let effectiveAgentMode: ConversationAgentMode = resolved.agentMode;
        let cobrancaSubmode: CobrancaSubmode | null = null;
        if (resolved.oficinaId) {
          const pauseState = await getOficinaPauseState(resolved.oficinaId);
          if (pauseState.paused) {
            const isOficinaConversation =
              resolved.participantType === "oficina_cliente";
            if (
              pauseState.motivoPausa === "admin" ||
              !isOficinaConversation
            ) {
              const fixedMessage =
                pauseState.motivoPausa === "admin"
                  ? ADMIN_PAUSA_MESSAGE
                  : INADIMPLENCIA_MESSAGE;
              try {
                await deps.whatsapp.sendTextMessage({
                  to: inbound.normalizedFrom,
                  body: fixedMessage,
                });
              } catch (err) {
                console.error("pausa fixed message send failed", err);
              }
              continue;
            }
            effectiveAgentMode = "cobranca";
            cobrancaSubmode =
              pauseState.motivoPausa === "inadimplencia"
                ? "cobranca_inadimplente"
                : "cobranca_winback";
          }
        }

        try {
          let replyBody: string;
          // Blindagem CV1 (ADR-0020): só respostas de conversa livre podem ser
          // reescritas pela IA. Respostas transacionais (pergunta de campo,
          // resumo de confirmação, "cliente cadastrado", captura de nome da
          // oficina) permanecem determinísticas — preserva a rede de segurança
          // da ADR-0017 (a oficina confere o dado exato antes de gravar). Vendas
          // e demais agentes conversacionais seguem elegíveis (default true).
          let allowGeneration = true;
          // Como gerar quando elegível (ADR-0022): rewrite pole a enlatada;
          // respond responde a pergunta grounded. Só a categoria `pergunta`
          // da operação seta respond hoje.
          let generationMode: ReplyGenerationMode = "rewrite";
          // Fallback nível 2 de vendas (CV3): quando setado, o envio usa botões
          // interativos em vez de texto. Determinístico — a camada de geração é
          // pulada (allowGeneration = false abaixo).
          let interactiveButtons:
            | { bodyText: string; buttons: ReadonlyArray<SalesButton> }
            | null = null;
          const normalizedBody = inbound.body.trim().toLowerCase();

          if (
            normalizedBody === "/suporte" &&
            effectiveAgentMode === "operacao"
          ) {
            if (deps.repository.updateConversationModeAndContext) {
              await deps.repository.updateConversationModeAndContext({
                conversationId: resolved.conversationId,
                agentMode: "suporte",
              });
            }
            replyBody =
              "Ok, modo suporte ativo. Me conta o que esta acontecendo. Mande /voltar quando quiser sair.";
          } else if (
            normalizedBody === "/voltar" &&
            effectiveAgentMode === "suporte"
          ) {
            if (deps.repository.updateConversationModeAndContext) {
              await deps.repository.updateConversationModeAndContext({
                conversationId: resolved.conversationId,
                agentMode: "operacao",
              });
            }
            replyBody =
              "Pronto, voltei pro modo normal. O que precisa hoje?";
          } else if (effectiveAgentMode === "vendas") {
            const leadStatus = resolved.leadStatus ?? "em_conversa";
            const reply = await deps.agent.generateReply({
              message: inbound.body,
              leadStatus,
              context: resolved.context,
              salesConfig,
              faqs,
            });

            if (
              reply.handoffRequired &&
              deps.repository.markConversationHandoff
            ) {
              await deps.repository.markConversationHandoff({
                conversationId: resolved.conversationId,
                reason: reply.handoffReason ?? "handoff_vendas",
              });
            }

            // CV3: resumo de handoff para o humano assumir com contexto. Só com
            // a camada de geração ativa (off = comportamento anterior) e número
            // comercial configurado. Best-effort — não bloqueia o handoff.
            if (
              reply.handoffRequired &&
              salesConfig?.geracaoLlmModo &&
              salesConfig.geracaoLlmModo !== "off" &&
              salesConfig.whatsappHandoffComercial
            ) {
              let handoffHistory: RecentMessage[] = [];
              if (deps.repository.listRecentMessages) {
                try {
                  handoffHistory = await deps.repository.listRecentMessages({
                    conversationId: resolved.conversationId,
                    limit: 12,
                  });
                } catch {
                  handoffHistory = [];
                }
              }
              await sendHandoffSummary({
                summarizer: handoffSummarizer,
                whatsapp: deps.whatsapp,
                repository: deps.repository,
                handoffComercial: salesConfig.whatsappHandoffComercial,
                history: handoffHistory,
                handoffReason: reply.handoffReason ?? "handoff_vendas",
                leadName: inbound.contactName,
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
              });
            }

            if (
              reply.updatedContext &&
              !reply.convertToOficina &&
              deps.repository.updateConversationModeAndContext
            ) {
              await deps.repository.updateConversationModeAndContext({
                conversationId: resolved.conversationId,
                context: { ...resolved.context, ...reply.updatedContext },
              });
            }

            if (
              reply.convertToOficina &&
              resolved.leadId &&
              deps.repository.convertLeadToOficina
            ) {
              const converted = await deps.repository.convertLeadToOficina({
                leadId: resolved.leadId,
                conversationId: resolved.conversationId,
                whatsapp: inbound.normalizedFrom,
                responsavel: inbound.contactName,
                nomeOficina: reply.nomeOficina ?? null,
              });

              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: "convert_lead_to_oficina",
                input: {
                  whatsapp: inbound.normalizedFrom,
                  responsavel: inbound.contactName,
                },
                output: converted,
              });

              replyBody = onboardingIntroMessage(converted.nome);
            } else {
              if (reply.status !== leadStatus && resolved.leadId) {
                await deps.repository.updateLeadStatus({
                  leadId: resolved.leadId,
                  status: reply.status,
                });
                await deps.repository.saveAgentToolCall({
                  conversationId: resolved.conversationId,
                  leadId: resolved.leadId,
                  oficinaId: resolved.oficinaId,
                  clienteId: resolved.clienteId,
                  toolName: "update_lead",
                  input: { status: leadStatus },
                  output: { status: reply.status },
                });
              }

              replyBody = reply.body;
              // ADR-0024: o caso geral do fora_escopo pede respond (a IA
              // responde grounded; a enlatada vira fallback).
              generationMode = reply.conversationalGenerationMode ?? "rewrite";

              // CV3: fallback nível 2 -> botões interativos. Determinístico:
              // desliga a geração (o clique já resolve o intent) e sinaliza o
              // envio de botões abaixo. `replyBody` (texto do menu) fica como
              // degradação quando o transporte não suporta botões.
              if (reply.interactiveButtons) {
                interactiveButtons = reply.interactiveButtons;
                allowGeneration = false;
              }
            }

            for (const toolCall of reply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }
          } else if (
            isOperationalMode(effectiveAgentMode) &&
            resolved.oficinaId &&
            resolved.oficinaNome === OFICINA_SEM_NOME &&
            deps.repository.updateOficinaNome
          ) {
            // Backfill: oficina convertida sem nome ("Oficina sem nome").
            // Pergunta o nome real e grava no banco antes de retomar o fluxo.
            // Transacional: não reescrever pela IA.
            allowGeneration = false;
            if (!resolved.context.awaiting_workshop_name) {
              if (deps.repository.updateConversationModeAndContext) {
                await deps.repository.updateConversationModeAndContext({
                  conversationId: resolved.conversationId,
                  context: { ...resolved.context, awaiting_workshop_name: true },
                });
              }
              replyBody =
                "Antes de continuar, qual o nome da sua oficina? E pra deixar seu cadastro certinho.";
            } else {
              const nome = extractWorkshopName(inbound.body);
              if (!nome) {
                replyBody = "So pra eu cadastrar certinho: qual o nome da sua oficina?";
              } else {
                await deps.repository.updateOficinaNome({
                  oficinaId: resolved.oficinaId,
                  nome,
                });
                await deps.repository.saveAgentToolCall({
                  conversationId: resolved.conversationId,
                  leadId: resolved.leadId,
                  oficinaId: resolved.oficinaId,
                  clienteId: resolved.clienteId,
                  toolName: "update_oficina_nome",
                  input: { message: inbound.body },
                  output: { nome },
                });
                if (deps.repository.updateConversationModeAndContext) {
                  await deps.repository.updateConversationModeAndContext({
                    conversationId: resolved.conversationId,
                    context: { ...resolved.context, awaiting_workshop_name: false },
                  });
                }
                replyBody = `Show, anotei: ${nome}. Agora me manda a troca assim: nome do cliente, carro, servico, data e WhatsApp do cliente.`;
              }
            }
          } else if (isOperationalMode(effectiveAgentMode)) {
            const onboardingReply = await onboardingAgent.generateReply({
              message: inbound.body,
              mode: effectiveAgentMode,
              context: resolved.context,
              today: localDateSaoPaulo(),
              hourSaoPaulo: localHourSaoPaulo(),
              handoffComercial: salesConfig?.whatsappHandoffComercial ?? null,
            });

            for (const toolCall of onboardingReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            let confirmationSent = false;
            if (onboardingReply.registerServiceInput) {
              if (!resolved.oficinaId || !deps.repository.registerServiceWithReminder) {
                throw new Error("Missing workshop context for service registration");
              }

              const serviceInput = onboardingReply.registerServiceInput;
              const registered = await deps.repository.registerServiceWithReminder({
                oficinaId: resolved.oficinaId,
                ...serviceInput,
              });

              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: "register_service_with_reminder",
                input: {
                  oficinaId: resolved.oficinaId,
                  ...serviceInput,
                },
                output: registered,
              });

              // Confirmação ao cliente final (ADR-0005). Número frio → sempre via
              // template aprovado e somente com consentimento (regras §7.1). Falha
              // aqui nunca derruba a resposta para a oficina.
              confirmationSent = await sendServiceConfirmation({
                deps,
                oficinaId: resolved.oficinaId,
                oficinaNome: resolved.oficinaNome,
                clienteId: registered.clienteId,
                serviceInput,
              });
            }

            if (deps.repository.updateConversationModeAndContext) {
              await deps.repository.updateConversationModeAndContext({
                conversationId: resolved.conversationId,
                agentMode: onboardingReply.nextAgentMode ?? resolved.agentMode,
                context: onboardingReply.context,
              });
            }

            if (onboardingReply.registerServiceInput) {
              const nomeCliente = onboardingReply.registerServiceInput.nomeCliente;
              const dias = resolved.diasLembretePadrao ?? 90;
              replyBody = `Cliente cadastrado. Vou lembrar o ${nomeCliente} em ${dias} dias pra voltar com você.`;
              if (confirmationSent) {
                replyBody += ` Já avisei o ${nomeCliente} que o serviço foi registrado.`;
              }
            } else {
              replyBody = onboardingReply.body;
            }
            // Só conversa livre (saudação, small-talk, "como funciona") pode ser
            // reescrita; cadastro/confirmação/campo faltante ficam determinísticos.
            allowGeneration = onboardingReply.allowConversationalGeneration === true;
            generationMode = onboardingReply.conversationalGenerationMode ?? "rewrite";
          } else if (
            effectiveAgentMode === "cliente_final_lembrete" &&
            !resolved.context.lastReminderId
          ) {
            // CONCIERGE (ADR-0018): cliente final respondeu à confirmação antes
            // de existir qualquer lembrete. Resposta curta + handoff wa.me pra
            // oficina — nunca o agente de vendas nem o de lembrete.
            const oficina =
              resolved.oficinaId && deps.repository.getOficinaById
                ? await deps.repository.getOficinaById({ oficinaId: resolved.oficinaId })
                : null;
            const conciergeReply = conciergeAgent.generateReply({
              message: inbound.body,
              workshopName: oficina?.nome ?? resolved.oficinaNome ?? "a oficina",
              workshopWhatsapp: oficina?.whatsappPrincipal ?? null,
            });

            if (
              conciergeReply.clienteStatus &&
              resolved.clienteId &&
              deps.repository.updateClienteFinalStatus
            ) {
              await deps.repository.updateClienteFinalStatus({
                clienteId: resolved.clienteId,
                status: conciergeReply.clienteStatus,
                optOutAt:
                  conciergeReply.clienteStatus === "opt_out"
                    ? new Date().toISOString()
                    : undefined,
              });
            }

            if (
              conciergeReply.shouldCancelFutureReminders &&
              resolved.clienteId &&
              deps.repository.cancelFutureRemindersForCliente
            ) {
              await deps.repository.cancelFutureRemindersForCliente({
                clienteId: resolved.clienteId,
              });
            }

            if (conciergeReply.handoffRequired && deps.repository.markConversationHandoff) {
              await deps.repository.markConversationHandoff({
                conversationId: resolved.conversationId,
                reason: conciergeReply.handoffReason ?? "mensagem_ambigua",
              });
            }

            for (const toolCall of conciergeReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: null,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            replyBody = conciergeReply.replyBody;
          } else if (effectiveAgentMode === "cliente_final_lembrete") {
            const reminderReply = await reminderAgent.generateReply({
              message: inbound.body,
              conversationContext: resolved.context,
            });

            if (
              reminderReply.clienteStatus &&
              resolved.clienteId &&
              deps.repository.updateClienteFinalStatus
            ) {
              await deps.repository.updateClienteFinalStatus({
                clienteId: resolved.clienteId,
                status: reminderReply.clienteStatus,
                optOutAt:
                  reminderReply.clienteStatus === "opt_out"
                    ? new Date().toISOString()
                    : undefined,
              });
            }

            if (
              reminderReply.shouldCancelFutureReminders &&
              resolved.clienteId &&
              deps.repository.cancelFutureRemindersForCliente
            ) {
              await deps.repository.cancelFutureRemindersForCliente({
                clienteId: resolved.clienteId,
              });
            }

            if (
              reminderReply.lembreteStatus &&
              resolved.context.lastReminderId &&
              deps.repository.updateReminderStatus
            ) {
              await deps.repository.updateReminderStatus({
                reminderId: resolved.context.lastReminderId,
                status: reminderReply.lembreteStatus,
                whatsappMessageId: null,
                providerStatus: null,
                providerErrorCode: null,
                lastError: null,
              });
            }

            if (reminderReply.handoffRequired && deps.repository.markConversationHandoff) {
              await deps.repository.markConversationHandoff({
                conversationId: resolved.conversationId,
                reason: reminderReply.handoffReason ?? "mensagem_ambigua",
              });
            }

            for (const toolCall of reminderReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: null,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            replyBody = reminderReply.replyBody;
          } else if (effectiveAgentMode === "suporte") {
            const supportReply = await supportAgent.generateReply({
              message: inbound.body,
              context: resolved.context,
              oficinaNome: resolved.oficinaNome,
            });

            const inheritedHandoffReason =
              resolved.context.supportHandoffReason ??
              (resolved.context.ambiguousReminderLookup
                ? "cliente_final_ambiguo"
                : null);

            if (
              supportReply.handoffRequired &&
              deps.repository.markConversationHandoff
            ) {
              await deps.repository.markConversationHandoff({
                conversationId: resolved.conversationId,
                reason:
                  inheritedHandoffReason ??
                  supportReply.handoffReason ??
                  "mensagem_ambigua",
              });
            }

            for (const toolCall of supportReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            // Cliente final que caiu em suporte por lookup ambiguo mantem a
            // copy especifica desse caso ("avisar a oficina"). Suporte direto
            // de oficina-cliente recebe a resposta padrao do agente.
            replyBody = resolved.context.ambiguousReminderLookup
              ? "Recebi sua mensagem. Vou avisar a oficina para continuar com voce."
              : supportReply.replyBody;
          } else if (effectiveAgentMode === "cobranca" && cobrancaSubmode) {
            const pendingPayment =
              resolved.oficinaId && deps.repository.getLatestPendingPagamento
                ? await deps.repository.getLatestPendingPagamento({
                    oficinaId: resolved.oficinaId,
                  })
                : null;

            const cobrancaReply = await cobrancaAgent.generateReply({
              message: inbound.body,
              submode: cobrancaSubmode,
              oficinaNome: resolved.oficinaNome,
              proximoVencimento: null,
              pendingPayment,
              context: resolved.context,
            });

            if (
              cobrancaReply.handoffRequired &&
              deps.repository.markConversationHandoff
            ) {
              await deps.repository.markConversationHandoff({
                conversationId: resolved.conversationId,
                reason: cobrancaReply.handoffReason ?? "cobranca_handoff",
              });
            }

            for (const toolCall of cobrancaReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                clienteId: resolved.clienteId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            replyBody = cobrancaReply.replyBody;
          } else {
            replyBody = "Recebi sua mensagem. Um humano segue com os próximos passos por aqui.";
          }

          // Camada de geracao conversacional (ADR-0020). Nesse ponto replyBody
          // ja e a resposta deterministica ("enlatada") de qualquer modo. O
          // gerador so naturaliza o tom; nunca muda estado. Modo off => no-op.
          const geracaoModo = allowGeneration
            ? salesConfig?.geracaoLlmModo ?? "off"
            : "off";
          let recentHistory: RecentMessage[] = [];
          if (geracaoModo !== "off" && deps.repository.listRecentMessages) {
            try {
              recentHistory = await deps.repository.listRecentMessages({
                conversationId: resolved.conversationId,
                limit: 10,
              });
            } catch {
              recentHistory = [];
            }
          }

          const allowedLinks = [
            whatsappLink({ message: "" }),
            siteConfig.siteUrl,
          ];
          if (salesConfig?.whatsappHandoffComercial) {
            allowedLinks.push(
              whatsappLink({ phone: salesConfig.whatsappHandoffComercial }),
            );
          }
          const allowedNames = [resolved.oficinaNome].filter(
            (name): name is string => Boolean(name),
          );

          const handoffComercialLink = salesConfig?.whatsappHandoffComercial
            ? whatsappLink({ phone: salesConfig.whatsappHandoffComercial })
            : null;
          const generation = await maybeGenerateConversationalReply({
            deterministicReply: replyBody,
            mode: geracaoModo,
            // Rotulo do audit: respond em vendas vem do fora_escopo (ADR-0024);
            // na operacao, da categoria `pergunta` (ADR-0022).
            intent:
              generationMode === "respond"
                ? effectiveAgentMode === "vendas"
                  ? "fora_escopo"
                  : "pergunta"
                : null,
            agentMode: effectiveAgentMode,
            generator: replyGenerator,
            history: recentHistory,
            salesConfig: salesConfig ?? null,
            allowedLinks,
            allowedNames,
            generationMode,
            userMessage: inbound.body,
            knowledge:
              generationMode === "respond"
                ? effectiveAgentMode === "vendas"
                  ? buildSalesKnowledge({
                      faqs,
                      handoffLink: handoffComercialLink,
                    })
                  : buildOperationKnowledge({
                      faqs,
                      handoffLink: handoffComercialLink,
                      workshopName: resolved.oficinaNome,
                    })
                : undefined,
          });

          if (generation.audit) {
            await deps.repository.saveAgentToolCall({
              conversationId: resolved.conversationId,
              leadId: resolved.leadId,
              oficinaId: resolved.oficinaId,
              clienteId: resolved.clienteId,
              toolName: generation.audit.toolName,
              input: generation.audit.input,
              output: generation.audit.output,
            });
          }

          // Volante de aprendizado (ADR-0023): respond + dontKnow vira registro
          // que o admin converte em FAQ (sem deploy). Best-effort: falha de
          // gravacao nunca derruba a resposta ao usuario.
          if (
            generation.unansweredQuestion &&
            geracaoModo !== "off" &&
            deps.repository.savePerguntaSemResposta
          ) {
            try {
              await deps.repository.savePerguntaSemResposta({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                oficinaId: resolved.oficinaId,
                agentMode: effectiveAgentMode,
                pergunta: inbound.body.slice(0, 500),
                respostaEnviada: generation.finalBody,
                motivo: "dont_know",
                geracaoModo,
                promptVersion: REPLY_GENERATOR_PROMPT_VERSION,
              });
            } catch {
              // best-effort
            }
          }

          replyBody = generation.finalBody;

          // CV3: envio como botões interativos quando o agente pediu (fallback
          // nível 2) e o transporte suporta; senão degrada para texto. O corpo
          // registrado (`sentBody`) é o que o lead de fato vê.
          const sendAsButtons =
            interactiveButtons !== null &&
            typeof deps.whatsapp.sendInteractiveButtons === "function";
          const sentBody = sendAsButtons ? interactiveButtons!.bodyText : replyBody;

          const outbox = await deps.repository.createOutboundMessage({
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            to: inbound.normalizedFrom,
            body: sentBody,
          });

          try {
            const sent =
              sendAsButtons && deps.whatsapp.sendInteractiveButtons
                ? await deps.whatsapp.sendInteractiveButtons({
                    to: inbound.normalizedFrom,
                    body: interactiveButtons!.bodyText,
                    buttons: interactiveButtons!.buttons,
                  })
                : await deps.whatsapp.sendTextMessage({
                    to: inbound.normalizedFrom,
                    body: replyBody,
                  });

            await deps.repository.markOutboundSent({
              outboundMessageId: outbox.id,
              whatsappMessageId: sent.whatsappMessageId,
              response: sent.response ?? null,
            });
            await deps.repository.saveOutboundMessage({
              conversationId: resolved.conversationId,
              leadId: resolved.leadId,
              oficinaId: resolved.oficinaId,
              whatsappMessageId: sent.whatsappMessageId,
              body: sentBody,
              rawMessage: sent.response ?? null,
              sentAt: new Date().toISOString(),
            });
          } catch (error) {
            const outboundError = errorDetails(error);
            await deps.repository.markOutboundFailed({
              outboundMessageId: outbox.id,
              errorMessage: outboundError.message,
              providerErrorCode: outboundError.code,
              providerErrorMessage: outboundError.message,
              response: outboundError.response,
            });
          }
        } catch (error) {
          const message = errorMessage(error);
          const errorType = "agent_processing_failed";
          const errorContext = {
            whatsappMessageId: inbound.whatsappMessageId,
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            inboundBody: inbound.body,
            stack: errorStack(error),
          };

          processingErrors.push({
            whatsappMessageId: inbound.whatsappMessageId,
            errorType,
            message,
          });

          if (savedEvent.eventId) {
            await deps.repository.markWhatsappEventFailed({
              eventId: savedEvent.eventId,
              errorType,
              errorMessage: message,
              errorContext,
            });
          }

          await deps.repository.saveAgentToolCall({
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            clienteId: resolved.clienteId,
            toolName: "agent_error",
            input: {
              message: inbound.body,
              leadStatus: resolved.leadStatus,
              agentMode: resolved.agentMode,
            },
            output: {
              errorType,
              errorMessage: message,
              stack: errorContext.stack,
            },
          });
        }
      }

      if (savedEvent.eventId && processingErrors.length === 0) {
        await deps.repository.markWhatsappEventProcessed({
          eventId: savedEvent.eventId,
        });
      }

      if (processingErrors.length > 0) {
        return jsonResponse({ ok: true, errors: processingErrors });
      }

      return jsonResponse({ ok: true });
    },
  };
}
