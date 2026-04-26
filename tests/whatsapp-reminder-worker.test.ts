import { describe, expect, test, vi } from "vitest";

import { processReminderQueueBatch } from "@/lib/whatsapp/reminder-worker";

describe("whatsapp reminder worker", () => {
  test("sends template messages and archives processed queue messages", async () => {
    const repository = {
      dequeueReminderQueueMessages: vi.fn(async () => [
        {
          queueMessageId: 10,
          outboundMessageId: "outbound-id",
          lembreteId: "lembrete-id",
          conversaId: "conversation-id",
          oficinaId: "oficina-id",
          clienteId: "cliente-id",
          toWhatsapp: "+5541999990000",
          customerName: "Joao",
          workshopName: "Auto Center Silva",
          vehicleDescription: "Civic 2018",
        },
      ]),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
      updateReminderStatus: vi.fn(async () => undefined),
      archiveReminderQueueMessage: vi.fn(async () => true),
      markOutboundRetryScheduled: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
      saveAgentToolCall: vi.fn(async () => undefined),
    };
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({
        whatsappMessageId: "wamid.template-1",
        response: { messages: [{ id: "wamid.template-1" }] },
      })),
    };

    const result = await processReminderQueueBatch({
      repository: repository as never,
      whatsapp: whatsapp as never,
      batchSize: 10,
    });

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0, retried: 0 });
    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith({
      to: "+5541999990000",
      templateName: "lembrete_troca_oleo",
      languageCode: "pt_BR",
      bodyParameters: ["Joao", "Auto Center Silva", "Civic 2018"],
    });
    expect(repository.markOutboundSent).toHaveBeenCalledWith({
      outboundMessageId: "outbound-id",
      whatsappMessageId: "wamid.template-1",
      response: expect.any(Object),
    });
    expect(repository.updateReminderStatus).toHaveBeenCalledWith({
      reminderId: "lembrete-id",
      status: "enviado",
      whatsappMessageId: "wamid.template-1",
      providerStatus: "sent",
      providerErrorCode: null,
      lastError: null,
    });
    expect(repository.archiveReminderQueueMessage).toHaveBeenCalledWith({
      queueMessageId: 10,
    });
  });

  test("schedules retry only for temporary provider failures", async () => {
    const repository = {
      dequeueReminderQueueMessages: vi.fn(async () => [
        {
          queueMessageId: 11,
          outboundMessageId: "outbound-id",
          lembreteId: "lembrete-id",
          conversaId: "conversation-id",
          oficinaId: "oficina-id",
          clienteId: "cliente-id",
          toWhatsapp: "+5541999990000",
          customerName: "Joao",
          workshopName: "Auto Center Silva",
          vehicleDescription: "Civic 2018",
          attempts: 0,
        },
      ]),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
      updateReminderStatus: vi.fn(async () => undefined),
      archiveReminderQueueMessage: vi.fn(async () => true),
      markOutboundRetryScheduled: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
      saveAgentToolCall: vi.fn(async () => undefined),
    };
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => {
        const error = new Error("temporary failure");
        Object.assign(error, {
          code: "131000",
          retryable: true,
          providerMessage: "try later",
        });
        throw error;
      }),
    };

    const result = await processReminderQueueBatch({
      repository: repository as never,
      whatsapp: whatsapp as never,
      batchSize: 10,
    });

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0, retried: 1 });
    expect(repository.markOutboundRetryScheduled).toHaveBeenCalledWith({
      outboundMessageId: "outbound-id",
      attempts: 1,
      nextAttemptAt: expect.any(String),
      providerErrorCode: "131000",
      providerErrorMessage: "try later",
      response: null,
    });
  });
});
