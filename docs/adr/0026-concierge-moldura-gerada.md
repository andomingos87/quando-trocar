# ADR 0026: Moldura gerada no concierge do cliente final (revisão da ADR-0018)

- **Status**: accepted
- **Data**: 2026-07-18
- **Decisores**: Anderson Domingos
- **Revisa**: [ADR-0018](./0018-cliente-final-concierge-pre-lembrete.md) (concierge 100% determinístico)
- **Relaciona-se com**: [ADR-0020](./0020-camada-geracao-conversacional.md) (camada de geração + validador), [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md) (bot não agenda), [ADR-0012](./0012-politica-de-preco.md) (bot não cota preço), [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) (LLM não decide estado)

## Contexto

A [ADR-0018](./0018-cliente-final-concierge-pre-lembrete.md) decidiu que o concierge do cliente final (texto solto entre a confirmação e o primeiro lembrete) seria **100% determinístico** — na época, sem uma camada de geração com validador, era a única forma segura de responder um público sensível (cliente final, risco de compliance Meta).

A fase Camada Conversacional (CV1–CV7) construiu essa camada faltante: geração por LLM **grounded** + **validador determinístico** com poder de veto + **fallback enlatado** obrigatório + **modo sombra/kill switch** ([ADR-0020](./0020-camada-geracao-conversacional.md)). Com ela em produção e validada em vendas/operação, a premissa que sustentava "concierge determinístico" mudou: agora dá pra dar cara de humano ao concierge **sem** abrir mão da segurança, porque nenhum texto gerado chega ao cliente sem passar pelo validador, e qualquer reprovação/erro cai na frase enlatada de hoje.

## Decisão

**Adicionar moldura gerada (rewrite) ao concierge, restrita aos intents seguros, com uma regra extra de validação para o público cliente final.**

**1. Geração só nos intents seguros.** O gerador (modo **rewrite** — só naturaliza o tom da enlatada, proibido de inventar conteúdo) roda **apenas** em:
- `quem_e`
- `agradecimento`
- `mensagem_indefinida`

Os demais permanecem **100% determinísticos**, sem exceção:
- `opt_out`, `numero_errado` — compliance Meta, risco alto, ganho zero: a frase exata importa.
- `nao_reconhece`, `pedido_oficina` — vão a handoff pra oficina; a ponte tem que sair literal.

**2. Regra extra do validador (cliente final).** Além das checagens padrão (preço ≠ partida, promessa/agenda, links fora da allowlist, cross-tenant, tamanho), a geração do concierge exige `requireHandoffLink`: a resposta **tem que conter a ponte `wa.me` da oficina** (um link da allowlist). Sem a ponte, reprova (`sem_ponte_oficina`) → enlatada. Isso garante que a naturalização nunca "engole" o caminho pra oficina — que é o valor do concierge (bot não agenda nem cota preço, ADR-0009/0012).

**3. Allowlist inclui o `wa.me` da própria oficina.** No ramo do concierge, o link `wa.me/{oficina}` e o nome da oficina entram na allowlist de links/nomes do validador — sem isso, o rewrite seria sempre reprovado (o link não seria reconhecido) e nunca sairia.

**4. Kill switch e fallback preservados.** Vale tudo da ADR-0020: `geracao_llm_modo='off'` reverte ao concierge determinístico da ADR-0018 sem deploy; `sombra` gera+valida+loga mas envia a enlatada; qualquer erro/timeout/reprovação → enlatada. O pior cenário continua sendo o concierge determinístico de hoje.

## Alternativas consideradas

- **Manter 100% determinístico (ADR-0018 intacta)** — Descartado: com a camada de geração + validador já provada, o público cliente final passa a ser o único sem "cara de IA" sem motivo técnico; o risco está coberto pelo validador + fallback.
- **Gerar em todos os intents do concierge** — Descartado: `opt_out`/`numero_errado` são compliance-sensíveis e a frase exata importa (ganho zero em variar); handoffs precisam da ponte literal.
- **Modo respond (responder perguntas) no concierge** — Descartado: o concierge não tem base de conhecimento do cliente final e não deve responder preço/agenda; rewrite (só tom) é o teto seguro.

## Consequências

### Positivas

- Cliente final ganha resposta com cara de humano nos intents seguros, sem regressão de segurança.
- A ponte pra oficina é garantida por validação (não some na naturalização).
- Reversível por flag; sem migration.

### Negativas / trade-offs

- Mais uma superfície onde a geração pode ser reprovada (aceitável: cai na enlatada, o comportamento da ADR-0018).
- A regra `requireHandoffLink` é específica do cliente final — acoplamento pequeno no validador, documentado.

## Referências

- `lib/whatsapp/cliente-final-concierge.ts`, `lib/whatsapp/webhook-handler.ts` (ramo concierge), `lib/whatsapp/reply-validator.ts` (`requireHandoffLink`), `lib/whatsapp/reply-generator.ts`
- `docs/regras-de-negocio.md §5`
- Testes: `tests/whatsapp-reply-validator.test.ts`, `tests/whatsapp-cliente-final-concierge.test.ts`
