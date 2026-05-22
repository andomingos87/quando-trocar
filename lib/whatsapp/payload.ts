import { normalizeWhatsappPhone } from "./sales-agent";
import type { InboundWhatsappMessage, WhatsappStatusEvent } from "./types";

type MetaMessage = {
  from?: string;
  context?: { id?: string };
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  audio?: {
    id?: string;
    mime_type?: string;
    voice?: boolean;
    sha256?: string;
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

        // Outros tipos (image, document, sticker, video, location...) seguem
        // descartados silenciosamente — fora do escopo da Fase 5.
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
