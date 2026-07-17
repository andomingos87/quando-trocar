# ADR 0024: Fallback conversacional em vendas (respond no `fora_escopo`)

- **Status**: accepted
- **Data**: 2026-07-16
- **Decisores**: Anderson Domingos
- **Fonte**: pedido de produto — estender a "IA livre na conversa, trilhos no crítico" (ADR-0022) ao agente de vendas: o `fora_escopo` ("pode reformular chefe") é o mesmo beco que a operação tinha, agora do lado do lead.
- **Relaciona-se com**: [ADR-0022](./0022-modo-respond-grounded.md) (**emenda o invariante 6** — "vendas segue 100% rewrite"), [ADR-0020](./0020-camada-geracao-conversacional.md) (camada e validador), [ADR-0012](./0012-politica-de-preco.md) (preço), [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md) (bot não agenda), [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md)

## Contexto

A ADR-0022 deixou vendas de fora de propósito (invariante 6): o respond nasceu na operação, onde o risco era menor e o beco mais evidente. Em produção, o `fora_escopo` de vendas segue devolvendo um pool de 5 enlatadas ("pode reformular chefe?") — o rewrite só as reembala. Perguntas legítimas do lead que não casam com nenhum intent ("vocês atendem moto?", "integra com meu sistema?") não são respondidas.

Enquanto isso, os trilhos críticos de vendas já são intents determinísticos próprios que nunca caem no `fora_escopo`: preço (`pergunta_preco`, detector com confidence 0.92; 2ª insistência → handoff, ADR-0012), FAQ com match de palavra-chave (`pergunta_faq`), teste (`quer_testar`), humano (`quer_humano`).

## Decisão

Emendar o invariante 6 da ADR-0022: **o caso geral do `fora_escopo` de vendas passa a rodar em modo respond**, grounded no conhecimento de vendas.

1. **Só o caso geral** (a rotação do pool `FALLBACK_VARIATIONS`) marca `conversationalGenerationMode: "respond"` no `AgentReply`. Os sub-caminhos do `fora_escopo` continuam determinísticos (rewrite no máximo): saudação subsequente, primeira aparição (explainer), lead já `interessado`, e o **handoff automático em ≥7 fallbacks** — quando o trilho decide entregar ao humano, a mensagem fica determinística; não "melhorar" isso depois.
2. **Conhecimento de vendas** (`buildSalesKnowledge`): `PRODUCT_FACTS` + `SALES_FACTS` (teste grátis 14 dias, ativação pela conversa, onboarding guiado, condições comerciais fecham com humano) + FAQ **filtrada por regex de preço** + link de handoff comercial. Sem `workshopName` (o interlocutor é lead). `SALES_FACTS` não entra na operação: oferecer teste grátis a quem já paga é bug de conversa.
3. **Objetivo do momento por `agentMode`** no system prompt do respond: vendas → "ajudar o lead na dúvida e direcionar para ativar o teste grátis de 14 dias"; operação/onboarding → texto anterior. Bump `REPLY_GENERATOR_PROMPT_VERSION` → `cv2-2`.
4. **Preço continua trilho crítico**: `pergunta_preco` é determinístico e nunca chega ao `fora_escopo`; a FAQ de preço é filtrada do conhecimento; o prompt proíbe citar valor; `checkPrice` do validador veta. A regra "NUNCA cite preço" é universal (teste grátis não é preço).
5. **Estado nunca reage à geração** (ADR-0001 + kill switch da ADR-0020): `consecutive_fallback` incrementa mesmo quando a geração foi boa, e o handoff em ≥7 permanece. **Proibição explícita**: nunca resetar/alterar o contador (ou qualquer estado) por sinal do LLM — `off`/`sombra`/`on` só podem diferir no texto enviado, senão desligar o modo deixa de ser reversível de forma limpa.
6. **Fallback e volante**: erro/`dontKnow`/veto → a enlatada do pool (comportamento atual). `dontKnow` em vendas também grava `perguntas_sem_resposta` (ADR-0023) com `agent_mode = "vendas"`.
7. **Auditoria**: respond em vendas registra `intent: "fora_escopo"` no audit (na operação segue `"pergunta"`).

## Alternativas consideradas

- **Manter vendas 100% rewrite** — Descartado: era o estado transitório da ADR-0022; o beco do "pode reformular" é real e o lead está no momento de maior sensibilidade do funil.
- **Respond em todos os sub-caminhos do fora_escopo** — Descartado: saudação e handoff são sociais/transacionais; o explainer da primeira aparição é o pitch canônico do produto; nada disso é pergunta a responder.
- **Resetar `consecutive_fallback` quando a geração responde bem** — Descartado (proibido, item 5): divergiria o estado entre `sombra` e `on` e quebraria a reversibilidade do kill switch. Se o limiar 7 incomodar em produção, sobe-se o limiar deterministicamente (config), nunca via sinal do LLM.
- **Incluir preço/condições no conhecimento de vendas** — Descartado: ADR-0012 (preço em resposta gerada, nunca; o "a partir de R$ X" é trilho determinístico do intent `pergunta_preco`).

## Consequências

### Positivas

- O lead recebe resposta útil em vez de "pode reformular", mantendo o funil vivo — e o direcionamento ao teste grátis vira parte da resposta.
- Volante de aprendizado (ADR-0023) passa a cobrir vendas.
- Pior caso continua sendo o pool determinístico atual (rede da ADR-0020 intacta).

### Negativas / trade-offs

- Mais chamadas de LLM em vendas (mitigado: timeout 3s, kill switch `geracao_llm_modo`).
- Se a geração for boa demais, o lead pode ficar 7 turnos "fora de escopo" bem atendido até o handoff — aceito: 7 turnos sem avançar no funil é sinal comercial de handoff, e o limiar é ajustável por código/config, nunca pelo LLM.

## Referências

- Código: `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/reply-generator.ts`, `lib/whatsapp/product-knowledge.ts`, `lib/whatsapp/webhook-handler.ts`
- Prompts espelho: `.codex/prompts/whatsapp-reply-generator.md`, `.codex/prompts/whatsapp-sales-agent.md`
- `docs/regras-de-negocio.md` §2.5 e §13.1
