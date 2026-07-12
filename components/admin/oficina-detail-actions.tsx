"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/admin/ui";
import { OficinaFormModal } from "@/components/admin/oficina-form-modal";
import type { OficinaDetail } from "@/lib/admin/oficinas";

export function OficinaDetailActions({
  oficina,
  planos,
  representantes,
}: {
  oficina: OficinaDetail;
  planos: Array<{ id: string; nome: string }>;
  representantes: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [charging, setCharging] = useState(false);
  const cobrancaManualEnabled = process.env.NEXT_PUBLIC_ADMIN_BILLING_ENABLED === "true";

  const dispararCobranca = async () => {
    if (!confirm("Disparar cobranca manual fora do ciclo?")) return;
    setCharging(true);
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}/cobrar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(data.message ?? "Erro ao disparar cobranca.");
        return;
      }
      router.refresh();
    } finally {
      setCharging(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)}>
        Editar cadastro
      </Button>
      {cobrancaManualEnabled ? (
        <Button
          onClick={dispararCobranca}
          disabled={charging || !oficina.cobranca_pronta}
          title={oficina.cobranca_pronta ? undefined : "Preencha o CPF/CNPJ antes de cobrar."}
        >
          {charging ? "Disparando..." : "Disparar cobranca manual"}
        </Button>
      ) : null}

      {editing ? (
        <OficinaFormModal
          mode="edit"
          oficina={oficina}
          planos={planos}
          representantes={representantes}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
