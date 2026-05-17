# ADR 0011: Representante comercial terá visão própria dos leads

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §3.3, §24`

## Contexto

Persona 3.3 do PRD é o "Representante Comercial" — pessoa que vende para oficinas e quer mostrar valor rápido. Pode enviar a landing ou o link do WhatsApp para o dono.

Pergunta: o representante tem visão dos leads que ele indicou? Painel próprio? Comissionamento rastreável?

Hoje o sistema cria `lead_oficina` com `origem = landing_page`. Não há campo para indicar `representante_id` nem fluxo de visualização de leads por representante.

## Decisão

**Pendente — depende do modelo comercial (uso direto pelo dono vs. parceiros revendedores).**

Recomendação inicial: deixar fora do MVP. Adicionar `representante_id` e visão de leads se/quando o modelo de canais se concretizar.

## Alternativas consideradas

- **Sem visão de representante no MVP** — Simplifica. Modelo comercial fica B2C direto. Recomendado para MVP.
- **Representante com painel próprio + tracking de indicação** — Necessário se o modelo for revenda. Adiciona schema (`representantes`, `lead_oficina.representante_id`), fluxo de cadastro de representante, comissão.
- **Tracking básico via UTM na landing** — Atalho — guardar `origem_detalhe` na URL do CTA. Permite rastrear sem painel próprio.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §3.3` (Persona Representante Comercial), §24 (Decisões em Aberto)
