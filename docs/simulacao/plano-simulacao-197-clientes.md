# Plano · Simulação "197 clientes pagantes, 6 meses de história"

> Status: **executado em 2026-09-26** no projeto `quando-trocar-simulacao` (`fplkasckmvvccnkrkszr`).
> Decisões do §9 tomadas pelo Anderson: projeto separado; teste expirado = `cancelada` + observação;
> retorno = segundo serviço; ads/prospecção/reps fictícios; volume completo; copy real por template.
> Operação: [`docs/runbooks/simulacao-dados.md`](../runbooks/simulacao-dados.md). Código: `scripts/db/simulacao/`.
> Objetivo: um banco com a foto de hoje = 197 oficinas pagando, com 6 meses de movimentação
> realista atrás (lead → conversa → teste → pagamento → churn / inadimplência / retorno de
> cliente final), para que todas as telas do admin, o portal do representante e as métricas
> mostrem o produto "como se estivesse rodando".

Premissa assumida: o pedido é **dados** (seed realista), não rodar os agentes de verdade contra a
Meta/OpenAI. O bot não é chamado; o que se grava é o rastro que ele deixaria (mensagens, tool
calls, transições) seguindo as regras de `docs/regras-de-negocio.md`.

---

## 0. O que existe hoje e o que isso muda no plano

| Fato verificado | Consequência |
|---|---|
| **Um único projeto Supabase** (teste = prod). Hoje tem 5 leads, 3 oficinas, 7 representantes, 5.435 estabelecimentos de prospecção, 75 dias de `ad_insights_daily` reais. | A simulação **não pode rodar nesse banco**: contaminaria MRR, comissão, analytics de ads e a carteira dos representantes reais. Ver §5. |
| `pg_cron` de follow-up e de sync de ads existem por migration; o scheduler de lembretes e o billing são rotas internas (`/api/internal/*`) acionadas por fora. | Em ambiente isolado os crons não têm URL/segredo no Vault e viram no-op. Ainda assim, nenhum lembrete simulado pode ficar `pendente` com `scheduled_at` no passado (§6). |
| **Não existe tabela `retornos`.** A métrica `retornos_concluidos` do detalhe da oficina conta `lembretes.status = 'agendado'`, status removido pela ADR-0009. | "Cliente voltou" precisa ser representado como **segundo serviço do mesmo cliente após o lembrete** (§4.6). A métrica atual vai mostrar 0 — é bug legado, fora do escopo, mas sinalizado. |
| Regra 9.0: teste de 14 dias sem cartão; sem pagamento "fica pausado e volta pra `vendas`" — **a automação não existe** e não há `motivo_pausa` para isso. | Precisa de decisão de como representar "teste expirou sem pagar" (§9). |
| `oficinas.plano ∈ {teste, pago, interno}`, `status ∈ {ativa, pausada, cancelada}`, `motivo_pausa ∈ {inadimplencia, voluntaria, admin}`. | "Pagante hoje" = `status = 'ativa' and plano = 'pago'`. MRR do admin soma `coalesce(preco_negociado, planos.preco_base)` de todas as `ativa` — inclui as em teste (preço 59 no seed). |
| `planos.preco_base` no banco está em **60**, não 59 (ADR-0012 diz 59). | Ambiente isolado nasce das migrations (59). Conferir antes de validar MRR. |
| Harness de conversa (`tests/harness/whatsapp`) roda o webhook real em memória, sem OpenAI, com personas e evals com o copy real do bot. | Fonte de texto realista para as conversas simuladas sem gastar token (§4.2). |
| `prospeccao_estabelecimentos` tem 5.435 oficinas reais (RFB) com nome fantasia, cidade e UF. | Pool de **nomes e cidades** realistas. Telefones **nunca** (§6). |

---

## 1. A foto de hoje (alvo)

"Hoje" = 2026-09-26. Janela histórica: 2026-03-27 → 2026-09-26, seis coortes mensais
(Abr, Mai, Jun, Jul, Ago, Set-parcial).

### 1.1 Oficinas

