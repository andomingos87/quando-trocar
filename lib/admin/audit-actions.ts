// Catálogo de ações de auditoria: traduz o código técnico de `admin_audit_log.acao`
// para um rótulo PT-BR legível e uma categoria (que define a cor do indicador na UI).

export type AcaoCategoria =
  | "sessao"
  | "criacao"
  | "atualizacao"
  | "remocao"
  | "financeiro";

export type AcaoDescricao = {
  label: string;
  categoria: AcaoCategoria;
};

// Mapa explícito das ações conhecidas. Para ações novas/desconhecidas o
// `describeAcao` cai no humanizador genérico abaixo.
const ACOES: Record<string, AcaoDescricao> = {
  "admin.login": { label: "Entrou no painel", categoria: "sessao" },
  "admin.logout": { label: "Saiu do painel", categoria: "sessao" },
  "admin.invite": { label: "Convidou um admin", categoria: "criacao" },
  "admin.delete": { label: "Removeu um admin", categoria: "remocao" },

  "oficina.create_manual": { label: "Cadastrou oficina (manual)", categoria: "criacao" },
  "oficina.update_cadastro": { label: "Editou cadastro da oficina", categoria: "atualizacao" },
  "oficina.update_plano": { label: "Alterou plano da oficina", categoria: "atualizacao" },
  "oficina.update_preco": { label: "Alterou preço da oficina", categoria: "atualizacao" },
  "oficina.update_status": { label: "Alterou status da oficina", categoria: "atualizacao" },
  "oficina.auto_pausa_inadimplencia": { label: "Pausou oficina por inadimplência", categoria: "financeiro" },
  "oficina.cobranca_manual_disparada": { label: "Disparou cobrança manual", categoria: "financeiro" },

  "cliente.update": { label: "Editou cliente", categoria: "atualizacao" },
  "cliente.change_whatsapp": { label: "Alterou WhatsApp do cliente", categoria: "atualizacao" },
  "cliente.marcar_numero_correto": { label: "Marcou número como correto", categoria: "atualizacao" },
  "cliente.marcar_numero_errado": { label: "Marcou número como errado", categoria: "atualizacao" },
  "cliente.marcar_opt_out": { label: "Marcou opt-out do cliente", categoria: "remocao" },
  "cliente.reactivate": { label: "Reativou cliente", categoria: "criacao" },
  "cliente.soft_delete": { label: "Removeu cliente", categoria: "remocao" },

  "lead.update": { label: "Editou lead", categoria: "atualizacao" },
  "lead.change_status": { label: "Alterou status do lead", categoria: "atualizacao" },
  "lead.change_whatsapp": { label: "Alterou WhatsApp do lead", categoria: "atualizacao" },
  "lead.convert_manual": { label: "Converteu lead (manual)", categoria: "criacao" },
  "lead.reopen": { label: "Reabriu lead", categoria: "criacao" },
  "lead.marcar_perdido": { label: "Marcou lead como perdido", categoria: "remocao" },
  "lead.soft_delete": { label: "Removeu lead", categoria: "remocao" },

  "lembrete.cancelar": { label: "Cancelou lembrete", categoria: "remocao" },

  "pagamento.cancelado_manual": { label: "Cancelou pagamento (manual)", categoria: "financeiro" },
  "pagamento.link_reenviado": { label: "Reenviou link de pagamento", categoria: "financeiro" },

  "outbound_message.retry": { label: "Reenviou mensagem", categoria: "financeiro" },
  "conversa.handoff_resolved": { label: "Resolveu atendimento humano", categoria: "atualizacao" },

  "configuracoes_vendedor.update": { label: "Editou configurações do vendedor", categoria: "atualizacao" },
  "tipo_servico.update": { label: "Editou tipo de serviço", categoria: "atualizacao" },

  "faq.create": { label: "Criou FAQ", categoria: "criacao" },
  "faq.update": { label: "Editou FAQ", categoria: "atualizacao" },
  "faq.deactivate": { label: "Desativou FAQ", categoria: "remocao" },

  "plano.create": { label: "Criou plano", categoria: "criacao" },
  "plano.update": { label: "Editou plano", categoria: "atualizacao" },
  "plano.deactivate": { label: "Desativou plano", categoria: "remocao" },
};

// Heurística para ações fora do mapa: deriva categoria a partir do sufixo do verbo.
function inferCategoria(acao: string): AcaoCategoria {
  const verbo = acao.includes(".") ? acao.slice(acao.indexOf(".") + 1) : acao;
  if (/^(login|logout)/.test(verbo)) return "sessao";
  if (/(create|criar|convert|reactivate|reopen|invite)/.test(verbo)) return "criacao";
  if (/(delete|soft_delete|deactivate|cancelar|perdido|opt_out|remove)/.test(verbo)) return "remocao";
  if (/(pagamento|cobranca|inadimplencia|link|retry|reenvi)/.test(acao)) return "financeiro";
  return "atualizacao";
}

// Transforma "oficina.update_cadastro" em "Oficina · update cadastro" como último recurso.
function humanizar(acao: string): string {
  const cleaned = acao.replace(/[._]/g, " ").trim();
  if (!cleaned) return acao;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function describeAcao(acao: string): AcaoDescricao {
  const known = ACOES[acao];
  if (known) return known;
  return { label: humanizar(acao), categoria: inferCategoria(acao) };
}

// Classe Tailwind do indicador (bolinha) por categoria — tokens do globals.css.
export const CATEGORIA_DOT: Record<AcaoCategoria, string> = {
  sessao: "bg-muted",
  criacao: "bg-cyan",
  atualizacao: "bg-ink",
  remocao: "bg-red",
  financeiro: "bg-brand",
};

// Rótulo legível para o nome bruto da entidade (tabela) do audit log.
const ENTIDADES: Record<string, string> = {
  admin_users: "Admin",
  oficinas: "Oficina",
  oficina: "Oficina",
  clientes: "Cliente",
  cliente: "Cliente",
  leads: "Lead",
  lead: "Lead",
  pagamentos: "Pagamento",
  pagamento: "Pagamento",
  lembretes: "Lembrete",
  lembrete: "Lembrete",
  planos: "Plano",
  plano: "Plano",
  faq: "FAQ",
  tipos_servico: "Tipo de serviço",
  tipo_servico: "Tipo de serviço",
  configuracoes_vendedor: "Config. do vendedor",
  outbound_messages: "Mensagem",
  conversas: "Conversa",
};

export function describeEntidade(entidade: string | null | undefined): string {
  if (!entidade) return "";
  return ENTIDADES[entidade] ?? entidade.replace(/_/g, " ");
}
