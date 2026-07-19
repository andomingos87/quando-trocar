import type {
  ClienteResumo,
  ConversationAgentMode,
  UpcomingReminder,
} from "./types";

// CV6 — formatação determinística das respostas de consulta read-only da
// operação. Os DADOS (nomes, datas, números) são sempre literais, montados
// aqui; a "moldura" conversacional é opcional e fica a cargo da camada de
// geração (só em respostas curtas — a lista de lembretes fica literal para não
// perder itens). Fuso America/Sao_Paulo nas datas.

const TZ = "America/Sao_Paulo";

const TIPO_SERVICO_LABEL: Record<string, string> = {
  troca_oleo: "troca de óleo",
  amortecedor: "amortecedor",
  revisao: "revisão",
  outro: "serviço",
};

function labelTipoServico(tipo: string): string {
  return TIPO_SERVICO_LABEL[tipo] ?? tipo.replace(/_/g, " ");
}

// Data curta dd/mm (ex.: 05/08) no fuso de SP.
export function formatDayMonth(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatUpcomingReminders(
  reminders: UpcomingReminder[],
  days: number,
): string {
  if (reminders.length === 0) {
    return `Não tem lembrete pra sair nos próximos ${days} dias, chefe. Tudo em dia por aqui!`;
  }
  const lines = reminders.map(
    (r) => `• ${r.clienteNome} (${r.veiculo}) — ${formatDayMonth(r.scheduledAt)}`,
  );
  const header =
    reminders.length === 1
      ? "Tem 1 lembrete pra sair:"
      : `Tem ${reminders.length} lembretes pra sair nos próximos ${days} dias:`;
  return [header, ...lines].join("\n");
}

export function formatRemindersSentThisMonth(count: number): string {
  if (count === 0) {
    return "Ainda não saiu nenhum lembrete este mês, chefe.";
  }
  const plural = count === 1 ? "lembrete" : "lembretes";
  return `Este mês já saíram ${count} ${plural} pros seus clientes, chefe.`;
}

export function formatClienteResumo(resumo: ClienteResumo): string {
  const lines = [`Cliente: ${resumo.nome} (${resumo.whatsapp})`];
  if (resumo.ultimoServico) {
    lines.push(
      `Último serviço: ${labelTipoServico(resumo.ultimoServico.tipo)} no ${resumo.ultimoServico.veiculo} em ${formatDayMonth(resumo.ultimoServico.data)}`,
    );
  }
  lines.push(
    `Total de serviços registrados: ${resumo.totalServicos}`,
  );
  if (resumo.proximoLembreteAt) {
    lines.push(`Próximo lembrete: ${formatDayMonth(resumo.proximoLembreteAt)}`);
  }
  if (resumo.status === "opt_out") {
    lines.push("⚠️ Esse cliente pediu pra não receber mais mensagens.");
  }
  return lines.join("\n");
}

export function clienteNaoEncontrado(termo: string): string {
  return `Não achei nenhum cliente com "${termo}" aqui na sua base, chefe. Confere o nome ou o telefone?`;
}

// ---------------------------------------------------------------------------
// /ajuda — texto determinístico por modo (mesmo padrão de /suporte, /voltar).
// ---------------------------------------------------------------------------
export function ajudaMessage(mode: ConversationAgentMode): string {
  switch (mode) {
    case "operacao":
      return [
        "Aqui é o assistente da sua oficina 🛠️ Posso te ajudar com:",
        "• Registrar uma troca — manda: nome do cliente, carro, serviço, data e WhatsApp.",
        "• Ver os próximos lembretes — ex.: \"quais lembretes dessa semana?\"",
        "• Quantos lembretes saíram no mês — ex.: \"quantos lembretes esse mês?\"",
        "• Consultar um cliente — ex.: \"dados do cliente João\" ou \"cliente 41999998888\".",
        "Comandos: /suporte fala com o suporte.",
      ].join("\n");
    case "onboarding":
      return [
        "Bem-vindo! Por aqui você registra as trocas e eu lembro seus clientes 🚗",
        "Pra registrar, manda em uma mensagem: nome do cliente, carro, serviço, data e WhatsApp.",
        "Comandos: /suporte fala com o suporte.",
      ].join("\n");
    case "suporte":
      return [
        "Você está no modo suporte. Me conta o que está acontecendo que eu te ajudo.",
        "Mande /voltar quando quiser voltar ao modo normal.",
      ].join("\n");
    default:
      return "Me conta o que você precisa que eu te ajudo por aqui.";
  }
}
