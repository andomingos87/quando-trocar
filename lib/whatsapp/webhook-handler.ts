import { resolveWhatsappConversation } from "./conversation-router";
import { WhatsappOnboardingAgent } from "./onboarding-agent";
import {
  extractInboundTextMessages,
  extractProviderEventId,
  extractWhatsappMessageId,
} from "./payload";
import { verifyMetaSignature } from "./signature";
import type {
  ConversationAgentMode,
  OnboardingAgent,
  SalesAgent,
  WhatsappRepository,
  WhatsappSender,
} from "./types";

type WebhookEnv = {
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
};

type HandlerDeps = {
  env: WebhookEnv;
  repository: WhatsappRepository;
  whatsapp: WhatsappSender;
  agent: SalesAgent;
  onboardingAgent?: OnboardingAgent;
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

function onboardingIntroMessage() {
  return [
    "Pronto, sua oficina esta cadastrada.",
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

function isOperationalMode(
  mode: ConversationAgentMode,
): mode is Extract<ConversationAgentMode, "onboarding" | "operacao"> {
  return mode === "onboarding" || mode === "operacao";
}

export function createWhatsappWebhookHandlers(deps: HandlerDeps) {
  const onboardingAgent = deps.onboardingAgent ?? new WhatsappOnboardingAgent();

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
        const resolved = await resolveWhatsappConversation({
          repository: deps.repository,
          whatsapp: inbound.normalizedFrom,
          contactName: inbound.contactName,
          body: inbound.body,
        });
        const savedInbound = await deps.repository.saveInboundMessage({
          conversationId: resolved.conversationId,
          leadId: resolved.leadId,
          oficinaId: resolved.oficinaId,
          whatsappMessageId: inbound.whatsappMessageId,
          body: inbound.body,
          rawMessage: inbound.rawMessage,
          sentAt: inbound.timestamp?.toISOString() ?? null,
        });

        if (savedInbound.duplicate) {
          continue;
        }

        try {
          let replyBody: string;

          if (resolved.agentMode === "vendas") {
            const leadStatus = resolved.leadStatus ?? "em_conversa";
            const reply = await deps.agent.generateReply({
              message: inbound.body,
              leadStatus,
            });

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
                nomeOficina:
                  typeof resolved.context.service_draft?.nome_cliente === "string"
                    ? resolved.context.service_draft.nome_cliente
                    : null,
              });

              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                toolName: "convert_lead_to_oficina",
                input: {
                  whatsapp: inbound.normalizedFrom,
                  responsavel: inbound.contactName,
                },
                output: converted,
              });

              replyBody = onboardingIntroMessage();
            } else {
              if (reply.status !== leadStatus && resolved.leadId) {
                await deps.repository.updateLeadStatus({
                  leadId: resolved.leadId,
                  status: reply.status,
                });
                await deps.repository.saveAgentToolCall({
                  conversationId: resolved.conversationId,
                  leadId: resolved.leadId,
                  toolName: "update_lead",
                  input: { status: leadStatus },
                  output: { status: reply.status },
                });
              }

              replyBody = reply.body;
            }

            for (const toolCall of reply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }
          } else if (isOperationalMode(resolved.agentMode)) {
            const onboardingReply = await onboardingAgent.generateReply({
              message: inbound.body,
              mode: resolved.agentMode,
              context: resolved.context,
              today: localDateSaoPaulo(),
            });

            for (const toolCall of onboardingReply.toolCalls) {
              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                output: toolCall.output,
              });
            }

            if (onboardingReply.registerServiceInput) {
              if (!resolved.oficinaId || !deps.repository.registerServiceWithReminder) {
                throw new Error("Missing workshop context for service registration");
              }

              const registered = await deps.repository.registerServiceWithReminder({
                oficinaId: resolved.oficinaId,
                ...onboardingReply.registerServiceInput,
              });

              await deps.repository.saveAgentToolCall({
                conversationId: resolved.conversationId,
                leadId: resolved.leadId,
                toolName: "register_service_with_reminder",
                input: {
                  oficinaId: resolved.oficinaId,
                  ...onboardingReply.registerServiceInput,
                },
                output: registered,
              });
            }

            if (deps.repository.updateConversationModeAndContext) {
              await deps.repository.updateConversationModeAndContext({
                conversationId: resolved.conversationId,
                agentMode: onboardingReply.nextAgentMode ?? resolved.agentMode,
                context: onboardingReply.context,
              });
            }

            replyBody = onboardingReply.registerServiceInput
              ? `Cliente cadastrado. Vou lembrar o ${onboardingReply.registerServiceInput.nomeCliente} em ${
                  resolved.diasLembretePadrao ?? 90
                } dias para voltar trocar óleo com você.`
              : onboardingReply.body;
          } else {
            replyBody = "Recebi sua mensagem. Um humano segue com os próximos passos por aqui.";
          }

          const outbox = await deps.repository.createOutboundMessage({
            conversationId: resolved.conversationId,
            leadId: resolved.leadId,
            oficinaId: resolved.oficinaId,
            to: inbound.normalizedFrom,
            body: replyBody,
          });

          try {
            const sent = await deps.whatsapp.sendTextMessage({
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
              body: replyBody,
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