| Estado | Qtd | Como fica no schema |
|---|---:|---|
| **Pagante ativa** | **197** | `status='ativa'`, `plano='pago'`, `proximo_vencimento` futuro, ≥1 `pagamentos.pago` |
| Em teste (14 dias correndo) | 34 | `status='ativa'`, `plano='teste'`, criada entre 13/09 e 26/09, `proximo_vencimento` null |
| Pausada por inadimplência | 9 | `status='pausada'`, `motivo_pausa='inadimplencia'`, pagamento `pendente` vencido há ≥ 7 dias |
| Pausada voluntária | 3 | `status='pausada'`, `motivo_pausa='voluntaria'` |
| Cancelada (churn de pagante) | 15 | `status='cancelada'`, teve ≥1 pagamento pago |
| Teste expirado sem pagar | 110 | **decisão pendente** (§9.2); proposta: `status='cancelada'` + `observacao='teste expirado sem conversão'` |
| Interna (demo) | 1 | `plano='interno'` — a "Auto Center Silva" da landing |
| **Total** | **369** | |

Pagantes históricas (converteram para `pago` em algum momento): 197 + 9 + 3 + 15 = **224**.

### 1.2 Funil por coorte (mês de criação do lead)

Taxas usadas: lead → teste 32%; teste decidido → pago 67% (o restante expira); churn
acumulado de pagantes ~12% (cancelada + inadimplência + voluntária).

| Coorte | Leads | Testes (32%) | Testes decididos | Viraram pago (67%) | Cancel. | Inad. | Vol. | **Pagante hoje** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Abr | 100 | 32 | 32 | 21 | 4 | 1 | 1 | **15** |
| Mai | 140 | 45 | 45 | 30 | 4 | 2 | 0 | **24** |
| Jun | 180 | 58 | 58 | 39 | 4 | 2 | 1 | **32** |
| Jul | 220 | 70 | 70 | 47 | 2 | 2 | 1 | **42** |
| Ago | 260 | 83 | 83 | 56 | 1 | 2 | 0 | **53** |
| Set (1–26) | 250 | 80 | 46 (34 ainda em teste) | 31 | 0 | 0 | 0 | **31** |
| **Total** | **1.150** | **368** | **334** | **224** | **15** | **9** | **3** | **197** |

A curva sobe mês a mês (100 → 260 leads) porque é o que uma operação com anúncio + representantes
ligados mostra; setembro cai um pouco por ser parcial. Nada de crescimento linear perfeito: cada
coorte recebe jitter de ±8% no gerador.

### 1.3 Leads (1.150)

| Status final | Qtd | Regra de consistência |
|---|---:|---|
| `convertido` | 368 | `converted_at`, `oficina_id`, `nome_oficina` preenchidos |
| `perdido` | 380 | `motivo_perda` de uma lista fechada; ~70% viraram perdidos por `sem_interesse` explícito, ~30% por admin (`lead.marcar_perdido` na auditoria) |
| `em_conversa` | 200 | `followup_count` = 2 nos antigos, 0–1 nos de setembro |
| `qualificado` | 95 | `volume_trocas_mes` + `ticket_medio` preenchidos, tool call `calculate_roi` |
| `interessado` | 40 | `interesse_declarado_at` |
| `novo` | 60 | uma única mensagem inbound sem resposta útil (bot respondeu saudação) |
| `teste_aceito` | 7 | contexto `sales.awaiting_workshop_name = true`, sem oficina |

Origem: 60% `landing_page` (frase-gatilho), 40% `manual_whatsapp`. Canal de aquisição
(exclusivo, o gerador sorteia um ou nenhum): ~35% com `ad_id` (first-touch, §4.9), ~30% com
`representante_id` (`wa_prefill` ou `site_link` + `click_token`), ~35% orgânico/indicação.

### 1.4 Operação (clientes finais, serviços, lembretes)

Por oficina: `volume_trocas_mes` sorteado em 30–150 (mediana 60); **taxa de cadastro** 25–45%
dos serviços (oficina não cadastra tudo); cadastros concentrados nos primeiros 20 dias após a
conversão e depois estáveis. Oficinas que expiraram o teste cadastram 3–8 serviços e param.

