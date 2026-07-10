# ADR 0019: Representantes comerciais com atribuição e comissão configurável

- **Status**: accepted (supersede a [ADR-0011](./0011-visibilidade-de-representante.md))
- **Data**: 2026-07-09
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/backlog-whatsapp-bot/fase-representantes-comissao.md`, `docs/product/PRD-whatsapp-bot.md §3.3`

## Contexto

A ADR-0011 decidiu não rastrear representante no MVP porque o modelo era venda direta. O modelo mudou: o app será distribuído por uma rede de representantes comerciais em todo o Brasil. Quando um representante oferece o produto a uma oficina, a origem precisa ficar registrada; quando a oficina paga a mensalidade, o representante recebe comissão. A política de comissão (percentual ou valor fixo, duração, base de cálculo) precisa ser configurável pelo painel admin, sem deploy.

O billing existente favorece o desenho: cada mensalidade é uma preferência avulsa do Mercado Pago (ADR-0008/0013) confirmada por webhook, registrada em `pagamentos` com idempotência por `mp_payment_id`. Cada pagamento confirmado é um evento discreto sobre o qual a comissão pode ser calculada.

## Decisão

### Atribuição

1. **Tabela `representantes`** com `codigo` curto e único. Cada representante divulga um link `wa.me` cuja mensagem inicial carrega o código no formato `#REP-<codigo>`.
2. **Captura determinística** (regex, sem LLM — ADR-0001) do código na mensagem inbound de lead: `extractRepresentanteCodigo()` remove o token da mensagem antes de `detectLeadOrigin()` (para não quebrar o match exato da frase-gatilho) e o `upsertLead` resolve o código para `leads_oficina.representante_id` — apenas se o lead ainda não tiver representante e o representante estiver ativo. Código desconhecido/inativo é ignorado silenciosamente.
3. **Propagação na conversão**: `convertLeadToOficina` (bot) e `convert_lead_to_oficina_manual` (admin) copiam `representante_id` do lead para `oficinas.representante_id`. A oficina é a dona da atribuição dali em diante.
4. **Atribuição manual**: admin pode definir/alterar o representante de uma oficina pelo painel, com auditoria (`oficina.update_representante`).

### Comissão

1. **Política configurável em duas camadas** (mesmo padrão de `preco_negociado ?? preco_base`): singleton `configuracoes_comissao` (default global) e override por representante (`representantes.comissao_*`). Campos: `comissao_tipo` (`percentual | fixo`), `comissao_valor`, `comissao_duracao_meses` (null = vitalícia), `comissao_base` (`valor_pago | preco_tabela`; só no global).
2. **Geração no webhook do Mercado Pago**: quando `pagamentos.status` vira `pago` e a oficina tem representante ativo, cria-se uma linha em `comissoes` com **snapshot da regra vigente** (tipo, taxa e base congelados). Idempotente por `comissoes.pagamento_id UNIQUE`. Mudar a configuração depois só afeta comissões futuras.
3. **Não bloqueante**: falha na geração de comissão é logada mas nunca derruba o processamento do pagamento nem a reativação de oficina inadimplente.
4. **Duração**: com `comissao_duracao_meses = N`, só geram comissão os N primeiros pagamentos `pago` da oficina.
5. **Payout manual**: ciclo `prevista → paga` (admin marca ao transferir, individual ou em lote) ou `prevista → cancelada` (estorno/erro). Sem split automático do Mercado Pago no MVP.

## Alternativas consideradas

- **UTM na landing como única atribuição** — Descartado: o funil de entrada é o WhatsApp, não a landing; o código na primeira mensagem cobre o caminho real.
- **Split automático via Mercado Pago Marketplace** — Descartado no MVP: exige onboarding de cada representante na plataforma MP; payout manual via Pix + marcação no painel resolve com custo mínimo.
- **Comissão apenas na primeira mensalidade (one-time)** — Não escolhido como regra fixa: `comissao_duracao_meses` torna isso configuração (1 = one-time, null = vitalícia).
- **Recalcular comissão retroativamente ao mudar a política** — Descartado: snapshot no pagamento evita retrabalho contábil e disputas.

## Consequências

### Positivas

- Atribuição e comissão auditáveis dentro do sistema (fim da planilha manual prevista na ADR-0011).
- Política inteira ajustável pelo painel sem deploy.
- Geração idempotente reaproveita a espinha do billing existente.

### Negativas / trade-offs

- Código do representante é público no link: disputa de atribuição se resolve manualmente pelo admin (risco aceito no MVP).
- `comissao_base = 'preco_tabela'` pode gerar comissão maior que a receita quando há `preco_negociado` abaixo da tabela — a UI exibe aviso ao selecionar.
- Oficinas atribuídas manualmente depois de já pagarem não geram comissão retroativa (só pagamentos posteriores à atribuição).
- Dashboard próprio do representante fica para fase futura (`rep_users` análogo a `admin_users`).

## Referências

- Plano: `docs/backlog-whatsapp-bot/fase-representantes-comissao.md`
- ADR-0008 (Mercado Pago), ADR-0011 (superseded), ADR-0012 (política de preço), ADR-0013 (billing/admin/auditoria)
- `docs/regras-de-negocio.md §18`
