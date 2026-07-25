# ADR 0028: Volante seguro de gatilhos de intenção de vendas

- **Status**: accepted
- **Data**: 2026-07-25
- **Decisores**: Anderson Domingos
- **Fonte**: QTR-35 P1 — o classificador LLM tratou "Quero fazer" como desinteresse, embora o backend não tenha movido o lead para perdido.
- **Relaciona-se com**: ADR-0001 (LLM não decide estado), ADR-0023 (volante de aprendizado), ADR-0024 (respond em vendas).

## Contexto

O classificador de vendas combina regras determinísticas e fallback LLM. Quando eles divergem, o erro fica só no comportamento do turno: não havia fila operacional para reconhecer padrões reais e promover uma regra segura sem novo deploy.

Esse volante não pode ser um caminho indireto para o modelo tornar um lead perdido. Intenções terminais são decisões de estado, não conhecimento editável.

## Decisão

Criar duas tabelas internas, ambas com RLS e sem policies: `divergencias_intencao_vendas` registra a divergência, e `gatilhos_intencao_vendas` contém padrões aprovados manualmente. O webhook grava divergência best-effort; falha de auditoria não bloqueia resposta. Gatilhos ativos entram no classificador somente depois de recusa explícita e dor.

O banco restringe gatilhos a `quer_testar`, `pergunta_preco`, `pergunta_funcionamento`, `quer_humano` e `vai_pensar`. `sem_interesse`, `perdido` e qualquer transição terminal ficam exclusivamente sob `isExplicitLossMessage` no backend.

## Alternativas consideradas

- **Log sem gatilhos consumíveis** — descartado: registra o problema, mas não fecha o ciclo de melhoria sem deploy.
- **Promoção automática pelo LLM** — descartada: criaria um caminho não auditado para mudar o funil e contrariaria ADR-0001.
- **Tela administrativa nesta entrega** — adiada para issue-filha. A promoção inicial é feita no Supabase Studio por operação autorizada.

## Consequências

### Positivas

- Padrões observados em conversas reais viram classificação determinística e reversível por ativação/desativação.
- O audit mostra a sugestão do LLM e o intent efetivamente aplicado pelo backend.

### Negativas / trade-offs

- Até a tela existir, a promoção é operacional e exige cuidado humano no Studio.
- O cache curto de 60 segundos pode atrasar a ativação, mas evita query extra a cada mensagem.

## Referências

- Migration `20260725201415_volante_intencao_vendas.sql`
- `lib/whatsapp/sales-agent.ts`, `repository.ts`, `webhook-handler.ts`
- `docs/regras-de-negocio.md` §1.9
