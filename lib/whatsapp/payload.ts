import { normalizeWhatsappPhone } from "./sales-agent";
import { resolveSalesButtonReplyId } from "./sales-buttons";
import type { InboundWhatsappMessage, WhatsappStatusEvent } from "./types";

type MetaMediaAttachment = {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
};

type MetaMessage = {
  from?: string;
  context?: { id?: string };
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  audio?: MetaMediaAttachment;
  image?: MetaMediaAttachment;
  document?: MetaMediaAttachment;
  sticker?: MetaMediaAttachment;
  video?: MetaMediaAttachment;
  location?: Record<string, unknown>;
  contacts?: unknown[];
  // Resposta de botão de template (quick-reply): o texto do botão é a mensagem.
  button?: { text?: string; payload?: string };
  // Resposta interativa (button_reply / list_reply): o título escolhido é a mensagem.
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
};

type MetaContact = {
  wa_id?: string;
  profile?: { name?: string };
};

type MetaChange = {
  field?: string;
  value?: {
    contacts?: MetaContact[];
    messages?: MetaMessage[];
    statuses?: Array<{
      id?: string;
      status?: string;
      timestamp?: string;
      recipient_id?: string;
      errors?: Array<{ code?: string | number; title?: string; message?: string }>;
    }>;
    // Campos do webhook `phone_number_quality_update` / `account_update` (CV7).
    display_phone_number?: string;
    event?: string;
    current_limit?: string;
    quality_rating?: string;
    quality_score?: { score?: string } | string;
  };
};

type MetaEntry = {
  id?: string;
  changes?: MetaChange[];
};

type MetaPayload = {
  entry?: MetaEntry[];
};

export function extractProviderEventId(payload: unknown) {
  const typed = payload as MetaPayload;
  const entry = typed.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];
  const status = change?.value?.statuses?.[0];

  if (message?.id) {
    return message.id;
  }

  if (status?.id && status.status) {
    return `${status.id}:${status.status}:${status.timestamp ?? "unknown"}`;
  }

  return `${entry?.id ?? "unknown"}:${change?.field ?? "unknown"}`;
}

export function extractWhatsappMessageId(payload: unknown) {
  const typed = payload as MetaPayload;
  const value = typed.entry?.[0]?.changes?.[0]?.value;
  return value?.messages?.[0]?.id ?? value?.statuses?.[0]?.id ?? null;
}

export function extractInboundMessages(payload: unknown): InboundWhatsappMessage[] {
  const typed = payload as MetaPayload;
  const messages: InboundWhatsappMessage[] = [];

  for (const entry of typed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from || !message.id) {
          continue;
        }

        const contact = change.value?.contacts?.find(
          (candidate) => candidate.wa_id === message.from,
        );
        const timestamp = message.timestamp
          ? new Date(Number(message.timestamp) * 1000)
          : null;
        const normalizedTimestamp =
          timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;

        const common = {
          providerEventId: message.id,
          whatsappMessageId: message.id,
          contextWhatsappMessageId: message.context?.id ?? null,
          from: message.from,
          normalizedFrom: normalizeWhatsappPhone(message.from),
          contactName: contact?.profile?.name ?? null,
          timestamp: normalizedTimestamp,
          rawMessage: message as Record<string, unknown>,
        };

        if (message.type === "text" && message.text?.body) {
          messages.push({
            ...common,
            body: message.text.body,
            mediaType: "text",
          });
          continue;
        }

        if (message.type === "audio" && message.audio?.id) {
          messages.push({
            ...common,
            body: "",
            mediaType: "audio",
            mediaId: message.audio.id,
          });
          continue;
        }

        // Imagem e documento têm pipeline próprio (ADR-0016) — emitimos o
        // mediaType e o webhook decide se processa (vision/PDF) ou envia
        // fallback contextual.
        if (message.type === "image" && message.image?.id) {
          messages.push({
            ...common,
            body: "",
            mediaType: "image",
            mediaId: message.image.id,
            mediaMimeType: message.image.mime_type ?? null,
            mediaCaption: message.image.caption ?? null,
          });
          continue;
        }

        if (message.type === "document" && message.document?.id) {
          messages.push({
            ...common,
            body: "",
            mediaType: "document",
            mediaId: message.document.id,
            mediaMimeType: message.document.mime_type ?? null,
            mediaCaption: message.document.caption ?? null,
          });
          continue;
        }

        // Tipos sem processamento — disparam apenas fallback contextual no
        // webhook-handler. Mantemos o `mediaId` quando o payload trouxer
        // (sticker/video sempre traz) por rastreabilidade no `raw_payload`,
        // mas nenhum download é feito.
        if (message.type === "sticker" && message.sticker?.id) {
          messages.push({
            ...common,
            body: "",
            mediaType: "sticker",
            mediaId: message.sticker.id,
          });
          continue;
        }

        if (message.type === "video" && message.video?.id) {
          messages.push({
            ...common,
            body: "",
            mediaType: "video",
            mediaId: message.video.id,
          });
          continue;
        }

        if (message.type === "location") {
          messages.push({
            ...common,
            body: "",
            mediaType: "location",
            mediaId: null,
          });
          continue;
        }

        if (message.type === "contacts") {
          messages.push({
            ...common,
            body: "",
            mediaType: "contacts",
            mediaId: null,
          });
          continue;
        }

        // Toque em botão de quick-reply de template (`type: "button"`). O texto
        // do botão é a intenção do usuário — tratamos como texto pra o agente
        // ler normalmente, em vez de cair em "não consegui ler". O `context.id`
        // (mensagem citada) já vai em `common.contextWhatsappMessageId`.
        if (message.type === "button") {
          const buttonText = message.button?.text?.trim();
          if (buttonText) {
            messages.push({
              ...common,
              body: buttonText,
              mediaType: "text",
            });
            continue;
          }
        }

        // Resposta interativa (button_reply / list_reply). Quando o `id` do
        // button_reply é um botão de vendas conhecido (fase CV3), mapeamos o id
        // DETERMINÍSTICO para a mensagem canônica — o clique vira o intent certo
        // sem depender do texto do título (evita erro de classificação). Para
        // ids desconhecidos ou list_reply, o título escolhido vira o conteúdo.
        if (message.type === "interactive") {
          const canonicalFromButtonId = resolveSalesButtonReplyId(
            message.interactive?.button_reply?.id,
          );
          const interactiveBody =
            canonicalFromButtonId ||
            message.interactive?.button_reply?.title?.trim() ||
            message.interactive?.list_reply?.title?.trim();
          if (interactiveBody) {
            messages.push({
              ...common,
              body: interactiveBody,
              mediaType: "text",
            });
            continue;
          }
        }

        // Tipo desconhecido (ex.: reactions, system, novos tipos do Meta) ou
        // button/interactive malformado (sem texto). Emitimos `unsupported`
        // para que o webhook responda algo em vez de ficar mudo.
        if (message.type) {
          messages.push({
            ...common,
            body: "",
            mediaType: "unsupported",
            mediaId: null,
          });
        }
      }
    }
  }

  return messages;
}

