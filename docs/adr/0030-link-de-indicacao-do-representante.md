# ADR 0030: Link de indicação do representante (janela de 30 dias)

- **Status**: accepted (estende a [ADR-0019](./0019-representantes-e-comissao.md))
- **Data**: 2026-08-03
- **Decisores**: Anderson Domingos
- **Fonte**: decisões fechadas com o dono em 2026-08-03, [regras §18.9](../regras-de-negocio.md)

## Contexto

Até aqui o representante só tinha um caminho de divulgação: um link `wa.me` com `#REP-<codigo>` no texto pré-preenchido ([ADR-0019](./0019-representantes-e-comissao.md) §18.2). Isso funciona, mas obriga o rep a mandar o lead direto para o WhatsApp — ele não pode divulgar **o site**, que é onde a oferta é explicada (preço, teste, prova social). Divulgar `quandotrocar.com.br` cru significa perder a atribuição: o lead lê a landing, clica no CTA e chega ao bot sem nenhum código.

Havia também um problema no modelo de atribuição existente: `leads_oficina.representante_id` era gravado uma vez e **nunca** mais mudava. Um lead trazido por um rep 10 meses antes, que nunca evoluiu, ficava travado nele para sempre — se outro rep o retrabalhasse e fechasse, a comissão iria para o primeiro. Não havia data de atribuição no banco para sequer medir isso.

O pedido do dono foi explícito: o rep precisa compartilhar link do site com o código dele, e **o lead que abriu o link dele tem que continuar sendo dele por uma janela determinada, mesmo que abra outro link depois**.

## Decisão

Adicionar um **link de indicação do site** (`/r/<CODIGO>`) que grava um cookie assinado de 30 dias e injeta o código nos CTAs — reaproveitando o motor de atribuição que já existe — e **datar** a atribuição no banco para permitir liberação por inatividade.

1. **Rota `/r/<CODIGO>`** (route handler, sem JS): valida o código (rep ativo, não deletado), registra o clique em `representante_link_cliques` com um `click_token` único e grava o cookie **`qt_ref`**; depois 302 para o destino. Código inválido/inexistente → 302 limpo, sem cookie e sem revelar se o código existe.
2. **`?ref=<CODIGO>` em qualquer URL do site** é normalizado pelo `middleware.ts` para `/r/<CODIGO>?next=<caminho>`. Um único lugar valida, registra e grava — nada de lógica de atribuição espalhada.
3. **Cookie `qt_ref`**: httpOnly, `SameSite=Lax`, HMAC-SHA256 com `REP_SESSION_SECRET`, `Max-Age` 30 dias, e o timestamp **dentro** da assinatura (a validade não depende da boa vontade do navegador). O visitante não consegue forjar indicação.
4. **First-touch sticky dentro da janela**: com cookie válido, o clique no link de **outro** rep **não** sobrescreve — é registrado com `atribuiu = false`. É o que garante o pedido "o lead continua sendo dele mesmo que abra outro link".
5. **Nenhum motor de atribuição novo**: os CTAs acrescentam `#REP-<CODIGO>.<CLICK_TOKEN>` ao texto do `wa.me` e a atribuição segue o caminho já auditado (`extractRepresentanteCodigo` → `upsertLead`). O separador é `.` porque `-` é caractere válido dentro do código do rep. Link antigo sem token continua válido.
6. **Janela de reatribuição no banco**: `representante_atribuido_em`, `representante_atribuido_via` (`wa_prefill` | `site_link` | `manual`) e `representante_click_token`. Lead parado há ≥ 90 dias (`REATRIBUICAO_INATIVIDADE_DIAS`) e que não avançou no funil volta a ser atribuível; `qualificado`, `interessado`, `teste_aceito` e `convertido` **nunca** trocam de dono automaticamente.
7. **Degradação segura**: sem `REP_SESSION_SECRET`, a indicação desliga (clique registrado, cookie não gravado) e a landing pública continua no ar. A leitura do cookie acontece em **toda** visita à home — não pode ser um ponto de falha.
8. **Tela `/representante/meu-link`** no portal: link, copiar, enviar por WhatsApp e contadores. Read-only, escopada pela sessão, como todo o portal ([ADR-0025](./0025-portal-do-representante.md)).

## Alternativas consideradas

- **Last-touch (o último link clicado vence)** — Descartado pelo dono: recompensa quem chega por último e cria disputa entre reps sobre o mesmo lead morno. First-touch com janela é mais previsível para quem prospecta.
- **Cookie legível por JS + link montado no cliente** — Descartado: cookie forjável (o rep, ou qualquer pessoa, escreveria o código de outro) e atribuição dependente de JS. httpOnly + server component elimina os dois problemas.
- **Manter a atribuição permanente (sem janela de reatribuição)** — Descartado: leads frios travados para sempre no primeiro rep é injusto com quem retrabalha e não tinha como ser medido (não havia data no banco).
- **Reatribuição automática também para lead avançado no funil** — Descartado: comissão em jogo não muda de dono por clique. Nesses casos a troca é decisão humana no admin (`via = 'manual'`).
- **Parâmetro `?ref=` lido direto pelos CTAs, sem cookie** — Descartado: morre na primeira navegação interna e some quando o lead volta ao site depois.
- **Identificar o visitante por fingerprint para sobreviver à troca de navegador** — Descartado: ganho marginal e custo alto de privacidade/LGPD. A perda por troca de dispositivo é um limite conhecido e documentado.

## Consequências

### Positivas

- O rep divulga o **site** (onde a oferta convence) sem perder atribuição.
- A regra "o lead é meu por 30 dias" fica garantida em duas camadas independentes (cookie e banco).
- `click_token` liga o lead ao clique exato: dá para medir link → clique → lead → conversão por representante.
- Atribuição passa a ter data e canal — auditável, e a comissão de lead frio deixa de ficar presa para sempre.

### Negativas / riscos

- Atribuição por cookie é por navegador: troca de aparelho, janela anônima ou cookie bloqueado perde a indicação. Documentado na tela do rep para evitar cobrança indevida.
- A home passou a ser `force-dynamic` (o texto do `wa.me` varia por visitante) — perde o cache estático da landing.
- A janela de 90 dias de inatividade é um número escolhido, não medido. Revisar quando houver volume real de leads reatribuídos.

## Fontes

- Código: `app/r/[codigo]/route.ts`, `middleware.ts`, `lib/representante/indicacao.ts`, `lib/representante/indicacao-cliques.ts`, `components/landing-cta.tsx`, `lib/landing-offer.ts`, `lib/whatsapp/repository.ts` (`podeAtribuirRepresentante`), `app/representante/(autenticado)/meu-link/`.
- Migration: `supabase/migrations/20260803140000_indicacao_link_representante.sql`.
- Testes: `tests/representante-indicacao.test.ts`, `tests/whatsapp-representante-atribuicao.test.ts`, `tests/whatsapp-sales-agent.test.ts`, `tests/landing-offer.test.ts`.