| Entidade | Qtd aprox. | Observações |
|---|---:|---|
| `clientes_finais` | ~11.500 | 92% `consentimento_whatsapp = true`; 3% `opt_out`; 1,5% `numero_errado` (resultado de resposta ao lembrete) |
| `veiculos` | ~12.000 | 1,05 por cliente; descrições reais ("Onix 2019", "HB20 2020", "Strada 2016") |
| `servicos` | ~14.200 | família: 78% `troca_oleo`, 12% `revisao`, 7% `amortecedor` (com `marca_peca`/`produto_id`: Perfect 45%, Cofap 25%, Monroe 15%, Nakata 10%, outra 5%), 3% `outro`; `catalogo_id` = item global padrão da família; `valor` por família (óleo R$ 150–320, revisão R$ 350–900, amortecedor R$ 600–1.400) |
| `lembretes` | ~13.000 | 1 por serviço com consentimento; `scheduled_at = data_servico + cadência do tipo` (90/180/730) |
| Lembretes já vencidos (troca de óleo de Abr–Jun) | ~2.300 | ver §4.5 para distribuição de status |
| Lembretes futuros | ~10.700 | `pendente`, `scheduled_at > hoje` — os únicos `pendente` permitidos |
| "Retornos" | ~400 | segundo `servicos` do mesmo cliente 10–40 dias após lembrete `enviado`/`respondido`/`handoff_iniciado` |

### 1.5 Billing

| Entidade | Qtd aprox. | Regra |
|---|---:|---|
| `pagamentos.pago` | ~470 | 1 por ciclo mensal desde a conversão; `paid_at` entre D-3 e D+2 do `vencimento` (cauda até D+6) |
| `pagamentos.falhou` → nova tentativa paga | ~30 | `tentativa = 2`, mesmo `vencimento` |
| `pagamentos.pendente` (ciclo corrente, D-3) | ~20 | oficinas com vencimento entre 27/09 e 29/09 |
| `pagamentos.pendente` vencido (inadimplentes) | 9 | vencido há 8–25 dias; oficina pausada |
| `pagamentos.cancelado` | ~15 | ciclo em aberto das canceladas |
| `comissoes` | ~190 | só pagamentos `pago` de oficinas com `representante_id`; snapshot 20% `valor_pago`; ~60% `paga`, 40% `prevista` (mês corrente) |
| `cobranca_jobs` | ~180 | 1 linha por dia de `cobranca_proxima` + 1 de `auto_pausa_inadimplencia`, com contadores coerentes |

Preço efetivo: 80% tabela (59), 15% `preco_negociado = 49`, 5% `= 39` → **MRR ≈ R$ 11.300**
(197 × ~57,5) + 34 em teste × 59 = R$ 2.000 que o card do admin **também soma** (regra 11.3).
Receita recebida em setembro ≈ R$ 9.000.

### 1.6 Conversas, mensagens e auditoria

| Entidade | Qtd aprox. |
|---|---:|
| `conversas` | ~1.900 (1 por lead em `vendas`; a mesma linha migra para `onboarding`/`operacao` na conversão; +1 por cliente final que respondeu lembrete, em `cliente_final_lembrete`) |
| `mensagens` | ~57.000 (vendas ~8k, onboarding/operação ~45k, lembretes+respostas ~3,5k, cobrança ~300) |
| `outbound_messages` | ~30.000 (todo outbound do bot; lembretes com `message_kind='template'`, `template_name`, `template_params`) |
| `agent_tool_calls` | ~19.000 (`register_service`, `update_lead`, `calculate_roi`, `faq_lookup`, `capture_workshop_name`, `reply_generation` amostrado, `handoff_summary`) |
| `whatsapp_events` | 1 por inbound (~25k) com payload mínimo plausível e `processed_at` |
| `admin_audit_log` | ~1.200 (conversões manuais, pausas, cancelamentos, `pagamento.webhook_confirmado`, `comissao.marcar_paga`, edições de preço) |

Se ~57k mensagens pesar na hora de navegar (`/admin/mensagens`), existe o modo **compacto**
(§9.6): vendas completo + operação amostrada em 30% das oficinas.

---

## 2. Regras que a simulação obedece (as que não podem ser violadas)

1. **Estado nunca contradiz regra determinística.** Toda transição de `leads_oficina.status`
   segue a tabela da regra 1.2; toda oficina pagante tem `converted_at + 14 dias ≤ primeiro
   pagamento`; toda conversa de oficina com ≥1 serviço está em `operacao`, com 0 em `onboarding`.