// Retrocompatibilidade: o nome antigo apontava só para texto. Mantemos o
// símbolo exportado para qualquer chamada externa (eg. testes) que ainda
// dependa dele; novos consumidores devem usar `extractInboundMessages`.
export const extractInboundTextMessages = extractInboundMessages;

export function extractStatusEvents(payload: unknown): WhatsappStatusEvent[] {
  const typed = payload as MetaPayload;
  const events: WhatsappStatusEvent[] = [];

  for (const entry of typed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (
          !status.id ||
          (status.status !== "sent" &&
            status.status !== "delivered" &&
            status.status !== "read" &&
            status.status !== "failed")
        ) {
          continue;
        }

        const firstError = status.errors?.[0];

        events.push({
          providerEventId: `${status.id}:${status.status}:${status.timestamp ?? "unknown"}`,
          whatsappMessageId: status.id,
          status: status.status,
          timestamp: status.timestamp ?? null,
          recipientId: status.recipient_id ?? null,
          errorCode: firstError?.code ? String(firstError.code) : null,
          errorMessage: firstError?.message ?? firstError?.title ?? null,
          rawStatus: status as Record<string, unknown>,
        });
      }
    }
  }

  return events;
}

// CV7: eventos de qualidade do número (webhook `phone_number_quality_update` /
// `account_update`). Follow-up proativo aumenta volume e o quality rating é o
// ativo mais caro do produto — o admin precisa ver quando cai.
export type PhoneQualityEvent = {
  displayPhoneNumber: string | null;
  event: string | null;
  currentLimit: string | null;
  qualityRating: string | null;
  raw: Record<string, unknown>;
};

export function extractPhoneQualityEvents(payload: unknown): PhoneQualityEvent[] {
  const typed = payload as MetaPayload;
  const events: PhoneQualityEvent[] = [];

  for (const entry of typed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (
        change.field !== "phone_number_quality_update" &&
        change.field !== "account_update"
      ) {
        continue;
      }
      const value = change.value;
      if (!value) continue;
      const qualityScore =
        typeof value.quality_score === "string"
          ? value.quality_score
          : value.quality_score?.score ?? null;
      // Só registramos quando há de fato sinal de qualidade/evento.
      if (!value.event && !value.quality_rating && !qualityScore) continue;

      events.push({
        displayPhoneNumber: value.display_phone_number ?? null,
        event: value.event ?? null,
        currentLimit: value.current_limit ?? null,
        qualityRating: value.quality_rating ?? qualityScore ?? null,
        raw: value as Record<string, unknown>,
      });
    }
  }

  return events;
}
