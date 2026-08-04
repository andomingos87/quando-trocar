// Fonte única do formato de um caso do eval set.
//
// Antes disso o schema era implícito e o README não batia com os JSONs (havia
// campo em uso sem documentação e campo documentado sem uso). Tipar aqui faz
// erro de digitação em fixture virar erro de compilação, não falso verde.

import type {
  ConversationAgentMode,
  ConversationContext,
  InboundMediaType,
  LeadStatus,
  ServiceDraft,
} from "@/lib/whatsapp/types";

/**
 * - `active` — julgado normalmente; regressão em `critical: true` bloqueia.
 * - `quarantine` — comportamento ainda NÃO implementado. É julgado e reportado,
 *   mas não afeta o exit code.
 * - `pending_decision` — o caso e o código discordam e a decisão é do dono
 *   (ex.: política de preço). Exige o bloqueio citado em `notes`.
 *
 * Em ambos os casos não-`active`, PASSAR é erro (`STALE_QUARANTINE`): força o
 * caso a voltar para `active` no commit que consertar o comportamento. Sem
 * isso, quarentena vira "deletado com passos extras".
 */
export type EvalCaseStatus = "active" | "quarantine" | "pending_decision";

/** Turno prévio do replay. String = fala do usuário (retrocompatível). */
export type PreviousMessage = string | { role: "user" | "bot"; text: string };

export type ExpectedToolCall = {
  tool_name: string;
  /** Substring que precisa aparecer no JSON serializado do `input` da tool call. */
  input_contains?: string;
};

/**
 * Sinais que NÃO são tool calls. `handoff_wame` e `mark_opt_out` nunca
 * existiram como tool: o handoff é `AgentReply.handoffRequired` e o opt-out é
 * `clienteStatus` aplicado pelo webhook. Modelar como tool call era erro de
 * contrato, não erro de nome.
 */
export type ExpectedSignals = {
  handoff_required?: boolean;
  cliente_status?: "ativo" | "opt_out" | "numero_errado";
  should_cancel_future_reminders?: boolean;
  register_service_called?: boolean;
};

export type EvalExpected = {
  intent?: string;
  status_after?: LeadStatus;
  lembrete_status_after?: string;
  reply_must_contain?: string[];
  reply_must_not_contain?: string[];
  /** Substrings obrigatórias no texto entregue (inclui link wa.me montado). */
  delivered_contains?: string[];
  tool_calls?: ExpectedToolCall[];
  signals?: ExpectedSignals;
  convert_to_oficina?: boolean;
  /** Match PARCIAL do rascunho em `conversas.context.service_draft`. */
  service_draft?: Partial<ServiceDraft>;
  /** Match parcial; snake_case aqui, camelCase no código (o runner converte). */
  register_service_input?: Record<string, unknown> | null;
};

export type EvalContext = {
  lead_status?: LeadStatus;
  /** Replay: cada turno do usuário é enviado de verdade antes do caso. */
  previous_messages?: PreviousMessage[];
  /**
   * Estado da conversa que o replay não alcança. Use só quando necessário e
   * justifique em `notes` — replay é sempre o caminho preferido.
   */
  seed?: Partial<ConversationContext>;
  /** Linhas de banco (lembrete, veículo, oficina) — NÃO é `ConversationContext`. */
  world?: {
    lembrete_id?: string;
    veiculo?: string;
    whatsapp_atendente?: string | null;
    whatsapp_principal?: string;
    oficina_nome?: string;
  };
};

export type EvalCase = {
  id: string;
  critical: boolean;
  status: EvalCaseStatus;
  agent_mode: ConversationAgentMode;
  context: EvalContext;
  input: string;
  source_media_type?: InboundMediaType;
  today?: string;
  /**
   * O caso só é julgável com LLM real (ex.: extração de cadastro por LLM,
   * ADR-0027 — no modo determinístico o agente cai no parser posicional e o
   * resultado esperado é legitimamente diferente). Em `--openai off` o runner
   * PULA em vez de falhar: reprovar aqui mediria o modo errado.
   */
  requires_llm?: boolean;
  expected: EvalExpected;
  notes?: string;
};

const AGENT_MODES = new Set<string>([
  "vendas",
  "onboarding",
  "operacao",
  "cliente_final_lembrete",
  "suporte",
  "cobranca",
]);

const STATUSES = new Set<string>(["active", "quarantine", "pending_decision"]);

/** Valida um fixture cru. Erro aqui falha cedo, com o `id`, antes de gastar LLM. */
export function parseEvalCase(raw: unknown, origem: string): EvalCase {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${origem}: caso não é um objeto`);
  }
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : null;
  if (!id) throw new Error(`${origem}: caso sem 'id'`);

  const falha = (mensagem: string) => {
    throw new Error(`${origem} [${id}]: ${mensagem}`);
  };

  if (typeof c.critical !== "boolean") falha("'critical' é obrigatório (boolean)");
  if (typeof c.status !== "string" || !STATUSES.has(c.status)) {
    falha(`'status' inválido: ${String(c.status)} (use ${[...STATUSES].join(" | ")})`);
  }
  if (typeof c.agent_mode !== "string" || !AGENT_MODES.has(c.agent_mode)) {
    falha(`'agent_mode' inválido: ${String(c.agent_mode)}`);
  }
  if (typeof c.input !== "string" || !c.input) falha("'input' é obrigatório");
  if (!c.expected || typeof c.expected !== "object") falha("'expected' é obrigatório");
  if (c.status !== "active" && !c.notes) {
    falha("caso fora de 'active' precisa de 'notes' explicando o bloqueio");
  }

  return {
    id,
    critical: c.critical as boolean,
    status: c.status as EvalCaseStatus,
    agent_mode: c.agent_mode as ConversationAgentMode,
    context: (c.context ?? {}) as EvalContext,
    input: c.input as string,
    source_media_type: c.source_media_type as InboundMediaType | undefined,
    today: c.today as string | undefined,
    requires_llm: c.requires_llm === true,
    expected: c.expected as EvalExpected,
    notes: c.notes as string | undefined,
  };
}

/** Turnos do usuário a reproduzir (fala do bot é documental e não é enviada). */
export function userTurnsToReplay(messages: PreviousMessage[] | undefined): string[] {
  if (!messages) return [];
  return messages
    .map((m) => (typeof m === "string" ? m : m.role === "user" ? m.text : null))
    .filter((m): m is string => Boolean(m));
}

/** Fixture é snake_case; `RegisterServiceInput` é camelCase. Conversão num lugar só. */
export const REGISTER_SERVICE_FIELD_MAP: Record<string, string> = {
  nome_cliente: "nomeCliente",
  whatsapp_cliente: "whatsappCliente",
  veiculo: "veiculo",
  servico: "servico",
  data_servico: "dataServico",
  valor: "valor",
  consentimento_whatsapp: "consentimentoWhatsapp",
  tipo_servico: "tipoServico",
  marca_peca: "marcaPeca",
};
