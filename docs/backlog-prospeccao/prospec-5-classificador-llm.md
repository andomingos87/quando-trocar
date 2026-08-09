# Prospec-5 — Classificador por LLM e recalibração do score

## Objetivo

Duas coisas que só fazem sentido depois que houver dado de conversão real:

1. **Classificar o tipo de oficina** a partir do nome — o que regra por palavra-chave erra.
2. **Recalibrar os pesos do score** contra quem de fato fechou, substituindo o chute informado
   do Prospec-1 por evidência.

## Dependências

- Prospec-2 (precisa de leads promovidos).
- Volume mínimo de conversão para a recalibração fazer sentido — abaixo de algumas dezenas de
  leads fechados, qualquer ajuste é ruído. **Não começar por pressa.**

## Parte 1 — Classificador

Nome fantasia é texto livre: "JR Auto Center", "Mecânica do Zé Diesel", "Oficina 24h Reboque
e Guincho", "Troca de Óleo Express". Regra por palavra-chave erra os dois lados — ignora o que
não previu e classifica errado o que previu mal.

### Tarefas

- [ ] `lib/prospeccao/classifier.ts` — OpenAI Responses API com Structured Output, `strict: true`,
      enum fechado: `mecanica_geral | troca_oleo | auto_center | especializada_diesel |
      eletrica | suspensao_freios | pneus_alinhamento | funilaria | auto_pecas | outro`.
- [ ] Entrada: nome fantasia, razão social, CNAE principal e secundários. **Nada de dado
      pessoal além do que já está no cadastro público.**
- [ ] Saída grava `classificacao`, `classificacao_origem = 'llm'` e a confiança.
- [ ] Processar **em lote**, e só sobre quem já passou do corte de score — classificar 5.435
      linhas para depois descartar 4.000 é desperdício.
- [ ] Baixa confiança → deixa `null` e segue. Não chutar.

### Regras

- [ ] **A saída do LLM não muda `status`, não promove lead e não dispara e-mail.**
      [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md) — ele sugere um rótulo, e o
      rótulo entra no score como mais um sinal, nunca como decisão.
- [ ] Classificação humana (`classificacao_origem = 'humano'`) sempre ganha da do LLM.
- [ ] Registrar em `agent_tool_calls` quando afetar estado de negócio.
- [ ] Prompt versionado em `.codex/prompts/` (e espelhado pelo sync de assets).

## Parte 2 — Recalibração do score

O Prospec-1 assumiu que micro converte mais que pequena, que oficina de 1–15 anos é melhor que
recém-aberta, que celular vale mais que e-mail. **Nada disso foi medido.** Aqui se mede.

### Tarefas

- [ ] Consulta de coorte: para cada faixa de score da v1, qual foi a taxa de
      `promovido → qualificado → convertido`.
- [ ] Cruzar cada sinal isolado com conversão: quem tem celular converte mais? Quem não tem
      site converte mais? Micro converte mais?
- [ ] Publicar a tabela antes de mexer em peso nenhum.
- [ ] Nova versão do score com os pesos ajustados, mantendo `score_versao` para comparar
      coortes.
- [ ] Revisar o corte de 60 — se o topo e o meio convertem igual, o corte está no lugar errado.
- [ ] Reavaliar a lista-ponte de CNAEs de `cnaes.ts` com dado real, incluindo a pendência de
      varejo de peças (`4530703`).

### Regras

- [ ] Nunca recalibrar sobre menos de algumas dezenas de conversões — ajustar peso com n=3 é
      superstição com aparência de método.
- [ ] Guardar cada versão de peso no repositório com a data e o dado que a justificou.

## Critérios de aceite

- Amostra de 100 classificações do LLM revisada à mão, com taxa de acerto publicada.
- Nenhuma mudança de `status` originada em saída de LLM (verificado por teste).
- Tabela de conversão por faixa de score publicada.
- Score v3 documentado com a evidência que motivou cada mudança de peso.

## Testes

- `tests/prospeccao-classifier.test.ts` — shape do Structured Output; `null` em baixa
  confiança; classificação humana prevalece; **teste de guarda de que a saída do LLM não altera
  `status`**; rejeição de prompt injection vinda de nome fantasia malicioso (o nome vem de base
  pública, mas é texto livre de terceiro — tratar como entrada não confiável).
