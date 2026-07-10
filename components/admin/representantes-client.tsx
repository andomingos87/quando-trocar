"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatBRL } from "@/lib/admin/format";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import type { RepresentanteListRow } from "@/lib/admin/representantes";
import { whatsappLink } from "@/lib/config";
import { RepresentanteFormModal } from "./representante-form-modal";

type ModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; representante: RepresentanteListRow };

function repLink(fraseLanding: string, codigo: string): string {
  return whatsappLink({ message: `${fraseLanding} #REP-${codigo}` });
}

function comissaoLabel(rep: RepresentanteListRow): string {
  if (rep.comissao_tipo === null || rep.comissao_valor === null) return "Regra global";
  return rep.comissao_tipo === "percentual"
    ? `${rep.comissao_valor}% por pagamento`
    : `${formatBRL(rep.comissao_valor)} por pagamento`;
}

export function RepresentantesClient({
  initial,
  fraseLanding,
}: {
  initial: RepresentanteListRow[];
  fraseLanding: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = async (rep: RepresentanteListRow) => {
    await navigator.clipboard.writeText(repLink(fraseLanding, rep.codigo));
    setCopiedId(rep.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {initial.length} {initial.length === 1 ? "representante" : "representantes"} ·{" "}
          <Link href="/admin/comissoes" className="text-brand-dark hover:underline">
            ver extrato de comissoes →
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setModal({ open: true, mode: "create" })}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:w-auto"
        >
          Novo representante
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Codigo</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Comissao</th>
              <th className="px-4 py-3 font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">Oficinas ativas</th>
              <th className="px-4 py-3 font-medium">Prevista</th>
              <th className="px-4 py-3 font-medium">Paga</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-left text-muted">
                  Nenhum representante. Clique em <strong>Novo representante</strong>{" "}
                  para cadastrar o primeiro.
                </td>
              </tr>
            ) : null}
            {initial.map((rep) => (
              <tr key={rep.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3 font-medium text-ink">{rep.nome}</td>
                <td className="px-4 py-3">
                  <code className="rounded bg-paper-soft px-1.5 py-0.5 text-xs">
                    #REP-{rep.codigo}
                  </code>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatPhoneBR(rep.whatsapp)}
                </td>
                <td className="px-4 py-3 text-muted">{comissaoLabel(rep)}</td>
                <td className="px-4 py-3 tabular-nums">{rep.leads_count}</td>
                <td className="px-4 py-3 tabular-nums">{rep.oficinas_ativas_count}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(rep.comissao_prevista)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(rep.comissao_paga)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      rep.ativo
                        ? "inline-flex rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-ink"
                        : "inline-flex rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink"
                    }
                  >
                    {rep.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(rep)}
                      className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft"
                    >
                      {copiedId === rep.id ? "Copiado!" : "Copiar link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, mode: "edit", representante: rep })}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft"
                    >
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open ? (
        <RepresentanteFormModal
          mode={modal.mode}
          representante={modal.mode === "edit" ? modal.representante : null}
          linkPreview={
            modal.mode === "edit" ? repLink(fraseLanding, modal.representante.codigo) : null
          }
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