2. **Lembrete só existe com consentimento** e só é `enviado` se, na data de envio, oficina
   estava `ativa`, cliente `ativo`, dentro da janela `08:00–18:00` do fuso da oficina.
3. **Oficina pausada por inadimplência não envia lembrete** a partir da data da pausa. No
   produto real esses lembretes ficariam `pendente` e sairiam na reativação; na simulação isso
   deixaria `pendente` no passado (guardrail 3 do §6). Solução: ficam `cancelado` com
   `last_error = 'simulacao: oficina pausada'`; se a oficina regularizou, os lembretes
   posteriores à reativação seguem normais.
4. **Receita de retorno só com serviço registrado** (regra 6.2): `ja_fez_servico` sozinho não
   gera segundo serviço.
5. **Comissão só após atribuição e só em `pago`** (18.3/18.5), idempotente por `pagamento_id`.
6. **Idempotência de provider IDs**: `whatsapp_message_id` = `wamid.SIM.<run>.<seq>`,
   `gateway_payment_id` = `sim_pay_<seq>`, `provider_event_id` = `sim_evt_<seq>` — únicos por
   construção.
7. **LGPD**: nenhum telefone, CPF/CNPJ ou e-mail real. CPF/CNPJ gerados com dígito verificador
   válido a partir de raízes fictícias.

---

## 3. Linha do tempo de uma oficina simulada (o "roteiro" que o gerador segue)

```
D0        lead chega (landing/ad/rep/manual) → conversa vendas, 3–14 mensagens
D0..D5    intents: pergunta_funcionamento → (informa_volume_ticket → ROI) → pergunta_preco →
          quer_testar → captura nome → convertToOficina
D0..D5    oficina criada (plano teste, ativa) · conversa vira onboarding · boas-vindas
D+1..D+3  primeiro cadastro (card → "confirmar") · register_service · conversa vira operacao
D+3..D+14 mais 4–12 cadastros (teste "de verdade")
D+14      decisão: 67% pagam
            ├─ pago: plano='pago', proximo_vencimento=D+14, pagamento pendente gerado D+11,
            │        pago entre D+12 e D+16 → comissão se tiver rep
            └─ expira: para de cadastrar; status conforme §9.2
mensal    ciclo: pagamento D-3 pendente → pago (95%) / falhou→pago (4%) / não paga (1%)
                 └─ não paga: D+7 auto-pausa inadimplência (cobranca-agent) → 60% regulariza
                    em ≤ 20 dias (reativa) · 40% segue pausada (são as 9 de hoje) ou cancela
D+90      lembretes de troca de óleo dos primeiros cadastros começam a sair
          35% respondem → intents da regra 5.1 → handoff / respondido / opt_out
          ~20% dos lembretes enviados geram novo serviço 10–40 dias depois ("voltou")
churn     canceladas: 2–4 meses depois de pagar, com admin_audit `oficina.update_status`
```

Sazonalidade e horário: mensagens de lead entre 8h e 21h, pico 10–12h e 17–19h, 85% em dias
úteis, sábado de manhã 12%, domingo 3%. Cadastros da oficina caem no fim do expediente
(16–19h). Pagamentos concentram em dia útil. Lembretes saem dentro da janela da oficina.

---

## 4. Modelo por domínio — o que o gerador escreve

### 4.1 Identidades

- **Nomes/cidades de oficina**: sorteados de `prospeccao_estabelecimentos` (nome fantasia
  limpo + cidade/UF; distribuição real de cidades). Fallback: gerador de padrão
  ("Auto Center <sobrenome>", "Mecânica <bairro>", "<nome> Lubrificantes").
- **Responsável**: nome + sobrenome de listas brasileiras.
- **WhatsApp**: `+5500 9 XXXX XXXX` para leads/oficinas e `+5501 9…` / `+5502 9…` para
  clientes finais. DDD 00/01/02 não existem no Brasil: passa no check E.164 do banco, nunca
  alcança ninguém e serve de **chave de purge** (§7).
- **Clientes finais**: nome próprio + veículo de uma lista de ~60 modelos populares com ano
  2010–2025.

