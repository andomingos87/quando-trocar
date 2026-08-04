import {
  BookOpen,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Megaphone,
  Store,
  User,
  UserPlus,
  Wallet,
} from "lucide-react";

export type RepNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  // primary = aparece na barra inferior do mobile.
  primary?: boolean;
};

// Ordem canonica do portal do representante. `primary` define os itens da barra
// inferior no mobile; os demais ficam no menu do topo.
export const REP_NAV: RepNavItem[] = [
  { href: "/representante", label: "Início", icon: LayoutDashboard, exact: true, primary: true },
  { href: "/representante/clientes", label: "Clientes", icon: Store, primary: true },
  { href: "/representante/leads", label: "Leads", icon: UserPlus, primary: true },
  { href: "/representante/comissoes", label: "Comissões", icon: Wallet, primary: true },
  { href: "/representante/meu-link", label: "Meu link", icon: Link2, primary: true },
  { href: "/representante/playbook", label: "Playbook", icon: BookOpen },
  { href: "/representante/novidades", label: "Novidades", icon: Megaphone },
  { href: "/representante/perfil", label: "Perfil", icon: User },
];
