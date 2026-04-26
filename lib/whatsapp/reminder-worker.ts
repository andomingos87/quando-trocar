import { renderReminderTemplate, retryDelaySecondsForAttempt } from "./reminder-agent";
import type { WhatsappRepository, WhatsappSender } from "./types";

function toIsoDelay(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function extractProviderError(error: unknown) {
  const typed = error as {
    code?: string | number;
    retryable?: boolean;
    providerMessage?: string;
    message?: string;
  };

  return {
    code: typed.code ? String(typed.code) : null,
    retryable: Boolean(typed.retryable),
    message: typed.providerMessage ?? typed.message ?? "Unknown reminder delivery error",
  };
}

export async function processReminderQueueBatch(input: {
  repository: WhatsappRepository;
  whatsapp: WhatsappSender;
  batchSize: number;
  visibilityTimeoutSeconds?: number;
}) {
  if (!input.repository.dequeueReminderQueueMessages) {
    throw new Error("Reminder queue repository methods are not available");
  }
  if (!input.repository.archiveReminderQueueMessage) {
    throw new Error("Reminder queue archive method is not available");
  }
  if (!input.repository.updateReminderStatus) {
    throw new Error("Reminder update method is not available");
  }
  if (!input.repository.markOutboundRetryScheduled) {
    throw new Error("Outbound retry method is not available");
  }
  if (!input.whatsapp.sendTemplateMessage) {
    throw new Error("WhatsApp template sending is not available");
  }

  const messages = await input.repository.dequeueReminderQueueMessages({
    batchSize: input.batchSize,
    visibilityTimeoutSeconds: input.visibilityTimeoutSeconds ?? 60,
  });

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const message of messages) {
    const renderedBody = renderReminderTemplate({
      customerName: message.customerName,
      workshopName: message.workshopName,
      vehicleDescription: message.vehicleDescription,
    });

    try {
      const response = await input.whatsapp.sendTemplateMessage({
        to: message.toWhatsapp,
        templateName: "lembrete_troca_oleo",
        languageCode: "pt_BR",
        bodyParameters: [
          message.customerName,
          message.workshopName,
          message.vehicleDescription,
        ],
      });

      await input.repository.markOutboundSent({
        outboundMessageId: message.outboundMessageId,
        whatsappMessageId: response.whatsappMessageId,
        response: response.response ?? null,
      });
      await input.repository.saveOutboundMessage({
        conversationId: message.conversaId,
        leadId: null,
        oficinaId: message.oficinaId,
        whatsappMessageId: response.whatsappMessageId,
        body: renderedBody,
        rawMessage: response.response ?? null,
        sentAt: new Date().toISOString(),
      });
      await input.repository.updateReminderStatus({
        reminderId: message.lembreteId,
        status: "enviado",
        whatsappMessageId: response.whatsappMessageId,
        providerStatus: "sent",
        providerErrorCode: null,
        lastError: null,
      });
      await input.repository.archiveReminderQueueMessage({
        queueMessageId: message.queueMessageId,
      });
      sent += 1;
    } catch (error) {
      const providerError = extractProviderError(error);
      const attempts = (message.attempts ?? 0) + 1;
      const retryDelay = providerError.retryable
        ? retryDelaySecondsForAttempt(attempts)
        : null;

      if (retryDelay !== null) {
        await input.repository.markOutboundRetryScheduled({
          outboundMessageId: message.outboundMessageId,
          attempts,
          nextAttemptAt: toIsoDelay(retryDelay),
          providerErrorCode: providerError.code,
          providerErrorMessage: providerError.message,
          response: null,
        });
        retried += 1;
        continue;
      }

      await input.repository.markOutboundFailed({
        outboundMessageId: message.outboundMessageId,
        errorMessage: providerError.message,
      });
      await input.repository.updateReminderStatus({
        reminderId: message.lembreteId,
        status: "erro_envio",
        whatsappMessageId: null,
        providerStatus: "failed",
        providerErrorCode: providerError.code,
        lastError: providerError.message,
      });
      failed += 1;
    }
  }

  return {
    processed: messages.length,
    sent,
    failed,
    retried,
  };
}