### 4.2 Conversas de vendas (texto realista sem LLM)

Fonte do texto: **copy real do bot** extraído de `tests/whatsapp-agent-evals/sales.json`,
`scripts/whatsapp/personas.ts` e das constantes de `lib/whatsapp/sales-agent.ts` (saudação,
FAQ, ROI, preço "a partir de", captura de nome, handoff). Lado do lead: banco de ~120 falas
por intent (variações regionais, erro de digitação, áudio transcrito).

Doze **roteiros** (mistura por probabilidade), cada um com a sequência de intents e o status
final coerente com a regra 1.2:

| Roteiro | Peso | Termina em |
|---|---:|---|
| direto-ao-teste (2–4 turnos) | 18% | convertido |
| pergunta-tudo-e-testa | 14% | convertido |
| roi-convence | 10% | convertido |
| preço-insistente → handoff → converte manual | 4% | convertido (admin) |
| cético-preço → perdido | 12% | perdido |
| sem-interesse explícito | 10% | perdido |
| esfriou-após-explicação (+2 follow-ups) | 14% | em_conversa |
| qualificou-e-sumiu | 8% | qualificado |
| interessado-vai-pensar | 4% | interessado |
| só-oi | 4% | novo |
| social-test/loop → fallback 7 → handoff | 1% | em_conversa (handoff) |
| aceitou-mas-não-deu-nome | 1% | teste_aceito |

Cada turno grava `whatsapp_events` (inbound), `mensagens` (in/out), `outbound_messages`
(out), e `agent_tool_calls` quando a regra manda (`update_lead` com status anterior/novo,
`calculate_roi`, `faq_lookup`, `capture_workshop_name`, `handoff_summary`). `conversas.context.sales`
fica coerente (`greeted`, `price_mentions`, `consecutive_fallback`, `workshop_name`).

Upgrade opcional (§9.7): em vez de templates, **rodar cada roteiro no harness** (`--openai off`)
e despejar o snapshot em SQL — fidelidade máxima ao bot atual, custo zero, mais um mapeador.

### 4.3 Conversão e oficina

Espelha `convertLeadToOficina`: cria `oficinas` (`origem='landing_whatsapp'` ou `'manual'`
quando via admin), copia `representante_id`, `nome` do `nome_oficina`, `ticket_medio`/`volume`
quando o lead informou, `plano_id` do plano único, `dias_lembrete_padrao=90`. Lead vira
`convertido`. Conversa vira `oficina_cliente`/`onboarding` e recebe a boas-vindas com o nome.

### 4.4 Onboarding e operação

Primeiro cadastro em `onboarding` com o card de confirmação (regra 3.4: card → "confirmar" →
`register_service`), depois a conversa vai para `operacao`. Cada cadastro subsequente: 1 inbound
(texto livre no formato real: "João 11 9 8765-4321 Onix 2019 troca de óleo hoje 180"), 1 card,
1 "confirmar", 1 confirmação com a **data do lembrete** (`dd/mm/aaaa`) e tool call
`register_service` com input/output no formato do RPC. 6% dos cadastros têm uma correção
("corrigir" → campo → novo card). 10% das oficinas usam áudio (`media_type='audio'`,
`transcription` preenchida). Alguns `/ajuda` e consultas read-only (regra 3.3-bis).

Para não chamar o RPC 14 mil vezes com clock falso, o gerador **insere direto** em
`clientes_finais/veiculos/servicos/lembretes` replicando a lógica do RPC (upsert por
`(oficina_id, whatsapp)`, veículo por descrição, cadência por família, `catalogo_id`,
`produto_id`), e valida no fim com o mesmo teste que compara com `tipos_servico_default`.

### 4.5 Lembretes vencidos e resposta do cliente final

Para cada lembrete com `scheduled_at ≤ hoje` (≈2.300, quase todos troca de óleo de Abr–Jun):

