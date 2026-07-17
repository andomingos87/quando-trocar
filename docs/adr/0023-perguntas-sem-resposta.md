# ADR 0023: Tabela `perguntas_sem_resposta` como volante de aprendizado

- **Status**: accepted
- **Data**: 2026-07-16
- **Decisores**: Anderson Domingos
- **Fonte**: fase futura prometida na ADR-0022 ("Migrar para banco quando houver volante de aprendizado") e em `docs/regras-de-negocio.md` §13.1. Pedido de produto: "o que o bot não soube vira FAQ e ele aprende sem deploy".
- **Relaciona-se com**: [ADR-0020](./0020-camada-geracao-conversacional.md) (camada de geração), [ADR-0022](./0022-modo-respond-grounded.md) (modo respond e protocolo "não sei"), [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) (LLM não decide estado — a gravação é reação determinística do backend)

## Contexto

O modo respond (ADR-0022) responde grounded num bloco de conhecimento fechado; fora dele, o LLM devolve `dontKnow=true` e o sistema envia a enlatada (que na operação é handoff para humano). Hoje esse "não sei" morre no audit de `agent_tool_calls`, misturado com erro/timeout no mesmo `rejectionReason` (`generation_failed_or_null`) — não há como saber *o que* o bot não soube responder para fechar o ciclo de aprendizado.

Ao mesmo tempo, a parte editável-sem-deploy do conhecimento já existe: a FAQ (`faq_vendas`), lida do banco a cada batch do webhook (sem cache entre requests) e injetada no bloco CONHECIMENTO do respond.

## Decisão

1. **Distinguir `dontKnow` de falha no contrato do gerador**: `ReplyGenerator.generate` passa a devolver `{ reply } | { reply: null, reason: "dont_know" | "error" }`. No audit, `dontKnow` ganha `rejectionReason: "generation_dont_know"`; `generation_failed_or_null` fica reservado para erro/timeout (retrocompat de consultas).
2. **Nova tabela `perguntas_sem_resposta`** (migration `20260716120000`): `conversa_id`, `lead_id`, `oficina_id`, `agent_mode`, `pergunta` (mensagem do usuário, ≤500 chars), `resposta_enviada` (a enlatada de fallback), `motivo` (v1 só `dont_know`; check já contempla `reprovada`/`erro` para extensão), `geracao_modo` (`sombra|on`), `prompt_version`, `status` (`aberta|resolvida|ignorada`, pronto para a tela admin futura). RLS habilitado sem policies (acesso só service-role, convenção do projeto).
3. **Gravação no webhook**, best-effort: só quando o modo **resolvido** da geração foi `respond` e o motivo foi `dont_know`. Método `savePerguntaSemResposta` é **opcional** na interface do repositório e o insert roda em try/catch — falha de gravação nunca derruba a resposta ao usuário.
4. **Sombra também grava**: em `geracao_llm_modo = "sombra"` o gerador roda de verdade (só não envia), então o `dontKnow` é sinal igualmente válido para o volante.

Invariantes:

- **Rewrite nunca grava**: no modo rewrite, `dontKnow=true` significa "não consegui reescrever mantendo as regras", não "pergunta sem resposta" — gravar isso poluiria a tabela (gate verificado em teste).
- **O volante fecha sem deploy**: registro em `perguntas_sem_resposta` → admin cria FAQ em `faq_vendas` → próxima mensagem já recebe a FAQ no bloco CONHECIMENTO.
- A gravação é reação determinística do backend a um sinal do LLM; o LLM não decide nada além do próprio texto (ADR-0001).

## Alternativas consideradas

- **Extrair do audit `agent_tool_calls`** — Descartado: o audit não distinguia dontKnow de falha, mistura todos os modos e não tem fluxo de triagem (`status`); uma consulta ad-hoc não fecha o volante.
- **Gravar também `reprovada` e `erro` desde já** — Adiado: veto do validador é sinal de tuning de prompt/validador (já visível no audit) e erro é ruído operacional — nenhum dos dois é "falta de FAQ". O check constraint já aceita os valores para extensão sem migration.
- **Deduplicar perguntas na gravação** — Descartado: repetição é sinal de frequência (prioriza o que virar FAQ); agrupamento é papel da tela admin futura.

## Consequências

### Positivas

- O "não sei" deixa de ser beco: cada ocorrência vira item acionável e a resposta entra no ar sem deploy (via FAQ).
- Métrica direta da cobertura do conhecimento por `agent_mode`/`prompt_version`.

### Negativas / trade-offs

- Tabela pode crescer com repetições (aceito; índice por `status, created_at` e triagem futura no admin).
- Mais um write por dontKnow no caminho do webhook (mitigado: best-effort, nunca bloqueia a resposta).

## Referências

- Código: `lib/whatsapp/reply-generator.ts`, `lib/whatsapp/repository.ts`, `lib/whatsapp/webhook-handler.ts`, `lib/whatsapp/types.ts`
- Migration: `supabase/migrations/20260716120000_perguntas_sem_resposta.sql`
- `docs/regras-de-negocio.md` §13.1
