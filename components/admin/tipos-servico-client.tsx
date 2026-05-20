"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TipoServicoDefault } from "@/lib/admin/tipos-servico";

type EditState = {
  tipo: string;
  label: string;
  diasLembrete: string;
  templateName: string;
  templateLanguage: string;
  ativo: boolean;
};

export function TiposServicoClient({
  initialTipos,
}: {
  initialTipos: TipoServicoDefault[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (t: TipoServicoDefault) => {
    setEditing({
      tipo: t.tipo_servico,
      label: t.label,
      diasLembrete: String(t.dias_lembrete),
      templateName: t.template_name,
      templateLanguage: t.template_language,
      ativo: t.ativo,
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(editing.tipo);
    setError(null);
    const days = Number(editing.diasLembrete);
    if (!Number.isInteger(days) || days <= 0) {
      setError("Dias deve ser inteiro > 0.");
      setBusy(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/tipos-servico/${editing.tipo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editing.label,
          dias_lembrete: days,
          template_name: editing.templateName,
          template_language: editing.templateLanguage,
          ativo: editing.ativo,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar.");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Dias</th>
              <th className="px-3 py-2">Template Meta</th>
              <th className="px-3 py-2">Idioma</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {initialTipos.map((t) => {
              const isEditing = editing?.tipo === t.tipo_servico;
              return (
                <tr key={t.tipo_servico} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{t.tipo_servico}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        className="w-full rounded border border-line px-2 py-1"
                        value={editing!.label}
                        onChange={(e) =>
                          setEditing({ ...editing!, label: e.target.value })
                        }
                      />
                    ) : (
                      t.label
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded border border-line px-2 py-1"
                        value={editing!.diasLembrete}
                        onChange={(e) =>
                          setEditing({ ...editing!, diasLembrete: e.target.value })
                        }
                      />
                    ) : (
                      t.dias_lembrete
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {isEditing ? (
                      <input
                        className="w-full rounded border border-line px-2 py-1"
                        value={editing!.templateName}
                        onChange={(e) =>
                          setEditing({ ...editing!, templateName: e.target.value })
                        }
                      />
                    ) : (
                      t.template_name
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {isEditing ? (
                      <input
                        className="w-20 rounded border border-line px-2 py-1"
                        value={editing!.templateLanguage}
                        onChange={(e) =>
                          setEditing({ ...editing!, templateLanguage: e.target.value })
                        }
                      />
                    ) : (
                      t.template_language
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editing!.ativo}
                        onChange={(e) =>
                          setEditing({ ...editing!, ativo: e.target.checked })
                        }
                      />
                    ) : t.ativo ? (
                      "sim"
                    ) : (
                      "nao"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded bg-primary px-3 py-1 text-white disabled:opacity-50"
                          disabled={busy === t.tipo_servico}
                          onClick={handleSave}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="rounded border border-line px-3 py-1"
                          onClick={() => setEditing(null)}
                          disabled={busy === t.tipo_servico}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-line px-3 py-1"
                        onClick={() => handleEdit(t)}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Atualizacoes refletem no scheduler na proxima execucao (cron rodando a cada 5
        min). Mudancas em template Meta exigem que o template ja esteja aprovado.
      </p>
    </div>
  );
}
