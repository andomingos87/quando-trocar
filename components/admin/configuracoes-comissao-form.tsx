"use client";

import { useState } from "react";

import { Button, Field, Input, Select } from "@/components/admin/ui";
import type { ConfiguracoesComissaoRow } from "@/lib/admin/comissoes";

export function ConfiguracoesComissaoForm({
  initial,
}: {
  initial: ConfiguracoesComissaoRow;
}) {
  const [tipo, setTipo] = useState<"percentual" | "fixo">(initial.comissao_tipo);
  const [valor, setValor] = useState(String(initial.comissao_valor));
  const [duracao, setDuracao] = useState(
    initial.comissao_duracao_meses !== null ? String(initial.comissao_duracao_meses) : "",
  );
  const [base, setBase] = useState<"valor_pago" | "preco_tabela">(initial.comissao_base);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const n = Number(valor.replace(",", "."));
    if (valor.trim() === "" || Number.isNaN(n) || n < 0) {
      setError("Valor da comissao invalido.");
      return;
    }

    let duracaoMeses: number | null = null;
    if (duracao.trim() !== "") {
      const d = Number(duracao);
      if (!Number.isInteger(d) || d < 1) {
        setError("Duracao deve ser um numero inteiro de meses (ou vazio para vitalicia).");
        return;
      }
      duracaoMeses = d;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/configuracoes-comissao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comissao_tipo: tipo,
          comissao_valor: n,
          comissao_duracao_meses: duracaoMeses,
          comissao_base: base,
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
      setSaved(true);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de comissao">
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "percentual" | "fixo")}
          >
            <option value="percentual">Percentual (%) sobre a mensalidade</option>
            <option value="fixo">Valor fixo (R$) por pagamento</option>
          </Select>
        </Field>
        <Field label={tipo === "percentual" ? "Percentual (%)" : "Valor (R$)"}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Duracao (meses)"
          hint="Quantos pagamentos de cada oficina geram comissao. Vazio = vitalicia."
        >
          <Input
            type="number"
            min="1"
            step="1"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            placeholder="vitalicia"
          />
        </Field>
        <Field label="Base de calculo do percentual">
          <Select
            value={base}
            onChange={(e) => setBase(e.target.value as "valor_pago" | "preco_tabela")}
          >
            <option value="valor_pago">Valor realmente pago pela oficina</option>
            <option value="preco_tabela">Preco de tabela do plano</option>
          </Select>
        </Field>
      </div>

      {base === "preco_tabela" ? (
        <p className="rounded-lg border border-orange/40 bg-orange-soft px-3 py-2 text-sm text-ink">
          Atencao: com base no preco de tabela, uma oficina com preco negociado
          abaixo da tabela pode gerar comissao maior que a receita do mes.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-lg border border-line bg-cyan-soft px-3 py-2 text-sm text-ink">
          Configuracoes salvas. Valem apenas para comissoes futuras — as ja geradas
          nao mudam.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Salvar comissao"}
        </Button>
      </div>
    </form>
  );
}
