// Driver do harness: manda uma mensagem pelo webhook REAL e devolve o turno
// observado.
//
// Vai sempre por `handlers.POST` com request assinado, nunca chamando o agente
// direto. Motivo: o texto que o usuário lê não é `reply.body` — entre o agente
// e o envio passam a camada de geração (que pode reescrever tudo), o validador
// com poder de veto, o split de mensagem longa e o caminho de botões. Além
// disso, `updateLeadStatus`, `convertLeadToOficina` e `registerServiceWithReminder`
// são decididos no handler, não no agente (ADR-0001).

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";
import type { ConversationAgentMode, ServiceDraft } from "@/lib/whatsapp/types";

import { createRecordingSender, deliveredToText } from "./fake-sender";
import { createInMemoryRepository } from "./in-memory-repository";
import { buildInboundPayload, HARNESS_APP_SECRET, HARNESS_VERIFY_TOKEN, signedRequest } from "./payload";
import { createRecordedAgents } from "./recording-agents";
import type {
  HarnessOptions,
  SendOptions,
  TurnObservation,
  WorldDiff,
  WorldSnapshot,
} from "./types";

type HandlerDeps = Parameters<typeof createWhatsappWebhookHandlers>[0];

export type WhatsappHarness = {
  send(message: string, options?: SendOptions): Promise<TurnObservation>;
  /** Envia vários turnos do usuário em sequência (replay de histórico). */
  replay(messages: ReadonlyArray<string>): Promise<TurnObservation[]>;
  turns: TurnObservation[];
  repository: ReturnType<typeof createInMemoryRepository>;
  snapshot(): WorldSnapshot;
};

/** Diff raso por caminho pontilhado, para o trace ficar legível no terminal. */
export function diffSnapshots(before: WorldSnapshot, after: WorldSnapshot): WorldDiff {
  const diff: WorldDiff = {};

  const walk = (a: unknown, b: unknown, path: string) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const bothObjects =
      a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b);
    if (!bothObjects) {
      diff[path] = [a, b];
      return;
    }
    const keys = new Set([
      ...Object.keys(a as Record<string, unknown>),
      ...Object.keys(b as Record<string, unknown>),
    ]);
    for (const key of keys) {
      walk(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
      );
    }
  };

  walk(before, after, "");
  return diff;
}

export function createHarness(options: HarnessOptions = {}): WhatsappHarness {
  const seed = options.seed ?? {};
  const from = seed.from ?? "5511999990001";
  const openaiMode = options.openai ?? "off";

  const repository = createInMemoryRepository({
    seed,
    salesConfig: {
      geracaoLlmModo: options.geracaoLlmModo ?? "off",
      ...(options.precoPartida !== undefined ? { precoPartida: options.precoPartida } : {}),
      ...(options.whatsappHandoffComercial !== undefined
        ? { whatsappHandoffComercial: options.whatsappHandoffComercial }
        : {}),
      ...(options.taxaRecuperacaoRoi !== undefined
        ? { taxaRecuperacaoRoi: options.taxaRecuperacaoRoi }
        : {}),
    },
  });

  const sender = createRecordingSender();
  const agents = createRecordedAgents(openaiMode);

  // Texto da "mídia" do turno atual. O pipeline real de áudio/imagem/PDF roda,
  // mas os stubs devolvem o texto que o chamador já forneceu — é o que permite
  // reproduzir `source_media_type: "audio"` (a mensagem É a transcrição) sem
  // ter um arquivo de áudio de verdade.
  let currentMediaText = "";

  const deps: HandlerDeps = {
    env: {
      WHATSAPP_VERIFY_TOKEN: HARNESS_VERIFY_TOKEN,
      WHATSAPP_APP_SECRET: HARNESS_APP_SECRET,
    },
    repository,
    whatsapp: sender,
    agent: agents.agent,
    onboardingAgent: agents.onboardingAgent,
    reminderAgent: agents.reminderAgent,
    conciergeAgent: agents.conciergeAgent,
    supportAgent: agents.supportAgent,
    cobrancaAgent: agents.cobrancaAgent,
    mediaDownloader: {
      async getMediaMetadata() {
        return { url: "https://harness.local/media", mimeType: "audio/ogg" };
      },
      async downloadMedia() {
        return Buffer.from("harness-media");
      },
    },
    audioTranscriber: {
      async transcribe() {
        return { status: "success", text: currentMediaText, durationMs: 1 };
      },
    },
    imageDescriber: {
      async describe() {
        return { status: "success", text: currentMediaText, durationMs: 1 };
      },
    },
    documentExtractor: {
      async extract() {
        return { status: "success", text: currentMediaText, durationMs: 1, pageCount: 1 };
      },
    },
    // Sem gerador explícito o handler instancia o real quando há OPENAI_API_KEY
    // no ambiente (webhook-handler.ts:898-901). Em modo determinístico isso
    // tornaria o harness dependente do .env do dev — por isso um stub explícito.
    ...(openaiMode === "off"
      ? {
          replyGenerator: { async generate() { return { reply: null, reason: "error" as const }; } },
          handoffSummarizer: { async summarizeHandoff() { return null; } },
          faqEmbedder: { async embed() { return null; } },
        }
      : {}),
  };

  const handlers = createWhatsappWebhookHandlers(deps);
  const turns: TurnObservation[] = [];
  let messageSequence = 0;

  async function send(message: string, sendOptions: SendOptions = {}): Promise<TurnObservation> {
    const mediaType = sendOptions.mediaType ?? "text";
    currentMediaText = message;

    const stateBefore = repository.snapshot();
    // Drena resíduo de turnos anteriores para o turno atual ficar isolado.
    repository.drainToolCalls();
    sender.drain();
    agents.drain();

    const payload = buildInboundPayload({
      from,
      body: message,
      messageId: `wamid.harness-in-${++messageSequence}`,
      contactName: seed.contactName ?? null,
      mediaType,
      contextWhatsappMessageId: sendOptions.contextWhatsappMessageId ?? null,
      buttonReplyId: sendOptions.buttonReplyId,
    });

    const response = await handlers.POST(signedRequest(payload));
    const responseBody = await response.clone().json().catch(() => null);

    const delivered = sender.drain();
    const stateAfter = repository.snapshot();
    const conversation = Object.values(stateAfter.conversations)[0] ?? null;

    const observation: TurnObservation = {
      turn: turns.length + 1,
      userMessage: message,
      mediaType,
      httpStatus: response.status,
      responseBody,
      agentMode: (conversation?.agentMode ?? null) as ConversationAgentMode | null,
      agentInvocations: agents.drain(),
      delivered,
      deliveredText: deliveredToText(delivered),
      toolCalls: repository.drainToolCalls(),
      serviceDraft: (conversation?.context.service_draft ?? null) as ServiceDraft | null,
      stateBefore,
      stateAfter,
      stateDiff: diffSnapshots(stateBefore, stateAfter),
    };

    turns.push(observation);
    return observation;
  }

  return {
    send,
    async replay(messages) {
      const observed: TurnObservation[] = [];
      for (const message of messages) {
        observed.push(await send(message));
      }
      return observed;
    },
    turns,
    repository,
    snapshot: () => repository.snapshot(),
  };
}
