# ADR 0033: Cadência por quilometragem convertida em data estimada

- **Status**: accepted
- **Data**: 2026-08-08
- **Decisores**: Anderson Domingos
- **Fonte**: [`docs/product/pivot-catalogo-de-servicos.md`](../product/pivot-catalogo-de-servicos.md) (decisões 2 e 3 do dono, fechadas em 2026-08-08)

## Contexto

O setor pensa a maioria dos serviços em **km** ("óleo a cada 10 mil", "correia a cada 60 mil"), mas o banco só conhece dias: `lembretes.scheduled_at` é temporal e não existe nenhum campo de quilometragem em `veiculos` ou `servicos`. Enquanto isso, a landing já vende km ("Monitorando km", card com "KM hoje 47.000 · Próxima ~52.000 km") e a extração de imagem já pede odômetro na foto ([`image-vision.ts`](../../lib/whatsapp/image-vision.ts)) — o dado chega e é descartado. Promessa no ar, produto sem o dado.

Não há telemetria: ninguém sabe quantos km o carro do cliente roda por mês. Qualquer lembrete por km é, na prática, uma **estimativa de data**.

## Decisão

**Cadência por km é convertida em data estimada no agendamento; a fila de lembretes continua 100% temporal. A conversão usa uma média mensal de rodagem por veículo, auto-aprendida a partir do histórico, com default por oficina e limites sanitários. Novo km observado recalcula os lembretes pendentes do veículo.**

1. **Modelo de dados**: `veiculos.km_atual`, `veiculos.km_atualizado_em`, `veiculos.km_medio_mes` (aprendido; null = default); `servicos.km_servico`; `lembretes.base_calculo` (`tempo|km`) e `lembretes.km_alvo`; `oficinas.km_medio_mes_padrao` (default 1000).
2. **Conversão**: `dias = intervalo_km / (km_medio_mes / 30)`, aplicada no RPC de agendamento. `km_alvo = km_servico + intervalo_km` fica gravado para exibição e recálculo.
3. **Auto-aprendizado**: a partir do 2º serviço do mesmo veículo com km informado, `km_medio_mes = Δkm / Δmeses` entre serviços, com piso/teto sanitário (300–5.000 km/mês). Cálculo determinístico no backend — o LLM só extrai o número do texto/áudio/foto (ADR-0001).
4. **Recálculo**: todo km novo observado (texto, áudio, foto de painel) atualiza `veiculos.km_atual` e reagenda os lembretes `pendentes` daquele veículo cuja `base_calculo = 'km'`. Lembretes já enfileirados/enviados não são tocados.
5. **Copy**: a oficina vê **a data e o km alvo** ("Próxima: ~52.000 km · 14/03/2027") — coerente com a regra existente de informar a data exata do agendamento (`regras-de-negocio.md §4.1`, lição do QTR-35 P0-3). Ao cliente final o lembrete não promete km, só o serviço.
6. **Item `base = 'ambos'`**: agenda pelo que vencer **primeiro** (menor data entre a temporal e a estimada por km) — comportamento padrão de manual de fabricante ("10.000 km ou 12 meses, o que ocorrer primeiro").

## Alternativas consideradas

- **Só cadência temporal (status quo)** — Descartado. Contradiz como o setor fala e o que a landing promete; para serviço de km (correia, pneu) a data fixa é chute sem correção.
- **Perguntar km ao cliente final periodicamente** — Descartado no MVP. Gera mensagem extra fora de contexto (fadiga + custo de template); o km observado nos próprios cadastros e fotos já corrige a média.
- **Não estimar: só agendar por km quando o cliente informar rodagem** — Descartado. Significa não agendar na prática; a estimativa com default + auto-aprendizado degrada suavemente.
- **Fila própria por km (scheduler dedicado)** — Descartado. Sem telemetria não há evento de km; converter para data reusa todo o pipeline temporal existente (enqueue, worker, retry, espaçamento).

## Consequências

### Positivas

- Fecha a promessa da landing com dado real; a conversa do bot pode confirmar "monitorando km" de verdade.
- Zero mudança no pipeline de envio — enqueue/worker/retry intactos.
- A estimativa melhora sozinha com o uso (cada cadastro com km refina a média).

### Negativas / trade-offs

- A data estimada pode errar feio para veículos atípicos até o 2º serviço (mitigado: piso/teto, default por oficina, recálculo contínuo).
- Mais uma pergunta possível no fluxo de cadastro (km atual) — opcional, nunca bloqueante.
- `km_medio_mes` é por veículo, não por par veículo×uso (um carro que muda de perfil de uso demora a convergir).

## Referências

- [ADR-0031](./0031-catalogo-aberto-servicos-produtos.md) — o catálogo define `base` e `intervalo_km` por item.
- [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) — extração de km é sugestão; cálculo e reagendamento são determinísticos.
- `lib/whatsapp/image-vision.ts` (odômetro), `components/como-funciona.tsx` / `lib/chat-scripts.ts` (promessa na landing).
- Plano de execução: [`docs/backlog-catalogo-servicos/README.md`](../backlog-catalogo-servicos/README.md) (fase F3).
