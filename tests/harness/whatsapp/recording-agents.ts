// Decorators que embrulham os agentes reais preservando a interface e gravando
// o reply CRU de cada turno.
//
// Por que isso é necessário: campos como `registerServiceInput`,
// `handoffRequired`, `clienteStatus` e `updatedContext` nunca aparecem no texto
// enviado ao usuário — só existem no objeto de retorno do agente. Sem o
// decorator, o eval não teria como validá-los.
//
// Por que TODOS os agentes são passados explicitamente: se um agente opcional
// for omitido nas deps, `createWhatsappWebhookHandlers` instancia o real
// (webhook-handler.ts:891-895) e a invocação escapa da gravação.

import { WhatsappClienteFinalConciergeAgent } from "@/lib/whatsapp/cliente-final-concierge";
import { WhatsappCobrancaAgent } from "@/lib/whatsapp/cobranca-agent";
import { WhatsappOnboardingAgent } from "@/lib/whatsapp/onboarding-agent";
import { WhatsappReminderAgent } from "@/lib/whatsapp/reminder-agent";
import { WhatsappSalesAgent } from "@/lib/whatsapp/sales-agent";
import { WhatsappSupportAgent } from "@/lib/whatsapp/support-agent";
import type {
  ClienteFinalConciergeAgent,
  CobrancaAgent,
  OnboardingAgent,
  ReminderAgent,
  SalesAgent,
  SupportAgent,
} from "@/lib/whatsapp/types";

import type { AgentInvocation, AgentKind } from "./types";

export type RecordedAgents = {
  agent: SalesAgent;
  onboardingAgent: OnboardingAgent;
  reminderAgent: ReminderAgent;
  conciergeAgent: ClienteFinalConciergeAgent;
  supportAgent: SupportAgent;
  cobrancaAgent: CobrancaAgent;
  /** Invocações desde a última drenagem, na ordem em que ocorreram. */
  drain(): AgentInvocation[];
};

/**
 * Cria o conjunto completo de agentes gravados.
 *
 * @param mode `"off"` constrói todos com `openai: null` (100% determinístico,
 *   roda sem `OPENAI_API_KEY`); `"real"` deixa cada agente resolver a própria
 *   chave a partir do ambiente.
 */
export function createRecordedAgents(mode: "off" | "real" = "off"): RecordedAgents {
  let invocations: AgentInvocation[] = [];
  const openai = mode === "off" ? null : undefined;

  const record = <T>(kind: AgentKind, input: unknown, run: () => T | Promise<T>) => {
    const startedAt = Date.now();
    const push = (reply: unknown, error: unknown) => {
      invocations.push({
        kind,
        input,
        reply,
        durationMs: Date.now() - startedAt,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack ?? null }
            : error
              ? { message: String(error), stack: null }
              : null,
      });
    };

    try {
      const result = run();
      if (result instanceof Promise) {
        return result.then(
          (reply) => {
            push(reply, null);
            return reply;
          },
          (error) => {
            push(null, error);
            throw error;
          },
        ) as T | Promise<T>;
      }
      push(result, null);
      return result;
    } catch (error) {
      push(null, error);
      throw error;
    }
  };

  const sales = new WhatsappSalesAgent({ openai });
  const onboarding = new WhatsappOnboardingAgent({ openai });
  const reminder = new WhatsappReminderAgent({ openai });
  const concierge = new WhatsappClienteFinalConciergeAgent();
  const support = new WhatsappSupportAgent({ openai });
  const cobranca = new WhatsappCobrancaAgent({ openai });

  return {
    agent: {
      generateReply: (input) => record("sales", input, () => sales.generateReply(input)) as ReturnType<
        SalesAgent["generateReply"]
      >,
    },
    onboardingAgent: {
      generateReply: (input) =>
        record("onboarding", input, () => onboarding.generateReply(input)) as ReturnType<
          OnboardingAgent["generateReply"]
        >,
    },
    reminderAgent: {
      generateReply: (input) =>
        record("reminder", input, () => reminder.generateReply(input)) as ReturnType<
          ReminderAgent["generateReply"]
        >,
    },
    // Atenção: o concierge é SÍNCRONO (não devolve Promise).
    conciergeAgent: {
      generateReply: (input) =>
        record("concierge", input, () => concierge.generateReply(input)) as ReturnType<
          ClienteFinalConciergeAgent["generateReply"]
        >,
    },
    supportAgent: {
      generateReply: (input) =>
        record("support", input, () => support.generateReply(input)) as ReturnType<
          SupportAgent["generateReply"]
        >,
    },
    cobrancaAgent: {
      generateReply: (input) =>
        record("cobranca", input, () => cobranca.generateReply(input)) as ReturnType<
          CobrancaAgent["generateReply"]
        >,
    },
    drain() {
      const drained = invocations;
      invocations = [];
      return drained;
    },
  };
}
