export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Visao geral", exact: true },
  { href: "/admin/oficinas", label: "Oficinas" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/clientes", label: "Clientes finais" },
  { href: "/admin/lembretes", label: "Lembretes" },
  { href: "/admin/mensagens", label: "Mensagens enviadas" },
  { href: "/admin/tool-calls", label: "Tool calls" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/auditoria", label: "Auditoria" },
];
