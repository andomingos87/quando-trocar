import type { AgentMode } from "@/lib/admin/tool-calls";

/**
 * Catálogo didático das tool calls do agente. Mapeia o nome técnico gravado em
 * `agent_tool_calls.tool_name` para um rótulo legível e uma explicação curta
 * (usada em tooltip). Mantém o painel auto-explicativo para quem não conhece o
 * código dos agentes. Ao adicionar uma tool nova no fluxo WhatsApp, registre-a
 * aqui também.
 */

export type ToolKind = "acao" | "leitura" | "ignorado" | "seguranca" | "erro";

export type ToolDescriptor = {
  /** Rótulo legível em PT-BR. */
  label: string;
  /** Explicação curta exibida no tooltip. */
  description: string;
  /** Categoria — controla a cor do chip. */
  kind: ToolKind;
};

export const TOOL_CATALOG: Record<string, ToolDescriptor> = {
  convert_lead_to_oficina: {
    label: "Converter lead em oficina",
    description:
      "O agente de vendas qualificou o lead e o transformou em uma oficina cliente.",
    kind: "acao",
  },
  update_lead: {
    label: "Atualizar lead",
    description:
      "O agente atualizou o status ou os dados do lead durante a conversa de vendas.",
    kind: "acao",
  },
  register_service_with_reminder: {
    label: "Registrar troca + lembrete",
    description:
      "O agente registrou a troca de óleo de um cliente final e agendou o lembrete de retorno.",
    kind: "acao",
  },
  calculate_roi: {
    label: "Calcular ROI",
    description:
      "O agente calculou o retorno estimado para apresentar à oficina na conversa de vendas.",
    kind: "leitura",
  },
  faq_lookup: {
    label: "Consultar FAQ",
    description:
      "O agente buscou uma resposta na base de perguntas frequentes antes de responder.",
    kind: "leitura",
  },
  ignored_operational_message: {
    label: "Mensagem ignorada",
    description:
      "Mensagem operacional sem ação necessária — o agente decidiu não responder.",
    kind: "ignorado",
  },
  blocked_prompt_injection: {
    label: "Injeção bloqueada",
    description:
      "O agente detectou e bloqueou uma tentativa de manipular o prompt (prompt injection).",
    kind: "seguranca",
  },
  agent_error: {
    label: "Erro do agente",
    description:
      "A IA falhou ao processar a mensagem. O payload mostra a exceção capturada.",
    kind: "erro",
  },
};

/** Rótulo legível a partir do nome técnico (ex.: faq_lookup → Consultar FAQ). */
export function toolLabel(toolName: string): string {
  return TOOL_CATALOG[toolName]?.label ?? humanizeSnake(toolName);
}

/** Descrição de tooltip; vazio quando a tool não está catalogada. */
export function toolDescription(toolName: string): string {
  return TOOL_CATALOG[toolName]?.description ?? "";
}

export function toolKind(toolName: string): ToolKind {
  return TOOL_CATALOG[toolName]?.kind ?? "acao";
}

export const AGENT_MODE_LABEL: Record<AgentMode | "cobranca", string> = {
  vendas: "Vendas",
  onboarding: "Onboarding",
  operacao: "Operação",
  cliente_final_lembrete: "Cliente final",
  suporte: "Suporte",
  cobranca: "Cobrança",
};

export function agentModeLabel(mode: string | null | undefined): string {
  if (!mode) return "—";
  return (AGENT_MODE_LABEL as Record<string, string>)[mode] ?? humanizeSnake(mode);
}

function humanizeSnake(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
