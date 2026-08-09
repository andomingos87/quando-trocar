# Prospec-4 — Google Places: cobertura geográfica e sinais de vitalidade

## Objetivo

Responder o que a Receita Federal não sabe: **essa oficina está viva e tem movimento?**

O cadastro da RFB diz que o CNPJ está ativo. Não diz se a porta abre, se tem cliente, se o
telefone ainda é aquele. Rating, número de avaliações, horários declarados e presença de site
são os sinais que separam "CNPJ ativo" de "oficina funcionando" — e são a maior alavanca de
qualidade do score.

## Dependências

- Prospec-1 (o score precisa existir para os sinais novos entrarem nele).
- Google Maps API key com billing.
- Tabela `prospeccao_tiles` (prevista na §5 do plano técnico, ainda não criada).

## A restrição que molda esta fase

Repetindo o que a §2 do plano técnico decidiu, porque é onde mais se erra:

**Nada de conteúdo do Places vai para coluna persistente.** Nome, telefone, endereço e rating
vivem em `places_cache`, e o cron `prospeccao-expirar-cache-places` limpa em 30 dias. Só
`place_id` é permanente. O que se extrai de forma permanente são os **sinais derivados** —
"tem mais de 50 avaliações", "não tem site" — que são conclusão nossa, não conteúdo deles.

Copiar `places_cache.displayName` para `nome_fantasia` viola o ToS e derruba a API key.

## Tarefas

### Migration

- [ ] `prospeccao_tiles` conforme §5 do plano técnico: `area_id`, `parent_id`, centro, raio,
      `tipo_busca`, `status`, `result_count`, `raio_coberto_m`, `tentativas`.
- [ ] Colunas de sinal derivado em `prospeccao_estabelecimentos`: `sinal_avaliacoes integer`,
      `sinal_nota numeric`, `sinal_tem_site boolean`, `sinal_operacional boolean`,
      `sinais_atualizados_em timestamptz`.

### Grid adaptativo

- [ ] `lib/prospeccao/grid.ts` conforme §4.1: tile que devolve 20 resultados está saturado e
      subdivide em 4; abaixo disso, fechou.
- [ ] Usar `rankPreference: DISTANCE` — com ele, a distância do 20º resultado diz até onde a
      varredura é confiável, e cada chamada produz cobertura verificável em vez de subdivisão
      às cegas. **Nearby Search (New) não tem paginação**; sem esse truque, um tile saturado
      não informa nada.
- [ ] Grid inicial de 2 km cobrindo a bbox do município, descartando centro fora do polígono.
- [ ] Passada por tipo (`car_repair`, `car_wash`, `auto_parts_store`) e por texto ("troca de
      óleo", "auto center", "mecânica diesel" + bairro). **Validar a lista de tipos na doc
      antes de implementar — ela muda.**

### Cliente e custo

- [ ] `lib/prospeccao/places-client.ts` com field mask em dois estágios (§4.3): descoberta
      barata (id, location, displayName, types, businessStatus), detalhe caro só para quem
      passou no filtro.
- [ ] Rate limit e retry com backoff. `tentativas` na tabela evita loop em tile que sempre falha.
- [ ] Registrar contagem de chamadas por SKU em `prospeccao_execucoes.metricas` — sem isso
      ninguém percebe a conta subindo.

### Casamento com a base da RFB

O ponto difícil desta fase: ligar um `place_id` a um CNPJ.

- [ ] Cascata: telefone normalizado (forte) → nome canônico + CEP (médio) → proximidade
      geográfica + similaridade de nome (fraco, vira `suspeita` para revisão humana).
- [ ] Reaproveitar `similaridadeTrigrama` e `canonicalizarNome` de `lib/prospeccao/`.
- [ ] Place sem correspondência na RFB: **registrar apenas `place_id` + sinais derivados**,
      sem cadastro. Pode ser oficina informal — alvo legítimo, mas sem CNPJ não há dado
      persistível.

### Score

- [ ] Nova versão do score (`2026-xx-v2`) incorporando: avaliações ≥ 10 (+10), ≥ 50 (+5),
      nota ≥ 3,8 (+5), sem site (+5, baixa maturidade digital = dor maior), operacional (+10),
      horários declarados (+5).
- [ ] Reprocessar Guarulhos e **comparar a ordenação v1 × v2** — se o topo não mudar, os sinais
      não estavam agregando e o custo da API não se paga.

## Critérios de aceite

- Varredura completa de Guarulhos com contagem de chamadas por SKU e custo estimado.
- Nenhum tile fica `saturado` sem filhos.
- Taxa de casamento RFB↔Places publicada (esperado: a maioria dos que têm telefone).
- `places_cache` populado com `places_cached_at`; nenhuma coluna persistente recebeu conteúdo
  do Places.
- Rodar a função de expiração manualmente limpa o cache e preserva `place_id` e sinais.

## Testes

- `tests/prospeccao-grid.test.ts` — 20 resultados subdivide, 19 fecha, raio coberto calculado
  pelo 20º; tile fora do polígono é descartado.
- `tests/prospeccao-places-match.test.ts` — cascata de casamento; place órfão não vira cadastro.
- `tests/prospeccao-places-cache.test.ts` — **teste de guarda**: nenhum campo de `places_cache`
  é escrito em coluna persistente. É a barreira que protege a API key.
