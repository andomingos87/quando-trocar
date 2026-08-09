# Backlog · Pivot do catálogo de serviços

Plano de execução do pivot descrito em [`docs/product/pivot-catalogo-de-servicos.md`](../product/pivot-catalogo-de-servicos.md), regido pelas ADRs [0031](../adr/0031-catalogo-aberto-servicos-produtos.md) (catálogo aberto), [0032](../adr/0032-storage-fotos-servico.md) (foto no Storage) e [0033](../adr/0033-cadencia-por-km.md) (cadência por km).

**Status geral: F1 ✅ concluída (2026-08-08). F0 em andamento (ADRs escritas; template `lembrete_servico` submetido à Meta em 2026-08-08, aguardando aprovação). Próxima: F2, destravada assim que a Meta aprovar.**

## Mapa das fases

| Fase | Entrega | Esforço | Depende de |
|---|---|---|---|
| [F0](#f0--fundação-de-decisão-e-meta) | ADRs + template Meta submetido | baixo (calendário: 3–7 dias Meta) | — |
| [F1](#f1--catálogo-no-banco-comportamento-idêntico) | Tabelas de catálogo, seed, RPCs lendo catálogo | 2–3 dias | — (paralela à F0) |
| [F2](#f2--agente-de-catálogo--serviço-livre) | Serviço livre no WhatsApp, dedupe, intervalo, template genérico, espaçamento | 5–8 dias | F1 + template aprovado |
| [F3](#f3--produto-foto-e-km) | Base de produtos, foto no Storage, km | 4–6 dias | F2 |
| [F4](#f4--painel-da-oficina--admin-e-bi) | Painel da oficina (catálogo, clientes, lembretes) + admin/BI | 6–10 dias | F2 (F3 ajuda, não bloqueia) |

Regras transversais (valem para toda fase):

- **Gates de qualidade Aurea** antes de dar a fase por pronta: `npm test` + `npm run lint` + `npm run build` verdes; `get_advisors` (security + performance) sem achado novo após qualquer DDL; `list_migrations` conferido contra os arquivos (lição: deploy corre na frente das migrations).
- **Doc acompanha a feature**: cada fase lista as entradas de `regras-de-negocio.md`, glossário e módulos `.context/` que muda — atualizar **na mesma entrega**.
- **Reversibilidade**: F2 e F3 entram atrás de flag/config (detalhado em cada fase); o pior cenário de cada fase é o comportamento da fase anterior.
- Commits direto na `main` (convenção do projeto), uma fase = uma sequência de commits pequenos e testáveis.

---

## F0 — Fundação de decisão e Meta

**Objetivo:** destravar o calendário. A aprovação de template na Meta leva de horas a dias e é o único caminho crítico externo.

### Passos

1. ✅ ADRs escritas e indexadas: [0031](../adr/0031-catalogo-aberto-servicos-produtos.md), [0032](../adr/0032-storage-fotos-servico.md), [0033](../adr/0033-cadencia-por-km.md); ADR-0014 marcada `superseded`.
2. ✅ **[Anderson]** Submetido no WhatsApp Manager em 2026-08-08 (mesmo WABA dos templates atuais — ver runbook [`meta-whatsapp-setup.md`](../runbooks/meta-whatsapp-setup.md)); aguardando análise da Meta:
   - Nome `lembrete_servico` · Categoria **Utility** · Idioma `pt_BR`
   - Body: `Oi {{1}}, aqui é da {{2}}.` ⏎ `Está chegando a hora da próxima {{4}} do seu {{3}}. Quer agendar?`
   - Exemplos para revisão: `{{1}}` Roberto · `{{2}}` Auto Center Silva · `{{3}}` Gol 2014 · `{{4}}` troca da correia dentada
3. ⬜ Registrar o nome aprovado (ou rejeição + motivo) em `regras-de-negocio.md §8.2` quando a Meta responder.

### Validação

- Template com status **Approved** no WhatsApp Manager. Sem isso, F2 pode ser desenvolvida e testada (o harness usa sender fake), mas **não vai a produção**.

---

## F1 — Catálogo no banco, comportamento idêntico

**Status: ✅ concluída em 2026-08-08.** Migrations `20260808210000_catalogo_base` e `20260808210100_catalogo_rpcs` aplicadas; suíte existente passou intocada (979 testes); advisors sem achado novo. Resultados da validação no fim da seção.

**Objetivo:** criar a fundação de dados sem mudar nenhum comportamento observável. Ao final, o bot responde exatamente igual — mas cadência e template já são resolvidos pelo catálogo.

### Passos

1. **Migration `catalogo_base`** (`supabase/migrations/…_catalogo_base.sql`):
   - `servicos_catalogo` e `produtos_catalogo` conforme ADR-0031 §1 (com `embedding extensions.vector(1536)`, índices HNSW e GIN trigram — extensões `vector` e `pg_trgm` já instaladas);
   - unicidade de serviço por escopo: índice único em `(coalesce(oficina_id, uuid_nil()), slug)`;
   - `servicos.catalogo_id uuid null references servicos_catalogo(id)`, `servicos.produto_id uuid null references produtos_catalogo(id)`;
   - RLS: ambas as tabelas habilitadas; `servicos_catalogo` sem policy (service-role only, como `tipos_servico_default`) — leitura pelo painel da oficina vem na F4 com a policy correspondente;
   - **Seed**: 4 itens globais espelhando `tipos_servico_default` (mesmos `dias_lembrete`, `template_name`, `template_language`; `produto_label` copiado de `PRODUCT_LABEL_BY_TIPO`: óleo/amortecedor/revisão/revisão) + produtos das 4 marcas de amortecedor existentes;
   - **Backfill**: `servicos.catalogo_id` apontando para o item global da mesma `tipo_servico`; `servicos.produto_id` para amortecedores com `marca_peca`.
2. **Migration `catalogo_rpcs`**: recriar `register_service_with_reminder` resolvendo cadência por `servicos_catalogo` (item da oficina > item global > fallback `tipos_servico_default` > fallback `oficinas.dias_lembrete_padrao`) e gravando `catalogo_id`; recriar `enqueue_due_whatsapp_reminders` resolvendo `template_name`/`template_language`/`produto_label` pelo catálogo (fallbacks preservados). Assinaturas compatíveis — nenhum parâmetro removido.
3. **Código**: `repository.ts` (tipos do retorno, sem mudança de fluxo); nenhum agente muda.
4. Funções novas de matching (usadas na F2, criadas já): RPC `match_servicos_catalogo(oficina_id, texto, embedding)` combinando trigram + cosine, `security definer` com `search_path` fixo e `revoke` de `public/anon/authenticated` (lição registrada em memória sobre SECURITY DEFINER).

### Testes

- **Regressão total sem alterar expectativa**: a suíte existente (`whatsapp-*`, `admin-tipos-servico`, harness) passa intocada — é o critério de "comportamento idêntico".
- Novos (SQL via teste de integração leve ou asserts no repositório fake): seed idempotente (rodar migration 2× não duplica); backfill cobre 100% de `servicos` (query de verificação: `count(*) where catalogo_id is null` = 0); cadência resolvida por catálogo = cadência atual para os 4 tipos.

### Validação

- `list_migrations` mostra as 2 migrations aplicadas; `get_advisors` sem achado novo.
- Query manual: para cada `tipo_servico`, `register_service_with_reminder` devolve o mesmo `dias_lembrete` de antes.
- Um cadastro real de teste ("João, Civic, troca de óleo, hoje, 41…") produz o mesmo card, a mesma data e o mesmo template de antes.

### Resultado da entrega (2026-08-08)

| Verificação | Resultado |
|---|---|
| Seed × `tipos_servico_default` | idêntico nas 4 famílias (90 / 730 / 180 / 180; mesmos templates e idioma) |
| Backfill | `count(*) from servicos where catalogo_id is null` = **0**; 6 amortecedores vinculados a `amortecedor-perfect` |
| Seed idempotente | 2ª execução não duplicou (4 itens, 4 produtos) |
| Cadência ponta-a-ponta | RPC executado nas 4 famílias (em transação com rollback): `scheduled_at` igual à fórmula anterior em todas |
| Suíte existente | 84 arquivos / 979 testes verdes, **sem alterar expectativa** |
| `npm run lint` / `npm run build` | verdes |
| `get_advisors` security | só `rls_enabled_no_policy` (INFO) nas 2 tabelas novas — é o desenho pretendido (service-role only, igual a `tipos_servico_default`) |
| `get_advisors` performance | só `unused_index` (INFO) nos índices recém-criados; nenhum FK sem índice |
| Grants | `anon`/`authenticated` sem EXECUTE nas 6 funções tocadas; `service_role` com EXECUTE |

Decisões tomadas na implementação (não estavam no plano):

- **`servicos_catalogo.padrao_familia`** (+ índice único parcial por escopo): o plano pedia a cascata "item da oficina > item global", mas com vários itens por família — o que a F2 vai criar — "o item da família" seria ambíguo. A flag torna a ponte `família → item` determinística sem impedir múltiplos itens por família.
- **`produto_label` no `dequeue`, não no `enqueue`**: o plano previa resolvê-lo no `enqueue`, mas nada o consome na F1 e persisti-lo mudaria `outbound_messages`. Ele viaja com a mensagem via `dequeue_whatsapp_reminder_messages` (ao lado de `tipo_servico`), pronto para a F2 mandar como `{{4}}`. O fallback por família continua único, em `PRODUCT_LABEL_BY_TIPO`.
- **`produto_id` também no RPC**, não só no backfill: sem isso, todo amortecedor cadastrado entre a F1 e a F3 nasceria sem produto enquanto os antigos têm — inconsistência silenciosa.
- **`catalogoId`/`produtoId` opcionais** em `RegisteredService`: o repositório real sempre preenche, mas o harness in-memory não modela catálogo (mesma convenção de `templateName?`/`tipoServico?`). Foi o que permitiu a suíte passar intocada.
- **Assinatura do RPC preservada** (10 parâmetros): `p_catalogo_id` fica para a F2, quando existir quem o envie.

### Docs

- `.context/modules/database/AGENTS.md` (tabelas novas); glossário (verbetes `catálogo de serviços`, `família`, `item padrão da família`, `produto canônico`, `produto_label`).
- `regras-de-negocio.md` **não** muda nesta fase: nenhum comportamento de produto mudou. A entrada §4.1 (cadência → catálogo) está na F2, junto com a mudança observável.

---

## F2 — Agente de catálogo + serviço livre

**Objetivo:** o mecânico fala qualquer serviço do nicho; o agente canoniza sem duplicar; o intervalo vem da oficina; o lembrete sai pelo template genérico. **Coração do pivot.**

**Pré-condições:** F1 aplicada; template `lembrete_servico` aprovado (para produção); flag de rollout definida.

**Rollout/reversibilidade:** config `catalogo_livre_modo` em `configuracoes_vendedor` (mesmo padrão do `geracao_llm_modo` da ADR-0020): `off` (comportamento F1, enum via `detectTipoServico`) · `sombra` (agente roda, loga a decisão em `agent_tool_calls`, mas o fluxo usa o caminho antigo) · `on`. Começa em `sombra` em produção por alguns dias antes de `on`.

### Passos

1. **`lib/whatsapp/catalog-agent.ts`** (novo):
   - `matchCatalogItem()`: cascata slug/alias exato → RPC trigram/embedding → faixas de decisão (≥0.90 usa · 0.75–0.90 pergunta · <0.75 novo), conforme ADR-0031 §3;
   - `canonicalizeService()`: chamada OpenAI Structured Outputs `strict` com o schema `{acao, catalogo_id, proposta{nome,familia,produto_label,aliases}, produto{nome,marca,modelo,especificacao}, intervalo{base,dias,km}, pergunta, confianca}`;
   - validador determinístico do `produto_label` (formato Cloud API: sem `\n`/tab/4+ espaços, ≤40 chars, charset restrito, sem link/telefone/preço) — reprovou ⇒ fallback `PRODUCT_LABEL_BY_TIPO[familia]`;
   - embeddings via a infra de `faq-embeddings.ts` (mesmo modelo, mesmo padrão best-effort).
2. **Onboarding/operação** (`onboarding-agent.ts`, `webhook-handler.ts`):
   - JSON Schema da extração perde o enum fechado de `tipo_servico` (o campo sai do schema; `familia` passa a vir do catálogo);
   - após a extração, o catálogo resolve: match ⇒ usa item; faixa cinza ⇒ pergunta de desambiguação; sem match ⇒ proposta de item novo com pergunta de intervalo;
   - captura de intervalo (ADR-0031 §4): interpretação livre (estender `date-parse.ts` com parser de duração/km: "60 mil", "2 anos", "6 meses"), reply buttons `[Por tempo] [Por km] [Não sei]` e desambiguação com botões (registrar em `sales-buttons.ts` / `interactive-audit.ts`, padrão existente);
   - card de confirmação (ADR-0017) passa a mostrar: serviço canonizado, intervalo e **data prevista**; item novo só é criado no "Confirmar";
   - `detectTipoServico()` deixa de ser autoridade (vira dica de família para o agente); o default silencioso `troca_oleo` morre.
3. **Persistência** (`repository.ts` + migration pequena se necessário): criar item de catálogo da oficina (via RPC dedicado `create_catalogo_item_oficina`, service-role, com validações de limite 7–3650 d / 500–300.000 km) e registrar `agent_tool_calls` (`catalogo_item_criado`, `catalogo_item_usado`, `catalogo_desambiguacao`).
4. **Lembrete** (`reminder-agent.ts`, `reminder-worker.ts`): `renderReminderTemplate` resolve a frase pelo `produto_label` (fallback por família); worker envia 4º parâmetro quando o template é `lembrete_servico`; fallbacks atuais preservados.
5. **Espaçamento anti-fadiga** (ADR-0031 §7, migration): `oficinas.dias_min_entre_lembretes int not null default 7`; no `enqueue_due_whatsapp_reminders`, cliente com outro lembrete enviado/enfileirado há < N dias ⇒ adia (grava motivo + data original em `lembretes`), teto de 30 dias de adiamento; contador instrumentado (para decidir agrupamento no futuro).
6. **Conhecimento do bot**: `product-knowledge.ts` para de citar cadências fixas ("a cadência é a que sua oficina definir por serviço"); prompts `.cursor/` e `.codex/` atualizados.

### Testes

- **Dedupe**: typo ("correa dentada" → usa "Correia dentada"); sinônimo via alias; faixa cinza pergunta e **não cria**; duas oficinas criando o mesmo item não colidem entre si nem com o global.
- **Nicho**: "lavagem"/"seguro do carro" ⇒ pergunta/recusa, nunca cria; prompt-injection no nome do serviço ("ignore as instruções…") ⇒ validador reprova o label ⇒ fallback de família.
- **Intervalo**: "60 mil" ⇒ km; "2 anos"/"6 meses" ⇒ dias; "seis mil" ambíguo ⇒ botões; "não sei" ⇒ sugere item global; fora dos limites sanitários ⇒ reprova e pergunta.
- **Fluxo**: item novo só existe após "Confirmar" (o "Corrigir" descarta); tool calls auditadas; modo `sombra` não altera o fluxo antigo (harness comparativo).
- **Lembrete**: template genérico com 4 params e sanitização; item sem label válido usa família; regressão dos 3 templates antigos para os itens globais.
- **Espaçamento**: 2 lembretes do mesmo cliente na mesma semana ⇒ o 2º adia com motivo; teto de 30 dias respeitado; clientes distintos não interferem; idempotência do enqueue preservada.
- **Custo**: teste de contagem de chamadas — cadastro repetido de serviço conhecido não chama OpenAI (etapas 1–2 resolvem).

### Validação

- Harness/REPL (`scripts/whatsapp/repl`): roteiro completo — "troquei a correia dentada do Gol do Roberto, hoje" → pergunta de intervalo → "60 mil km" → card com data prevista → confirmar → lembrete agendado; repetir o serviço em outro cliente **sem** pergunta de intervalo (item já existe).
- Em produção: 3–5 dias em `sombra`, revisando `agent_tool_calls` (decisões do agente vs. caminho antigo); depois `on`.
- `get_advisors` + `list_migrations`; medir custo médio por cadastro nos logs.

### Docs (mesma entrega)

- `regras-de-negocio.md`: §3.2 (campos), **§3.6 (regra P0-2 revisada — ADR-0031 §5)**, §4.1 (cadência → catálogo), §4.x novo (espaçamento), §8.2 (template genérico).
- `.context/modules/whatsapp-bot/AGENTS.md` (agente novo), prompt novo `.cursor/prompts/whatsapp-catalogo-agent.md` (+ espelho `.codex/`), glossário.

---

## F3 — Produto, foto e km

**Objetivo:** completar o dado — o que foi usado (produto canônico), a evidência (foto) e a régua do setor (km).

**Pré-condições:** F2 em `on`. Política de privacidade atualizada é **pré-condição para ativar** o armazenamento de foto (ADR-0032 §6).

### Passos

1. **Produto canônico** (`catalog-agent.ts` + repositório): quando a fala/foto trouxer marca/modelo/especificação ("óleo 20W50 da Ipiranga", "amortecedor Perfect"), o agente propõe o produto; dedupe pela mesma cascata; vínculo `servicos.produto_id` entra no card de confirmação. `marca_peca` legado congelado (leitura apenas).
2. **Foto no Storage** (ADR-0032): migration/config do bucket `fotos-servicos` privado + policies; upload best-effort no webhook entre download e vision; `servicos.foto_path`; cron mensal de expurgo (>730 dias); fluxo de `app/exclusao-dados` remove objetos.
3. **LGPD**: atualizar `app/privacidade` e `app/exclusao-dados` (imagens + prazo de 24 meses) — deploy antes de ligar o upload.
4. **Km** (ADR-0033, migration): campos em `veiculos`/`servicos`/`lembretes`/`oficinas`; extração de km no cadastro (texto/áudio/foto — a vision já lê odômetro); conversão km→data no RPC; auto-aprendizado `km_medio_mes` (determinístico, piso/teto 300–5.000); recálculo de pendentes ao observar km novo; `base='ambos'` agenda pelo que vencer primeiro.
5. **Copy**: card e confirmação mostram "Próxima: ~{km_alvo} km · {data}" quando `base_calculo='km'`; landing (`como-funciona.tsx`, `chat-scripts.ts`) revisada para prometer exatamente o que existe.

### Testes

- **Produto**: dedupe de produto ("20w50 ipiranga" 2× ⇒ 1 item); produto sem marca ⇒ marca null, sem pergunta forçada; histórico Perfect intacto (queries do BI de amortecedor).
- **Foto**: upload ok ⇒ `foto_path` gravado; falha de upload ⇒ cadastro segue (best-effort); RLS — oficina A não lê objeto da oficina B; expurgo remove só >730d; exclusão de dados remove objetos.
- **Km**: conversões (60.000 km ÷ 1.000/mês = ~1.800 dias… validar contra teto de 3650); auto-aprendizado com 2 e 3 serviços; outlier (500 km em 2 dias) travado pelo teto; km novo reagenda pendente e **não** toca enviado; veículo sem km usa default da oficina; `ambos` escolhe a menor data.
- Regressão total da suíte.

### Validação

- Cadastro real com foto de painel: km extraído, foto no bucket com URL assinada acessível só pela oficina dona, card com km alvo + data.
- `get_advisors` (storage policies contam) + `list_migrations`; custo de storage estimado nos logs do primeiro ciclo.

### Docs

- `regras-de-negocio.md` (§3.2 produto/km/foto, §4.1 conversão km); glossário (`km alvo`, `média de rodagem`); módulos `whatsapp-bot` e `database`; runbook curto de storage (bucket, retenção, como auditar).

---

## F4 — Painel da oficina + admin e BI

**Objetivo:** dar tela ao mecânico (primeira interface fora do WhatsApp) e ao admin as ferramentas de curadoria do catálogo.

**Pré-condições:** F2 em `on` (o painel exibe o catálogo real). F3 enriquece (foto, km) mas não bloqueia.

### Passos

1. **Auth da oficina**: fluxo OTP WhatsApp já existente (`auth_otps`, ADR-0010) resolvido contra `oficinas.whatsapp_principal` com `status='ativa'`; sessão própria (cookie HTTP-only) separada da sessão admin; rota `app/painel/` (módulo novo `.context/modules/painel-oficina/`).
2. **RLS para o painel**: policies de leitura por `oficina_id` da sessão nas tabelas exibidas (`servicos_catalogo` da própria oficina + globais, `clientes_finais`, `veiculos`, `servicos`, `lembretes`) — hoje tudo é service-role only; decidir entre RLS com JWT custom claim ou queries server-side escopadas (padrão do admin atual: server-side com service-role + filtro explícito; **recomendado manter esse padrão** para não abrir RLS nova).
3. **Telas** (ordem de prioridade da §3.7 do doc de pivot):
   - **Catálogo** — lista (globais + próprios), editar intervalo/nome/label, desativar, criar manualmente; edição passa pelas mesmas validações do RPC;
   - **Clientes** — busca, detalhe (veículos, serviços, próximo lembrete, foto se F3);
   - **Lembretes** — próximos 7 dias + histórico, antecipar/cancelar (com auditoria).
4. **Admin**: `/admin/tipos-servico` → `/admin/catalogo-servicos` (CRUD do global, **mesclagem de duplicatas** com re-vínculo de `servicos.catalogo_id`, visão por oficina, outliers de cadência); auditoria (`admin_audit_log`) em toda mutação; `lib/admin/normalize.ts` deixa de colapsar em 3 rótulos.
5. **BI**: cards de inteligência de mercado ganham eixo produto/marca (o cohort Perfect vira caso particular de market-share por marca); card novo "serviços mais cadastrados fora do catálogo global" (leitura de demanda real).
6. Aplicar o skill `quando-trocar-design` nas telas novas (landing e admin já seguem a identidade).

### Testes

- **Auth**: OTP expirado/reusado/número não-ativo rejeitados; sessão de oficina não acessa `/admin` e vice-versa.
- **Escopo**: oficina A nunca vê dado da B (teste em toda query do painel — gate de segurança bloqueante).
- **Catálogo**: edição de intervalo respeita limites; desativar item não quebra lembrete existente; mesclagem re-vincula serviços e não perde histórico.
- **Admin**: mesclagem auditada; BI bate com queries de controle.
- E2E leve das 3 telas (fluxo feliz) via harness de rota.

### Validação

- Roteiro real: dono loga com OTP, corrige o intervalo da correia de 60 → 50 mil, e o próximo cadastro usa o valor novo.
- Revisão de segurança (agente `aurea-context:seguranca`) antes de publicar — endpoint novo exposto a usuário externo é gate bloqueante.
- `npm run build` (rotas novas), advisors, regressão total.

### Docs

- `telas-web.md` atualizado (o que saiu do papel), ADR-0010 anotada (painel entregue em versão catálogo-first), módulo novo `.context/modules/painel-oficina/`, `regras-de-negocio.md` (§ painel da oficina), runbook de suporte ("oficina não recebe OTP").

---

## Fora de escopo (não entra em F1–F4)

Agrupamento de lembretes numa mensagem (esperando dado real de colisão do contador da F2); dashboard e retornos (Fase 4 original); agendamento no calendário (ADR-0009); preço por serviço (ADR-0012); telemetria de veículo; catálogo sugerido por perfil de oficina.

## Riscos acompanhados

Ver tabela completa em [`pivot-catalogo-de-servicos.md §4`](../product/pivot-catalogo-de-servicos.md). Os dois com monitoramento ativo pós-F2: **custo por cadastro** (logar chamadas OpenAI/embedding por cadastro; alvo: maioria resolvida sem LLM) e **taxa de adiamento por espaçamento** (decide o agrupamento futuro).
