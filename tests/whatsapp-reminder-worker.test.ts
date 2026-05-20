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
      requeueReminderQueueMessage: vi.fn(async () => 99),
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
      lastAttemptAt: expect.any(String),
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
      requeueReminderQueueMessage: vi.fn(async () => 22),
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
    expect(repository.archiveReminderQueueMessage).toHaveBeenCalledWith({
      queueMessageId: 11,
    });
    expect(repository.requeueReminderQueueMessage).toHaveBeenCalledWith({
      outboundMessageId: "outbound-id",
      lembreteId: "lembrete-id",
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
      delaySeconds: 15 * 60,
    });
    expect(repository.updateReminderStatus).toHaveBeenCalledWith({
      reminderId: "lembrete-id",
      status: "erro_envio",
      whatsappMessageId: null,
      providerStatus: "retry_scheduled",
      providerErrorCode: "131000",
      lastError: "try later",
      lastAttemptAt: expect.any(String),
    });
  });

  test("marks permanent provider failures with structured metadata and does not requeue", async () => {
    const repository = {
      dequeueReminderQueueMessages: vi.fn(async () => [
        {
          queueMessageId: 12,
          outboundMessageId: "outbound-id",
          lembreteId: "lembrete-id",
          conversaId: "conversation-id",
          oficinaId: "oficina-id",
          clienteId: "cliente-id",
          toWhatsapp: "+5541999990000",
          customerName: "Joao",
          workshopName: "Auto Center Silva",
          vehicleDescription: "Civic 2018",
          attempts: 3,
        },
      ]),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
      updateReminderStatus: vi.fn(async () => undefined),
      archiveReminderQueueMessage: vi.fn(async () => true),
      requeueReminderQueueMessage: vi.fn(async () => 22),
      markOutboundRetryScheduled: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
      saveAgentToolCall: vi.fn(async () => undefined),
    };
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => {
        const error = new Error("invalid template");
        Object.assign(error, {
          code: "132001",
          retryable: false,
          providerMessage: "Template does not exist",
          response: { error: { code: 132001, message: "Template does not exist" } },
        });
        throw error;
      }),
    };

    const result = await processReminderQueueBatch({
      repository: repository as never,
      whatsapp: whatsapp as never,
      batchSize: 10,
    });

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1, retried: 0 });
    expect(repository.requeueReminderQueueMessage).not.toHaveBeenCalled();
    expect(repository.markOutboundFailed).toHaveBeenCalledWith({
      outboundMessageId: "outbound-id",
      errorMessage: "Template does not exist",
      providerErrorCode: "132001",
      providerErrorMessage: "Template does not exist",
      response: { error: { code: 132001, message: "Template does not exist" } },
      attempts: 4,
    });
    expect(repository.archiveReminderQueueMessage).toHaveBeenCalledWith({
      queueMessageId: 12,
    });
    expect(repository.updateReminderStatus).toHaveBeenCalledWith({
      reminderId: "lembrete-id",
      status: "erro_envio",
      whatsappMessageId: null,
      providerStatus: "failed",
      providerErrorCode: "132001",
      lastError: "Template does not exist",
      lastAttemptAt: expect.any(String),
    });
  });

  test("usa template_name e template_language vindos do dequeue (amortecedor)", async () => {
    const repository = {
      dequeueReminderQueueMessages: vi.fn(async () => [
        {
          queueMessageId: 20,
          outboundMessageId: "outbound-id",
          lembreteId: "lembrete-id",
          conversaId: "conversation-id",
          oficinaId: "oficina-id",
          clienteId: "cliente-id",
          toWhatsapp: "+5511988887777",
          customerName: "Maria",
          workshopName: "Oficina X",
          vehicleDescription: "Onix 2020",
          templateName: "lembrete_amortecedor",
          templateLanguage: "pt_BR",
          tipoServico: "amortecedor" as const,
        },
      ]),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "m" })),
      updateReminderStatus: vi.fn(async () => undefined),
      archiveReminderQueueMessage: vi.fn(async () => true),
      requeueReminderQueueMessage: vi.fn(async () => 0),
      markOutboundRetryScheduled: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
      saveAgentToolCall: vi.fn(async () => undefined),
    };
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({
        whatsappMessageId: "wamid.am-1",
        response: {},
      })),
    };

    await processReminderQueueBatch({
      repository: repository as never,
      whatsapp: whatsapp as never,
      batchSize: 10,
    });

    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith({
      to: "+5511988887777",
      templateName: "lembrete_amortecedor",
      languageCode: "pt_BR",
      bodyParameters: ["Maria", "Oficina X", "Onix 2020"],
    });
    expect(repository.saveOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("amortecedores"),
      }),
    );
  });

  test("usa template_name e template_language vindos do dequeue (revisao)", async () => {
    const repository = {
      dequeueReminderQueueMessages: vi.fn(async () => [
        {
          queueMessageId: 21,
          outboundMessageId: "outbound-id-2",
          lembreteId: "lembrete-id-2",
          conversaId: "conv-2",
          oficinaId: "oficina-id",
          clienteId: "cliente-id",
          toWhatsapp: "+5521999998888",
          customerName: "Carlos",
          workshopName: "Oficina Y",
          vehicleDescription: "Corolla 2019",
          templateName: "lembrete_revisao_geral",
          templateLanguage: "pt_BR",
          tipoServico: "revisao" as const,
        },
      ]),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "m" })),
      updateReminderStatus: vi.fn(async () => undefined),
      archiveReminderQueueMessage: vi.fn(async () => true),
      requeueReminderQueueMessage: vi.fn(async () => 0),
      markOutboundRetryScheduled: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
      saveAgentToolCall: vi.fn(async () => undefined),
    };
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({
        whatsappMessageId: "wamid.rev-1",
        response: {},
      })),
    };

    await processReminderQueueBatch({
      repository: repository as never,
      whatsapp: whatsapp as never,
      batchSize: 10,
    });

    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith({
      to: "+5521999998888",
      templateName: "lembrete_revisao_geral",
      languageCode: "pt_BR",
      bodyParameters: ["Carlos", "Oficina Y", "Corolla 2019"],
    });
    expect(repository.saveOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("revisao"),
      }),
    );
  });
});
