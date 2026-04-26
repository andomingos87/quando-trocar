import { detectLeadOrigin } from "./sales-agent";
import {
  extractInboundTextMessages,
  extractProviderEventId,
  extractWhatsappMessageId,
} from "./payload";
import { verifyMetaSignature } from "./signature";
import type { SalesAgent, WhatsappRepository, WhatsappSender } from "./types";

type WebhookEnv = {
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
};

type HandlerDeps = {
  env: WebhookEnv;
  repository: WhatsappRepository;
  whatsapp: WhatsappSender;
  agent: SalesAgent;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown processing error";
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? null : null;
}

export function createWhatsappWebhookHandlers(deps: HandlerDeps) {
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

      const inboundMessages = extractInboundTextMessages(payload);
      const processingErrors: Array<{
        whatsappMessageId: string;
        errorType: string;
        message: string;
      }> = [];

      for (const inbound of inboundMessages) {
        const lead = await deps.repository.upsertLead({
          whatsapp: inbound.normalizedFrom,
          nome: inbound.contactName,
          origem: detectLeadOrigin(inbound.body),
          status: "em_conversa",
        });
        const conversation = await deps.repository.upsertConversation({
          leadId: lead.id,
          whatsapp: inbound.normalizedFrom,
        });
        const savedInbound = await deps.repository.saveInboundMessage({
          conversationId: conversation.id,
          leadId: lead.id,
          whatsappMessageId: inbound.whatsappMessageId,
          body: inbound.body,
          rawMessage: inbound.rawMessage,
          sentAt: inbound.timestamp?.toISOString() ?? null,
        });

        if (savedInbound.duplicate) {
          continue;
        }

        try {
          const reply = await deps.agent.generateReply({
            message: inbound.body,
            leadStatus: lead.status,
          });

          if (reply.status !== lead.status) {
            await deps.repository.updateLeadStatus({
              leadId: lead.id,
              status: reply.status,
            });
            await deps.repository.saveAgentToolCall({
              conversationId: conversation.id,
              leadId: lead.id,
              toolName: "update_lead",
              input: { status: lead.status },
              output: { status: reply.status },
            });
          }

          for (const toolCall of reply.toolCalls) {
            await deps.repository.saveAgentToolCall({
              conversationId: conversation.id,
              leadId: lead.id,
              toolName: toolCall.toolName,
              input: toolCall.input,
              output: toolCall.output,
            });
          }

          const outbox = await deps.repository.createOutboundMessage({
            conversationId: conversation.id,
            leadId: lead.id,
            to: inbound.normalizedFrom,
            body: reply.body,
          });

          try {
            const sent = await deps.whatsapp.sendTextMessage({
              to: inbound.normalizedFrom,
              body: reply.body,
            });

            await deps.repository.markOutboundSent({
              outboundMessageId: outbox.id,
              whatsappMessageId: sent.whatsappMessageId,
              response: sent.response ?? null,
            });
            await deps.repository.saveOutboundMessage({
              conversationId: conversation.id,
              leadId: lead.id,
              whatsappMessageId: sent.whatsappMessageId,
              body: reply.body,
              rawMessage: sent.response ?? null,
              sentAt: new Date().toISOString(),
            });
          } catch (error) {
            await deps.repository.markOutboundFailed({
              outboundMessageId: outbox.id,
              errorMessage: errorMessage(error),
            });
          }
        } catch (error) {
          const message = errorMessage(error);
          const errorType = "agent_processing_failed";
          const errorContext = {
            whatsappMessageId: inbound.whatsappMessageId,
            conversationId: conversation.id,
            leadId: lead.id,
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
            conversationId: conversation.id,
            leadId: lead.id,
            toolName: "agent_error",
            input: {
              message: inbound.body,
              leadStatus: lead.status,
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
