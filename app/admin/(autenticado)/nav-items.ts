export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

// Itens fixos, sempre visíveis no topo (fora de qualquer grupo colapsável).
export const ADMIN_NAV_STANDALONE: AdminNavItem[] = [
  { href: "/admin", label: "Visão geral", exact: true },
];

// Grupos colapsáveis. Cada seção reúne itens de um mesmo domínio de trabalho.
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { href: "/admin/oficinas", label: "Oficinas" },
      { href: "/admin/clientes", label: "Clientes finais" },
      { href: "/admin/lembretes", label: "Lembretes" },
      { href: "/admin/mensagens", label: "Mensagens" },
      { href: "/admin/tool-calls", label: "Ações dos agentes" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { href: "/admin/leads", label: "Leads" },
      { href: "/admin/representantes", label: "Representantes" },
      { href: "/admin/comissoes", label: "Comissões" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { href: "/admin/planos", label: "Planos" },
      { href: "/admin/pagamentos", label: "Pagamentos" },
      { href: "/admin/configuracoes/pagamentos", label: "Gateway pagamento" },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo & IA",
    items: [
      { href: "/admin/faq", label: "FAQ vendedor" },
      { href: "/admin/perguntas-sem-resposta", label: "Perguntas sem resposta" },
      { href: "/admin/metricas-conversacional", label: "Métricas IA" },
      { href: "/admin/tipos-servico", label: "Tipos de serviço" },
      { href: "/admin/inteligencia-mercado", label: "Inteligência mercado" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/admin/admins", label: "Admins" },
      { href: "/admin/auditoria", label: "Auditoria" },
      { href: "/admin/configuracoes", label: "Configurações", exact: true },
    ],
  },
];
