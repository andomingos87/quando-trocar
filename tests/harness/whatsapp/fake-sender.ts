// Sender que grava em vez de enviar. Nada bate na Graph API.
//
// Cuidado deliberado: NÃO expor `getMediaMetadata`/`downloadMedia`. O webhook
// deriva o `mediaDownloader` do próprio sender por duck-typing
// (webhook-handler.ts:911); sem esses métodos o pipeline de mídia fica
// desligado e áudio/imagem/PDF nunca tentam baixar nada.

import type { WhatsappSender } from "@/lib/whatsapp/types";

import type { DeliveredMessage } from "./types";

export type RecordingWhatsappSender = WhatsappSender & {
  /** Mensagens entregues desde a última drenagem, na ordem de envio. */
  drain(): DeliveredMessage[];
  /** Falha o próximo envio, para exercitar o caminho de erro do webhook. */
  failNext(errorMessage: string): void;
};

export function createRecordingSender(): RecordingWhatsappSender {
  let delivered: DeliveredMessage[] = [];
  let pendingFailure: string | null = null;
  let sequence = 0;

  const consumeFailure = () => {
    if (!pendingFailure) return;
    const message = pendingFailure;
    pendingFailure = null;
    throw new Error(message);
  };

  const nextMessageId = () => `wamid.harness-out-${++sequence}`;

  return {
    async sendTextMessage(input) {
      consumeFailure();
      delivered.push({ kind: "text", to: input.to, body: input.body });
      return { whatsappMessageId: nextMessageId() };
    },

    async sendTemplateMessage(input) {
      consumeFailure();
      delivered.push({
        kind: "template",
        to: input.to,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyParameters: input.bodyParameters,
        bodyParameterNames: input.bodyParameterNames,
      });
      return { whatsappMessageId: nextMessageId() };
    },

    async sendInteractiveButtons(input) {
      consumeFailure();
      delivered.push({
        kind: "interactive",
        to: input.to,
        body: input.body,
        buttons: input.buttons,
      });
      return { whatsappMessageId: nextMessageId() };
    },

    async markReadAndTyping() {
      // No-op: o harness não simula indicador de digitação.
    },

    drain() {
      const drained = delivered;
      delivered = [];
      return drained;
    },

    failNext(errorMessage: string) {
      pendingFailure = errorMessage;
    },
  };
}

/** Texto concatenado do que foi entregue — é isto que `reply_must_contain` testa. */
export function deliveredToText(delivered: ReadonlyArray<DeliveredMessage>): string {
  return delivered
    .map((message) => {
      if (message.kind === "text") return message.body;
      if (message.kind === "interactive") {
        const labels = message.buttons.map((b) => b.title).join(" | ");
        return `${message.body}\n[botões: ${labels}]`;
      }
      return `[template ${message.templateName}: ${message.bodyParameters.join(" · ")}]`;
    })
    .join("\n");
}
