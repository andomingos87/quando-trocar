# Prospec-1 — Score ICP e fila de revisão

## Objetivo

Transformar 5.435 linhas indiferenciadas numa fila ordenada por probabilidade de fechar, para
que o esforço comercial comece pelo topo em vez de pelo acaso da ordem de inserção.

O score é **determinístico e versionado**. Nada de LLM aqui — [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md).

## Dependências

- Base ingerida (feito).
- Decisão pendente: varejo de peças (`4530703`) é ICP? São 1.451 registros. Se a resposta for
  não, mudar para categoria `baixo` em `lib/prospeccao/cnaes.ts` **antes** de calibrar o score.

## Tarefas

### Regra

- [ ] `lib/prospeccao/scoring.ts` — função pura `calcularScoreIcp(estab): ResultadoScore`, com
      `{ score: 0..100, versao: string, motivos: Array<{ sinal, peso }> }`.
- [ ] `SCORE_VERSAO = "2026-08-v1"` exportada. Toda linha pontuada grava a versão que a gerou.
- [ ] Gravar `score_motivos` como JSON — sem isso ninguém consegue responder "por que essa
      oficina está em 12º?" e o score vira caixa-preta que o time deixa de confiar.

### Pesos iniciais

Só sinais que existem **hoje** (fonte RFB). Os de vitalidade entram em Prospec-4.

| Sinal | Peso | Racional |
|---|---|---|
| CNAE principal núcleo (`4520001`, `4520005`) | +30 | É a definição do ICP |
| CNAE principal alto (`4520003`, `4520004`) | +15 | Retorno previsível |
| CNAE principal médio | +5 | Serve, retorno menos regular |
| CNAE secundário núcleo/alto | +5 | Acumula serviço recorrente |
| Telefone móvel | +15 | Único que viabiliza WhatsApp |
| E-mail presente | +5 | Canal alternativo (Prospec-3) |
| Matriz | +5 | Decisão de compra é local |
| Porte micro | +5 | Dono decide, ciclo curto |
| Aberta há 1–15 anos | +10 | Estabelecida mas não estagnada |
| Aberta há < 1 ano | +3 | Ainda instável |
| Sem telefone | −20 | Só abordável por visita |
| CNAE principal baixo (funilaria, borracharia) | −10 | Serviço sem cadência |

Corte: **≥ 60 → `qualificado`**; abaixo → `descartado` com `motivo_descarte = 'score_baixo'`.

Corte alto de propósito no começo: é melhor revisar 400 boas do que 2.000 duvidosas. Quem
revisa é humano, e a paciência dele é o recurso escasso.

> **Estes pesos são chute informado, não ciência.** Ninguém sabe ainda se oficina micro
> converte mais que pequena. A calibração real é Prospec-5, com dado de conversão. Até lá,
> tratar o score como ordenação plausível, não como verdade.

### Execução

- [ ] `scripts/prospeccao/pontuar.ts` + `npm run prospeccao:pontuar -- --cidade Guarulhos --uf SP`.
- [ ] Reprocessável: rodar de novo recalcula tudo e sobrescreve `score_*`.
- [ ] **Não** rebaixar quem já foi revisado por humano: linha com `revisado_em` preenchido
      mantém o `status`; o score é recalculado, mas a decisão humana ganha.
- [ ] Registrar em `prospeccao_execucoes` com `fonte = 'rfb'` e a distribuição no `metricas`.

### Regras

- [ ] Score sempre entre 0 e 100 (clamp).
- [ ] Descartes duros do CNAE (concessionária, situação não-ativa) já aconteceram na ingestão;
      o score não precisa reimplementá-los.
- [ ] Recalcular com versão nova não apaga o histórico da versão anterior — gravar a versão
      junto, para comparar coortes depois.

## Critérios de aceite

- Rodar o script em Guarulhos e publicar a distribuição (histograma por faixa de 10).
- Inspecionar manualmente o top 50 e o bottom 50: o topo "parece oficina boa", o fundo não.
- Um mesmo estabelecimento pontuado duas vezes dá o mesmo score.
- Linha com `revisado_em` não muda de `status` ao reprocessar.

## Testes

- `tests/prospeccao-scoring.test.ts`:
  - cada sinal isolado soma o peso esperado;
  - clamp em 0 e 100;
  - caso-limite exatamente em 60 → `qualificado`;
  - sem telefone e CNAE baixo → bem abaixo do corte;
  - `motivos` explica o total (soma dos pesos = score antes do clamp);
  - reprocessar não altera decisão humana registrada.