| Status final | % | O que mais grava |
|---|---:|---|
| `enviado` | 52% | `sent_at` na janela da oficina, `outbound_messages` template `lembrete_troca_oleo` com `template_params [cliente, oficina, veículo]`, `provider_status='delivered'` (70%) / `'read'` (30%) |
| `respondido` (`ja_fez_servico`) | 8% | conversa `cliente_final_lembrete` + 2 mensagens |
| `handoff_iniciado` (`quer_agendar`/`reagendar`/`preco`/`horario`/`indefinida`) | 16% | idem + `handoff_required`, `handoff_reason`, 2 `wa.me` |
| `sem_resposta` (`nao_tem_interesse`) | 5% | idem |
| opt-out / número errado | 5% | cliente muda de status, lembretes futuros dele `cancelado` |
| `cancelado` | 6% | oficina pausada/cancelada antes da data, ou cliente já em opt-out |
| `erro_envio` | 3% | `attempts=4`, `provider_error_code` 131026/131047, outbound `failed` |
| `enfileirado` | 5% | só os de **hoje** dentro da janela (realismo de "está saindo agora") |

### 4.6 Retorno ("cliente voltou")

Sem tabela `retornos`, o retorno é um **novo `servicos`** do mesmo cliente/veículo 10–40 dias
após um lembrete `enviado`/`respondido`/`handoff_iniciado`, com `valor` e novo lembrete
futuro. Cadastrado via WhatsApp como qualquer outro. ~20% dos lembretes enviados; taxa maior
(30%) quando houve `quer_agendar`. Isso é o que a **inteligência de mercado** e a receita por
oficina enxergam; o card `retornos_concluidos` continua 0 até a métrica ser corrigida (§9.3).

### 4.7 Billing, inadimplência e churn

Espelha `gerarCobrancaProxima` + `processPaymentWebhook`:

- `pagamentos` com `gateway='asaas'` (provedor ativo do produto), `gateway_charge_id`,
  `gateway_payment_id`, `payment_url` fictícia, `external_reference =
  'oficina:<id>|venc:<data>|t:<n>'`, `descricao='Mensalidade <venc>'`.
- Cada `pago` avança `proximo_vencimento` em 1 mês (como `avancarVencimentoMensal`) e gera
  `admin_audit_log` `pagamento.webhook_confirmado` (admin_id null = "Sistema").
- Inadimplência: pendente vencido + 7 dias → `status='pausada'`, `motivo_pausa='inadimplencia'`,
  linha em `cobranca_jobs` (`auto_pausa_inadimplencia`, `pausas_aplicadas`), 2–4 mensagens do
  `cobranca-agent` (submode `cobranca_inadimplente`) quando a oficina tentou cadastrar pausada.
  60% regularizam (novo `pago`, volta a `ativa`, lembretes seguem).
- Cancelamento: 15 oficinas com `admin_audit_log` `oficina.update_status` (payload
  antes/depois) e o pendente em aberto `cancelado`.
- `oficinas.cpf_cnpj` e `asaas_customer_id` (`cus_sim_…`) só nas pagantes (pré-requisito ASAAS).

### 4.8 Representantes e comissão

4 representantes fictícios (`SIM-CARLOS`, `SIM-RENATA`, `SIM-JORGE`, `SIM-PAULA`), com
carteiras desiguais (um forte, dois médios, um parado — realismo de "aprovam e não executam").
`representante_link_cliques` para os leads via `site_link` (cookie/click_token). Comissões
conforme §1.5; `comissao.marcar_paga` na auditoria nos meses fechados.

### 4.9 Anúncios (opcional, §9.4)

Se o ambiente isolado receber cópia de `ad_insights_daily` (não tem PII), ~35% dos leads
recebem `ad_id`/`ad_headline`/`ad_ctwa_clid` de anúncios com gasto no dia do lead, para
`/admin/analytics-ads` calcular custo por lead e CAC.

### 4.10 Perguntas sem resposta e volante de intenção

~80 `perguntas_sem_resposta` (`aberta` 50, `resolvida` 20 ligadas a FAQs, `ignorada` 10) e
~60 `divergencias_intencao_vendas`, para as telas de melhoria contínua não ficarem vazias.

---

