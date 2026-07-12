import { StatusBadge, type StatusTone } from "@/components/admin/ui";
import type { OficinaStatus } from "@/lib/admin/oficinas";

const TONE: Record<OficinaStatus, StatusTone> = {
  ativa: "sucesso",
  pausada: "atencao",
  cancelada: "inativo",
};

/** Badge de status da oficina — fonte unica de cor/rotulo (antes duplicado em 3 telas). */
export function OficinaStatusBadge({
  status,
  motivo,
  className,
}: {
  status: OficinaStatus;
  motivo?: string | null;
  className?: string;
}) {
  return (
    <StatusBadge tone={TONE[status]} className={className}>
      {status}
      {motivo ? ` · ${motivo}` : ""}
    </StatusBadge>
  );
}
