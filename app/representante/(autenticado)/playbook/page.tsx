import { requireRepresentante } from "@/lib/representante/api-guard";
import { PLAYBOOK, type PlaybookBloco } from "@/lib/representante/content/playbook";

export const dynamic = "force-dynamic";

export default async function RepresentantePlaybookPage() {
  // Conteudo estatico, mas a rota e autenticada (so representante entra).
  await requireRepresentante();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Playbook de vendas</h1>
        <p className="mt-1 text-sm text-muted">
          Como apresentar o Quando Trocar, responder objeções e fechar mais oficinas.
        </p>
      </header>

      <div className="space-y-4">
        {PLAYBOOK.map((secao) => (
          <section key={secao.id} className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">{secao.titulo}</h2>
            {secao.resumo ? (
              <p className="mt-0.5 text-sm text-muted">{secao.resumo}</p>
            ) : null}
            <div className="mt-4 space-y-4">
              {secao.blocos.map((bloco, i) => (
                <Bloco key={i} bloco={bloco} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Bloco({ bloco }: { bloco: PlaybookBloco }) {
  switch (bloco.tipo) {
    case "paragrafos":
      return (
        <div className="space-y-3">
          {bloco.itens.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink/90">
              {p}
            </p>
          ))}
        </div>
      );
    case "lista":
      return (
        <ul className="space-y-2">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink/90">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      );
    case "passos":
      return (
        <ol className="space-y-2.5">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink/90">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "qa":
      return (
        <dl className="space-y-3">
          {bloco.itens.map((qa, i) => (
            <div key={i} className="rounded-xl bg-paper-soft p-4">
              <dt className="text-sm font-semibold text-ink">{qa.pergunta}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{qa.resposta}</dd>
            </div>
          ))}
        </dl>
      );
  }
}
