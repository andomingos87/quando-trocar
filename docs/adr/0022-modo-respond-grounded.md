# ADR 0022: Modo "respond" grounded na camada de geração conversacional

- **Status**: accepted
- **Data**: 2026-07-16
- **Decisores**: Anderson Domingos
- **Fonte**: pedido de produto — "não vou conseguir mapear tudo que o cliente pode perguntar; quero uma IA conversacional que entende e responde de tudo, sempre direcionando ao objetivo do momento, e usa os trilhos/templates no que é crítico". Evidência em produção: no modo `operacao`, "E quanto custa?" e "Já sou cliente?" caíam no despejo do formulário de cadastro (beco sem saída).
- **Relaciona-se com**: [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) (LLM não decide estado — intacta), [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md) (bot não agenda), [ADR-0012](./0012-politica-de-preco.md) (bot não cota preço), [ADR-0020](./0020-camada-geracao-conversacional.md) (camada de geração com validador — este ADR adiciona um segundo modo à mesma camada)

## Contexto

A ADR-0020 (fase CV1) introduziu a camada de geração com um único modo, **rewrite**: o backend decide *o que* dizer (a enlatada) e o LLM apenas reescreve o tom, proibido de adicionar conteúdo. Isso melhora a naturalidade, mas não resolve o beco: quando a oficina pergunta algo fora do script (`generico` no agente de operação), a enlatada é o formulário de cadastro — e o rewrite só reembala o formulário com sinônimos. O usuário nunca é *respondido*.

Mapear todas as perguntas possíveis em categorias determinísticas não escala. A alternativa é inverter o modelo na faixa não-crítica: o LLM responde de verdade, mas **grounded** — só pode afirmar o que está num bloco de conhecimento fechado fornecido pelo backend.

## Decisão

Adicionar um segundo modo à camada de geração (`lib/whatsapp/reply-generator.ts`): **`respond`**.

```
faixa CRÍTICA (lista fechada, determinística):        [inalterado]
  cadastro em andamento, confirmação, preço, agendamento,
  pagamento, opt-out, mensagens frias (templates Meta)
faixa CONVERSACIONAL (todo o resto):
  rewrite (CV1): reescreve a enlatada                  [inalterado]
  respond (NOVO): responde a pergunta, grounded em:
    - objetivo do momento por agent_mode
    - bloco CONHECIMENTO fechado (fatos do produto + FAQ filtrada
      + contexto da oficina + link de handoff)
    - histórico recente
→ validador determinístico com veto                    [inalterado]
→ fallback enlatado obrigatório                        [inalterado]
```

Invariantes (todos herdados da ADR-0020 e verificáveis em teste):

1. **Respond gera só texto; nunca decide estado** (ADR-0001 intacta).
2. **Grounding fechado**: os únicos fatos afirmáveis estão no bloco CONHECIMENTO (`lib/whatsapp/product-knowledge.ts` + FAQ do banco filtrada + contexto do tenant). Fora disso → protocolo "não sei" (`dontKnow=true`) → fallback enlatado.
3. **Fallback enlatado obrigatório**: erro, timeout, `dontKnow` ou reprovação do validador → envia a enlatada determinística. Na categoria `pergunta` da operação, a enlatada é **handoff para humano** — ou seja, "não sei" vira encaminhamento, nunca chute.
4. **Validador com veto** (`reply-validator.ts`) permanece para toda geração, nos dois modos.
5. **Preço na operação é trilho crítico** (ADR-0012): pergunta de preço/mensalidade é detectada por regex determinística e forçada ao modo rewrite sobre uma enlatada de handoff comercial — o respond nunca "responde" preço. Barreira tripla: pattern determinístico + proibição explícita no prompt + `checkPrice` do validador. Adicionalmente, FAQs de vendas contendo preço são filtradas do bloco de conhecimento.
6. **Vendas fora de escopo**: o agente de vendas segue 100% rewrite; `respond` com `agentMode="vendas"` degrada defensivamente para rewrite.
7. **Auditoria**: `agent_tool_calls.reply_generation` passa a registrar `generationMode` (`rewrite|respond`) e o `userMessage` truncado; versão do prompt bump para `cv2-1`.
8. **Categoria `pergunta` no agente de operação**: mensagem question-like que não casa com as categorias sociais (`como_funciona`, `small_talk`, `saudacao`, `agradecimento`) deixa de despejar o formulário; enlatada = resposta curta + handoff comercial (`wa.me`) + convite a registrar; geração em modo respond (exceto preço, ver item 5).

## Alternativas consideradas

- **Mapear mais categorias determinísticas** — Descartado: não escala; cada pergunta nova é um deploy; foi exatamente o limite que motivou este ADR.
- **LLM livre sem grounding** — Descartado: reabre alucinação, cotação de preço e promessa de agenda; violaria o espírito da ADR-0020.
- **Base de conhecimento no banco desde já** — Adiado: constante versionada no código (`product-knowledge.ts`) é testável e rastreável pelo prompt-version; a parte editável sem deploy já existe (FAQ). Migrar para banco quando houver volante de aprendizado (`perguntas_sem_resposta`, fase futura).
- **Responder preço na operação com `precoPartida`** — Descartado: mantém a política única da ADR-0012 (preço é conversa de humano); o validador até permitiria o valor correto, mas a decisão de produto é handoff.

## Consequências

### Positivas

- Fim do beco na operação: qualquer pergunta recebe resposta útil ou encaminhamento honesto — sem mapear o infinito.
- "Não sei" vira handoff para humano (a enlatada da categoria `pergunta`), nunca invenção.
- Pior caso continua sendo o bot determinístico (rede de segurança da ADR-0020 preservada).
- Base pronta para estender respond a outros modos (concierge, lembrete) em fases futuras.

### Negativas / trade-offs

- Prompt maior no respond → mais tokens e latência (mitigado: timeout 3s inalterado; abort → enlatada; taxa monitorável no audit por `generationMode`).
- Conhecimento estático no código exige deploy para mudar fatos do produto (mitigado: FAQ do banco cobre a parte dinâmica).
- Risco residual de imprecisão dentro do conhecimento (mitigado: grounding fechado + validador + rollout via `geracao_llm_modo`).

## Referências

- Código: `lib/whatsapp/reply-generator.ts`, `lib/whatsapp/product-knowledge.ts`, `lib/whatsapp/onboarding-agent.ts`, `lib/whatsapp/webhook-handler.ts`
- Prompts espelho: `.codex/prompts/whatsapp-reply-generator.md`, `.codex/prompts/whatsapp-onboarding-agent.md`
- `docs/regras-de-negocio.md` §3.3 e §13.1
- Plano original da camada: `docs/backlog-whatsapp-bot/fase-camada-conversacional.md` (fases CV2/CV6, aqui entregues parcialmente para a operação)
