# ADR 0020: Camada de geração conversacional com validador determinístico

- **Status**: accepted
- **Data**: 2026-07-11
- **Decisores**: Anderson Domingos
- **Fonte**: pedido de produto — bot "mais conversacional / com cara de IA" sem perder segurança e fluxo. Plano em [fase-camada-conversacional](../backlog-whatsapp-bot/fase-camada-conversacional.md).
- **Relaciona-se com**: [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) (LLM não decide estado — **este ADR complementa, não altera**), [ADR-0002](./0002-roteamento-via-agent-mode.md) (roteamento determinístico), [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md), [ADR-0012](./0012-politica-de-preco.md)

## Contexto

Hoje **100% das respostas enviadas pelo bot são strings fixas** no código (`GREETING_AFTER_GREETED`, `FALLBACK_VARIATIONS`, `SOCIAL_TEST_VARIATIONS` em `sales-agent.ts`; respostas determinísticas em `cliente-final-concierge.ts`; linhas de `faq_vendas`). O LLM é usado **apenas para classificar** intenção com Structured Outputs e enum fechado — nunca para gerar o texto que chega ao cliente.

Consequências observadas:

- Qualquer pergunta fora do enum cai em "Pode reformular chefe?" — um beco sem saída que derruba conversão.
- O classificador vê **apenas a última mensagem**. Nenhum agente lê o histórico da conversa (o `repository.ts` só tem inserts em `mensagens` e um count de mídia — nenhuma leitura de contexto conversacional).
- O env `OPENAI_MODEL_RESPONDER`, previsto no [plano técnico §7](../architecture/whatsapp-bot-technical-plan.md) desde o início, **nunca foi usado**.

A ADR-0001 estabeleceu que "o LLM gera texto e interpreta, mas não decide estado". A leitura conservadora que se consolidou foi "não deixar o LLM gerar texto de saída". Isso vai além do que a ADR-0001 exige: ela protege **estado** (status, pagamento, opt-out, agent_mode), não proíbe **geração de texto**.

## Decisão

Introduzir uma **camada de geração de resposta por LLM**, posicionada entre a decisão determinística de estado e o envio, cercada por um **validador determinístico** de saída.

```
mensagem → guardrails determinísticos (opt-out, /suporte, pausa)   [inalterado]
        → classificação de intenção (regex → LLM, enum fechado)    [inalterado]
        → decisão de AÇÃO/ESTADO (backend determinístico)          [inalterado]
        → geração da resposta (NOVO: LLM grounded, com histórico)
        → validador de saída (NOVO: determinístico, pré-envio)
        → envio
```

Invariantes (todos verificáveis em teste):

1. **Texto gerado nunca muda estado.** A geração só produz `string`. `lead.status`, `participant_type`, `agent_mode`, pagamento, opt-out e status de lembrete continuam decididos exclusivamente por regra determinística (ADR-0001 intacta). O backend decide **o que** dizer (fatos permitidos + ação + CTA — o "esqueleto"); o LLM decide **como** dizer.
2. **Validador determinístico com poder de veto.** Toda saída gerada passa por `reply-validator.ts` antes do envio. Reprova (e cai no fallback enlatado): preço numérico ≠ `precoPartida` (ADR-0012); promessa de resultado/agenda/prazo (ADR-0009); URL fora da allowlist; nome de oficina/cliente fora do contexto resolvido (cross-tenant); tamanho acima do cap.
3. **Fallback enlatado obrigatório.** Erro, timeout ou reprovação → envia a string fixa atual. O comportamento de hoje é a rede de segurança: o pior cenário de qualquer mudança desta camada é o bot atual.
4. **Modo sombra antes de ativar.** Flag `configuracoes_vendedor.geracao_llm_modo` (`off` | `sombra` | `on`). `off` = comportamento idêntico ao atual. `sombra` = gera, valida e loga o que *diria*, mas envia a enlatada. `on` = envia a gerada aprovada. Kill switch permanente sem deploy.
5. **Auditoria.** Cada geração registra em `agent_tool_calls`: versão do prompt, intenção, aprovada/reprovada, motivo da reprovação, se usou fallback.
6. **Protocolo "não sei".** Fora do conhecimento fornecido (base de FAQ/produto/objeções), o bot admite e encaminha — nunca inventa. Perguntas assim viram registro em `perguntas_sem_resposta` (volante de aprendizado).

## Alternativas consideradas

- **Manter tudo determinístico (status quo)** — Descartado: é a causa direta do beco "reformula chefe" e da baixa naturalidade; deixa `OPENAI_MODEL_RESPONDER` sem uso.
- **Deixar o LLM responder livre, sem validador** — Descartado: reabre risco de cotar preço, prometer agenda, alucinar e ser vítima de prompt injection. Sem veto determinístico, a ADR-0001 ficaria só no papel.
- **Fine-tune / modelo dedicado por oficina** — Descartado no MVP: custo e complexidade desproporcionais; grounding via base editável resolve com custo marginal.
- **Trocar o classificador por geração pura (sem enum)** — Descartado: a decisão de estado depende do enum fechado; misturar classificação e geração num só passo reabre o acoplamento que a ADR-0001 separou.

## Consequências

### Positivas

- Fim do beco sem saída: perguntas fora do script recebem resposta útil.
- Continuidade de conversa (histórico) e tom on-brand consistente.
- Volante de aprendizado: pergunta sem resposta → admin responde 1× → vira FAQ (melhora sem deploy).
- ADR-0001 fortalecida na prática: o validador transforma o princípio em teste automatizado (suite red-team).
- Aproveita infraestrutura já prevista (`OPENAI_MODEL_RESPONDER`).

### Negativas / trade-offs

- Custo de OpenAI por turno cresce (mitigado: modelo pequeno, enlatada segue servindo intents de alta frequência, monitoramento na fase CV7).
- Latência de geração (mitigado: timeout 3s + typing indicator).
- Risco de alucinação (mitigado: grounding + protocolo "não sei" + validador + red-team).
- Mais volume de mensagens pode degradar o quality rating do número Meta (mitigado: alerta de rating na CV7, follow-up capado).
- Prompts viram código versionado com regressão obrigatória (`.codex/prompts/` + suite golden/red-team em `npm test`).

## Referências

- Plano: `docs/backlog-whatsapp-bot/fase-camada-conversacional.md`
- Código (a criar): `lib/whatsapp/reply-generator.ts`, `lib/whatsapp/reply-validator.ts`, `.codex/prompts/whatsapp-reply-generator.md`
- Código (a alterar): `lib/whatsapp/webhook-handler.ts`, `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/repository.ts`
- `docs/regras-de-negocio.md §13`
- Revisão da [ADR-0018](./0018-cliente-final-concierge-pre-lembrete.md) prevista para a fase CV8 (concierge do cliente final).