## 5. Onde rodar (a decisão mais importante)

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **A. Supabase local** (`supabase init` + `supabase start`, Docker) | Custo zero, reset em segundos, iteração rápida do gerador, `npm run dev` já mostra o admin | Ninguém além do Anderson vê; precisa de `supabase/config.toml` (não existe hoje) | **Usar para construir e validar** |
| **B. Projeto Supabase separado** ("quando-trocar-sim") + preview no Vercel com env próprio | Sócios/representantes abrem o admin "cheio" no celular; estável para demo e vendas | Um projeto a mais para manter; migrations aplicadas por `supabase db push` | **Usar para hospedar a simulação** |
| C. Branch Supabase (preview branch) | Nasce das migrations, isolado | Custo por hora, some se apagar; não é feito para durar meses | Não |
| D. Rodar no projeto atual (prod) | Zero setup | Contamina MRR, comissões, carteira dos 7 reps reais, analytics de ads; risco de cron real tentar mandar WhatsApp para os dados falsos | **Não, nem com prefixo de purge** |

Na opção B, `.env` do preview **sem** `WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY`, `ASAAS_API_KEY`
e `INTERNAL_JOB_SECRET`: mesmo que alguém chame uma rota interna, nada sai.

---

## 6. Guardrails do gerador

1. **Recusa a rodar** se `SUPABASE_URL` for o projeto de produção (lista fixa de refs
   proibidas no script) ou se o banco já tiver ≥1 oficina sem o prefixo `+5500`.
2. **Só números `+5500/+5501/+5502`.** Assert no fim: zero linhas fora do prefixo.
3. **Nenhum `lembretes.pendente` ou `outbound_messages.pending/retry_scheduled` com data no
   passado.** Assert no fim. Impede que um scheduler ligado por engano dispare 2 mil templates.
4. **Nenhum `pagamentos.pendente` que o cron de cobrança recriaria** (mesmo `vencimento` já com
   pendente → o cron reutiliza; ok).
5. **Determinístico**: PRNG com seed (`--seed 197`), mesmo manifesto → mesmo banco. Cada linha
   carrega `sim_run_id` onde há jsonb (`metadata`, `context`, `raw_payload`, `payload`).
6. **Idempotente e reversível**: `purge` apaga por prefixo de telefone em cascata (FKs já são
   `on delete cascade` nas tabelas operacionais; `pagamentos`/`comissoes`/`admin_audit_log`
   apagam por `oficina_id`/`payload->>'sim_run_id'`).
7. **Valida contra o schema real**: antes de inserir, lê os `check constraints` de status/enum
   do banco e falha se o manifesto usar valor inexistente (proteção contra drift de migration).

---

## 7. Entregável técnico

```
scripts/db/simulacao/
  manifesto.json          # todas as taxas, coortes, pesos de roteiro, preços, seeds
  gerar.ts                # npm run sim:gerar -- --seed 197 --ate 2026-09-26 [--compacto]
  verificar.ts            # npm run sim:verificar → imprime a "foto" e compara com o alvo
  purgar.ts               # npm run sim:purgar → apaga tudo com prefixo +5500/01/02
  lib/
    prng.ts               # mulberry32 + helpers (pesos, jitter, datas úteis, horário)
    calendario.ts         # coortes, dias úteis, janelas de envio por fuso
    identidades.ts        # pool de nomes (prospecção), veículos, clientes, telefones fictícios
    roteiros-vendas.ts    # 12 roteiros + banco de falas + copy real do bot
    operacao.ts           # cadastros, cards, correções, áudio, /ajuda
    lembretes.ts          # vencimento, envio, respostas, opt-out, retorno
    billing.ts            # ciclos, falhas, inadimplência, pausa, cancelamento, comissão
    escrita.ts            # inserts em lote (500 linhas), ordem por FK, transação por oficina
docs/runbooks/simulacao-dados.md   # como subir o ambiente, gerar, verificar, purgar
```

Inserção via `supabase-js` com service role em lotes (bulk insert), ordem: representantes →
leads → conversas → oficinas → clientes/veículos/serviços/lembretes → mensagens/outbound/
events/tool_calls → pagamentos/comissões/cobranca_jobs → auditoria. Tempo estimado de
geração: < 3 min local.

`verificar.ts` imprime a tabela abaixo e sai com erro se algum alvo desviar > 3%:

