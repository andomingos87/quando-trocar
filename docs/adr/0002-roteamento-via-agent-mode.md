# ADR 0002: Roteamento determinístico via `agent_mode` + `participant_type`

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `AGENTS.md §Architecture Rules`, `docs/product/PRD-whatsapp-bot.md §5`

## Contexto

O bot atende dois grupos distintos com dois objetivos opostos:

- **Antes da contratação** — agente vende para a oficina (modo `vendas`).
- **Depois da contratação** — agente trabalha para a oficina, atendendo a própria oficina (`onboarding`, `operacao`) ou seus clientes finais (`cliente_final_lembrete`).

Se o agente confundir uma oficina ativa com um lead novo, ele explica o produto pra quem já comprou. Se confundir um cliente final com a oficina, ele tenta vender o produto pra quem só queria agendar troca de óleo. Ambos casos quebram a UX e a confiança.

A pergunta: como o sistema sabe quem está falando antes de gerar resposta?

## Decisão

A identidade do interlocutor (`participant_type`) e o modo de atendimento (`agent_mode`) são **resolvidos deterministicamente antes do LLM ser invocado**. O resolver (`lib/whatsapp/conversation-router.ts`) consulta o banco — `oficinas`, `clientes_finais`, `leads_oficina` — e classifica.

Modos possíveis: `vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`, `suporte`.

O LLM recebe o modo já resolvido como parte do prompt e atende dentro daquele papel. Não é o LLM que descobre quem é quem.

## Alternativas consideradas

- **LLM classifica e roteia** — LLM lê histórico da conversa e decide o modo. Descartado: aumenta latência e erro de classificação tem impacto alto.
- **Sessões expiradas por timeout** — Identifica por janela de tempo. Descartado: insuficiente — o mesmo número pode ser oficina hoje e lead amanhã.
- **Resolver determinístico antes do LLM** — Escolhido. Banco é fonte de verdade da identidade.

## Consequências

### Positivas

- Erro de identidade vira erro de query (rastreável e testável), não erro de LLM.
- LLM recebe contexto claro e responde com prompt especializado por modo.
- Testes de roteamento são unit tests determinísticos, não eval de LLM.

### Negativas / trade-offs

- Resolver fica mais complexo — precisa lidar com casos ambíguos (mesmo número como cliente_final de uma oficina e dono de outra oficina, por exemplo).
- Mudanças de modo precisam ser explícitas no código (mais boilerplate).
- Adicionar novo modo é uma mudança de schema (enum) + código de roteamento.

## Referências

- `AGENTS.md §Architecture Rules`
- `docs/product/PRD-whatsapp-bot.md §5` (Princípio Central do Agente)
- `lib/whatsapp/conversation-router.ts`
- `docs/glossary.md` (definições de `agent_mode` e `participant_type`)
