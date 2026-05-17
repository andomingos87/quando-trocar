# ADR 0011: Não rastrear representante no MVP

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §3.3, §24`

## Contexto

Persona 3.3 do PRD prevê o "Representante Comercial" — pessoa que vende para oficinas. A questão: o sistema precisa rastrear quais leads vieram via representante? Precisa de painel próprio? Comissão calculada?

Modelo comercial do MVP é venda direta (Anderson para oficina, sem revendedores formais). Não há estrutura de canais nos próximos 6 meses.

## Decisão

**Não rastrear representante no MVP.**

Todo lead entra com `origem = landing_page`. Nenhuma coluna adicional, nenhuma tabela `representantes`, nenhum painel de representante.

Se/quando o modelo de canais virar prioridade, reabrir esta decisão.

## Alternativas consideradas

- **Não rastrear** — Escolhido. Coerente com modelo de venda direta.
- **UTM tracking (link único)** — Descartado para o MVP. Pode ser adicionado depois sem custo alto se o modelo mudar.
- **Representante com painel próprio** — Descartado. Custo alto para zero retorno atual.

## Consequências

### Positivas

- Zero código, zero schema, zero painel adicional para construir agora.
- Foco do MVP fica em validar venda direta (B2C oficina).

### Negativas / trade-offs

- Se um representante informal aparecer cedo, comissão precisa ser rastreada fora do sistema (planilha manual).
- Reabrir essa decisão depois é barato: adicionar `origem_detalhe` em `leads_oficina` e capturar UTM na landing é trabalho de ~1 dia.

## Referências

- `docs/product/PRD-whatsapp-bot.md §3.3` (Persona Representante Comercial), §24 (Decisões em Aberto)