```
oficinas ativa+pago ....... 197  (alvo 197)
oficinas teste ............  34
pausadas inad/vol ......... 9/3
canceladas ................ 125 (15 churn + 110 teste expirado)
leads por status .......... convertido 368 · perdido 380 · …
MRR (regra 11.3) .......... R$ 13.3xx  (pagantes R$ 11.3xx + teste R$ 2.0xx)
pagamentos pago/pend/falh . 470/29/30
comissões prevista/paga ... 76/114
serviços / lembretes ...... 14.2k / 13.0k  (pendente no passado: 0 ✔)
lembretes vencidos ........ enviado 52% · handoff 16% · …
retornos (2º serviço) ..... ~400
números fora do prefixo ... 0 ✔
```

---

## 8. Fases de execução

| Fase | Entrega | Critério de aceite | Esforço |
|---|---|---|---|
| **F0 — decisões e ambiente** | Respostas do §9; `supabase/config.toml`; `supabase start`; migrations aplicadas; admin local logando com `ADMIN_OTP_DEV_BYPASS_CODE` | Admin abre vazio no local | ½ dia |
| **F1 — esqueleto + vendas** | manifesto, PRNG, calendário, identidades, 12 roteiros, leads + conversas + mensagens + tool calls | `verificar` bate leads por status; `/admin/leads` e `/admin/mensagens` navegáveis e verossímeis | 1 dia |
| **F2 — conversão + billing** | oficinas, ciclo de teste, pagamentos, inadimplência, pausas, cancelamentos, reps, comissões, auditoria | 197 pagantes; MRR e cards do `/admin` batem; `/admin/comissoes` e portal do rep coerentes | 1 dia |
| **F3 — operação + lembretes + retorno** | clientes, veículos, serviços, lembretes, envios, respostas, opt-out, retornos, catálogo/produto | Guardrail 3 verde; `/admin/lembretes`, `/admin/clientes`, `/admin/inteligencia-mercado` com dados | 1 dia |
| **F4 — verificação e ajuste fino** | `verificar.ts` completo; passar por todas as telas do admin e do portal do rep; ajustar taxas que "parecem falsas" | Checklist de telas 100%; testes `npm test` e `npm run lint` verdes | ½ dia |
| **F5 — hospedar + documentar** | projeto Supabase separado + preview Vercel; runbook; nota no módulo `database` do `.context/`; entrada no `CONTEXT_CHANGELOG` | Sócio abre o link e vê a operação "rodando" | ½ dia |

Total: **~4,5 dias** de trabalho. F1–F3 são independentes entre si depois de F0 e podem ser
paralelizadas por agentes.

---

## 9. Decisões que são suas (bloqueiam F0)

1. **Ambiente**: confirmar local para construir + projeto Supabase separado para hospedar
   (§5). Alternativa: só local.
2. **Teste expirado sem pagar** (110 oficinas): (a) `cancelada` + `observacao` — recomendado,
   porque não polui "em risco" nem "ativas"; (b) `pausada`/`voluntaria`; (c) criar
   `motivo_pausa='teste_expirado'` via migration (mexe em produto: regra 10.1 + regras-de-negocio).
3. **Retorno**: manter como "segundo serviço" e aceitar `retornos_concluidos = 0`, ou abrir
   uma issue para corrigir a métrica (contar segundo serviço após lembrete) — recomendo abrir a
   issue, fora deste plano.
4. **Ads**: copiar `ad_insights_daily` real para o ambiente isolado e atribuir leads aos
   `ad_id` reais? Recomendo sim (sem PII, e a tela de CAC ganha sentido).
5. **Representantes**: fictícios (recomendado) ou os 7 reais copiados.
6. **Volume**: completo (~57k mensagens) ou compacto. Recomendo completo; o Postgres não
   sente e o admin já pagina.
7. **Fidelidade das conversas**: templates com copy real (recomendado, F1 em 1 dia) ou replay
   pelo harness (mais 1 dia, texto idêntico ao bot atual).

---

## 10. O que este plano não cobre

- Rodar o bot de verdade com OpenAI/Meta em cima dos dados (é outro exercício: teste de carga).
- Custo de servir por oficina (`docs/estrategia/contexto-comercial.md §3.2`) — a simulação dá o
  **volume** de mensagens/tokens por oficina/mês, que é o insumo; a conta é separada.
- Corrigir a métrica de retorno, a automação de expiração do teste ou o `preco_base = 60`.
