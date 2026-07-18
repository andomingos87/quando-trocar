import type { StatusTone } from "@/components/admin/ui";
import type { OficinaStatus } from "@/lib/representante/carteira";
import type { LeadStatus } from "@/lib/representante/leads";
import type { ComissaoStatus } from "@/lib/admin/comissoes";

// Rotulos + tom de badge para os status exibidos no portal do representante.
// Mantido puro (sem "use client") para poder ser usado nos server components.

export const OFICINA_STATUS: Record<OficinaStatus, { label: string; tone: StatusTone }> = {
  ativa: { label: "Ativa", tone: "sucesso" },
  pausada: { label: "Pausada", tone: "atencao" },
  cancelada: { label: "Cancelada", tone: "erro" },
};

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: StatusTone }> = {
  novo: { label: "Novo", tone: "info" },
  em_conversa: { label: "Em conversa", tone: "info" },
  qualificado: { label: "Qualificado", tone: "brand" },
  interessado: { label: "Interessado", tone: "brand" },
  teste_aceito: { label: "Em teste", tone: "brand" },
  convertido: { label: "Convertido", tone: "sucesso" },
  perdido: { label: "Perdido", tone: "inativo" },
};

export const COMISSAO_STATUS: Record<ComissaoStatus, { label: string; tone: StatusTone }> = {
  prevista: { label: "Prevista", tone: "atencao" },
  paga: { label: "Paga", tone: "sucesso" },
  cancelada: { label: "Cancelada", tone: "inativo" },
};
