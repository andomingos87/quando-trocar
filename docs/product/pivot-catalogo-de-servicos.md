# Pivot — de "óleo e amortecedor" para catálogo de serviços da oficina

- **Status**: aprovado — decisões formalizadas em ADR; implementação não iniciada
- **Versão**: v2 — 2026-08-08 (decisões 1-6 fechadas)
- **Autor**: mapeamento técnico a pedido de Anderson Domingos
- **ADRs derivadas**: [ADR-0031](../adr/0031-catalogo-aberto-servicos-produtos.md) (catálogo aberto — supersede a [ADR-0014](../adr/0014-cadencia-e-template-por-tipo-de-servico.md)), [ADR-0032](../adr/0032-storage-fotos-servico.md) (foto no Storage — revisa a [ADR-0016](../adr/0016-suporte-imagem-pdf-sem-storage.md)), [ADR-0033](../adr/0033-cadencia-por-km.md) (cadência por km)
- **Plano de execução**: [`docs/backlog-catalogo-servicos/README.md`](../backlog-catalogo-servicos/README.md)
- **Relaciona-se com**: [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md), [ADR-0005](../adr/0005-templates-meta-vs-mensagem-livre.md), [ADR-0010](../adr/0010-painel-web-no-mvp.md), [ADR-0017](../adr/0017-confirmacao-antes-de-registrar-troca.md), [ADR-0027](../adr/0027-extracao-de-cadastro-por-llm.md)

---

## 1. Tese do pivot

O produto não é "lembrete de troca de óleo". É **infraestrutura de retorno**: qualquer serviço automotivo com retorno previsível vira um lembrete no WhatsApp, com o nome da oficina.

Hoje o sistema materializa isso em um **enum fechado de 4 valores** (`troca_oleo | amortecedor | revisao | outro`), com cadência e template Meta definidos **globalmente pelo admin**, não pela oficina. Consequências práticas:

- Correia dentada (60.000 km), fluido de freio (2 anos), filtro de ar-condicionado (1 ano), alinhamento (10.000 km), bateria (3 anos), embreagem — **tudo cai em `outro`, com cadência de 180 dias**. Errado para quase todos.
- A oficina que trabalha com suspensão, freio ou câmbio não consegue expressar o próprio negócio no produto.
- Cadência por **km** não existe em lugar nenhum do banco — e é como o setor pensa a maioria dos serviços.

Três observações que reforçam o timing:

1. **A regra de negócio já promete escopo amplo.** `docs/regras-de-negocio.md:109` diz que o bot fala "qualquer peça ou serviço automotivo com retorno previsível — óleo, amortecedor, filtro, revisão, alinhamento, freio". O banco entrega 4 caixas. O discurso já pivotou; o produto não.
2. **A landing já vende km.** [`components/como-funciona.tsx:22`](../../components/como-funciona.tsx) — "Anotado. Próxima troca: daqui a ~5 meses. **Monitorando km**." E [`lib/chat-scripts.ts:62`](../../lib/chat-scripts.ts) mostra card com "KM hoje 47.000" e "Próxima ~52.000 km". **Nada disso existe no banco.** Hoje é promessa não cumprida; o pivot fecha a lacuna.
3. **A extração de imagem já pede odômetro.** [`lib/whatsapp/image-vision.ts:52`](../../lib/whatsapp/image-vision.ts) instrui o modelo a ler "odômetro/km visível" da foto — o dado chega e é descartado.

**Objetivo do pivot:** o mecânico fala livremente o que fez; um **agente especialista** entende, canoniza e cadastra no catálogo (sem duplicar), pergunta quando tem dúvida, e o sistema agenda o lembrete pelo intervalo que a oficina definir — em **km** ou em **tempo**.

**Efeito colateral estratégico:** cada cadastro alimenta uma base canônica de produtos e serviços de manutenção automotiva (com marca, modelo e especificação). Isso é um ativo de dados maior que o produto em si — hoje a inteligência de mercado só existe para amortecedor (cohort Perfect).

---

## 2. Diagnóstico — onde "óleo/amortecedor" está cravado hoje

Inventário completo do que precisa mudar. É a lista de trabalho real.

### 2.1 Banco (módulo [`database`](../../.context/modules/database/AGENTS.md))

| Onde | O que trava | Arquivo |
|---|---|---|
| `servicos.tipo_servico` | `check` com 4 valores fixos | `20260521000000_tipo_servico_marca_peca.sql` |
| `servicos.marca_peca` | `check` que só permite marca quando `tipo_servico = 'amortecedor'`; enum de 5 marcas | idem |
| `servicos_tipo_servico_idx` | índice `(oficina_id, tipo_servico, data_servico desc)` | idem |
| `tipos_servico_default` | PK = `tipo_servico`; tabela **global**, 4 linhas, sem `oficina_id`; só service-role | `20260522000000_tipos_servico_default.sql` |
| `register_service_with_reminder` | valida os 4 valores em `raise exception`; resolve cadência só por `dias_lembrete` | idem + `20260725120000_register_service_returns_scheduled_at.sql` |
| `enqueue_due_whatsapp_reminders` | `case v_row.tipo_servico when 'amortecedor' ... when 'revisao' ...` renderiza o body; fallback hard-coded `lembrete_troca_oleo` | `20260522000000` |
| `dequeue_whatsapp_reminder_messages` | devolve `coalesce(s.tipo_servico, 'troca_oleo')` | idem |
| `oficinas.dias_lembrete_padrao` | default 90, usado como fallback final | `20260426021529_phase_2_conversion_onboarding.sql` |
| `veiculos` | sem `km`; só `descricao` e `placa` | idem |
| `servicos` | sem km, sem marca/modelo/especificação genéricos, sem foto | idem |
| `lembretes` | `scheduled_at` só temporal; sem noção de km-alvo | idem |

### 2.2 Bot (módulo [`whatsapp-bot`](../../.context/modules/whatsapp-bot/AGENTS.md))

| Onde | O que trava |
|---|---|
| [`types.ts:228`](../../lib/whatsapp/types.ts) | `type TipoServico = "troca_oleo" \| "amortecedor" \| "revisao" \| "outro"` — contrato de todo o bot |
| [`onboarding-agent.ts:42`](../../lib/whatsapp/onboarding-agent.ts) | `detectTipoServico()` — regex que joga tudo que não é óleo/amortecedor/revisão em `outro`, e **default silencioso `troca_oleo`** |
| [`onboarding-agent.ts:712`](../../lib/whatsapp/onboarding-agent.ts) | prompt de extração com o enum e a regra de `marca_peca` |
| [`onboarding-agent.ts:1632`](../../lib/whatsapp/onboarding-agent.ts) | JSON Schema `strict` do OpenAI com o enum fechado |
| [`service-confirmation.ts:57`](../../lib/whatsapp/service-confirmation.ts) | `PRODUCT_LABEL_BY_TIPO` com `satisfies Record<TipoServico, string>` — guardrail P0-2 (**revisado pela decisão 3**) |
| [`reminder-agent.ts:37`](../../lib/whatsapp/reminder-agent.ts) | `renderReminderTemplate()` — `if/else` por tipo, uma frase por tipo |
| [`reminder-worker.ts:75`](../../lib/whatsapp/reminder-worker.ts) | fallback `lembrete_troca_oleo`; envia **3 parâmetros posicionais** fixos |
| [`repository.ts:1304`](../../lib/whatsapp/repository.ts) | passa `p_tipo_servico` ao RPC |
| [`repository.ts:342`](../../lib/whatsapp/repository.ts) | resumo do cliente lê `tipo_servico` como rótulo do último serviço |
| [`product-knowledge.ts:14`](../../lib/whatsapp/product-knowledge.ts) | fatos do produto com as cadências escritas em texto — o bot **fala** "óleo ~90 dias, amortecedor ~2 anos" |
| `.cursor/prompts/whatsapp-*.md` e `.codex/` | briefs de prompt com o enum |

### 2.3 Admin (módulo [`painel-admin`](../../.context/modules/painel-admin/AGENTS.md))

| Onde | O que trava |
|---|---|
| [`lib/admin/tipos-servico.ts`](../../lib/admin/tipos-servico.ts) | `TipoServicoKey` fechado; CRUD que só **edita** 4 linhas (não cria) |
| [`app/admin/(autenticado)/tipos-servico/page.tsx`](../../app/admin/(autenticado)/tipos-servico/page.tsx) + [`components/admin/tipos-servico-client.tsx`](../../components/admin/tipos-servico-client.tsx) | tabela de 4 linhas, sem criar/excluir, sem noção de oficina |
| [`lib/admin/inteligencia-mercado.ts`](../../lib/admin/inteligencia-mercado.ts) | 4 cards de BI agregam pelo enum + `marca_peca` de amortecedor (**ativo comercial** — cohort Perfect) |
| [`lib/admin/normalize.ts:106`](../../lib/admin/normalize.ts) | `normalizeServico()` colapsa texto livre nos 3 rótulos canônicos |
| [`lib/admin/audit-actions.ts:58`](../../lib/admin/audit-actions.ts) | ação de auditoria `tipo_servico.update` |
| [`lib/representante/content/playbook.ts:9`](../../lib/representante/content/playbook.ts) | playbook comercial cita as cadências de fábrica |

### 2.4 Docs

`ADR-0014` (a superseder), `ADR-0016` (a revisar — foto), `regras-de-negocio.md` §3.2 (346-381), §3.6 (436), §4.1 (468-484), §5, §8.2 (663), §12 (988-1004), `glossary.md` (verbete `lembrete`), `PRD-whatsapp-bot.md` §10, política de privacidade (`app/privacidade`) se armazenarmos imagem.

### 2.5 Infraestrutura que já existe e será reusada

| Peça | Onde | Uso no pivot |
|---|---|---|
| `pgvector` + HNSW + `text-embedding-3-small` | `20260718150000_faq_semantic_search.sql`, [`faq-embeddings.ts`](../../lib/whatsapp/faq-embeddings.ts) | busca semântica de item de catálogo (dedupe) |
| `pg_trgm` | `20260808180000_prospeccao_base.sql` | similaridade textual barata antes do embedding |
| Reply buttons (máx. 3, título ≤ 20) | [`sales-buttons.ts`](../../lib/whatsapp/sales-buttons.ts), `interactive-audit.ts` | perguntas do agente de catálogo |
| Card de confirmação antes de gravar | [ADR-0017](../adr/0017-confirmacao-antes-de-registrar-troca.md), `ONBOARDING_CONFIRM_BUTTONS` | confirmar item novo e intervalo |
| Vision (odômetro/peça) | [`image-vision.ts`](../../lib/whatsapp/image-vision.ts) | foto do produto e leitura de km |
| OTP por WhatsApp | `auth_otps` (já em produção no admin) | login do painel da oficina |
| Geração + validador + fallback | [ADR-0020](../adr/0020-camada-geracao-conversacional.md) | perguntas do agente com tom natural, sem risco |

### 2.6 O que **não** existe

**Painel da oficina.** `app/` tem `admin`, `representante`, `demo`, `r` — a Fase 4 ([ADR-0010](../adr/0010-painel-web-no-mvp.md)) nunca foi entregue. Hoje a única interface do mecânico é o WhatsApp. A decisão 4 muda isso (§3.7).

---

## 3. Modelo alvo

### 3.1 Duas entidades canônicas: serviço e produto

A decisão 1 pede duas coisas diferentes que hoje estão coladas em um campo de texto:

- **o que foi feito** (troca de óleo, correia dentada, alinhamento) → define a **cadência do lembrete**;
- **o que foi usado** (óleo 20W50 Ipiranga, amortecedor Perfect PF-1234) → define **marca, modelo, especificação** e alimenta a inteligência de mercado.

```sql
-- O QUE FOI FEITO (gera cadência)
create table public.servicos_catalogo (
  id            uuid primary key default gen_random_uuid(),
  oficina_id    uuid null references public.oficinas(id) on delete cascade, -- null = item global
  slug          text not null,                 -- 'troca_oleo', 'correia_dentada'
  nome          text not null,                 -- 'Troca da correia dentada'
  familia       text not null,                 -- 'troca_oleo' | 'amortecedor' | 'revisao' | 'outro'
  produto_label text not null,                 -- substantivo curto usado no template
  aliases       text[] not null default '{}',  -- 'correia', 'correia sincronizadora'
  embedding     extensions.vector(1536),       -- dedupe semântico (mesma infra da FAQ)
  base          text not null,                 -- 'tempo' | 'km' | 'ambos'
  intervalo_dias integer null check (intervalo_dias between 7 and 3650),
  intervalo_km   integer null check (intervalo_km between 500 and 300000),
  template_name text null,                     -- null = template genérico
  origem        text not null,                 -- 'sistema' | 'oficina' | 'admin'
  ativo         boolean not null default true
);

-- O QUE FOI USADO (peça/produto — escopo global, marca é dado de mercado)
create table public.produtos_catalogo (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  nome          text not null,                 -- 'Óleo 20W50'
  marca         text null,                     -- 'Ipiranga', 'Perfect'
  modelo        text null,                     -- 'PF-1234'
  especificacao text null,                     -- '20W50 semissintético'
  familia       text not null,
  embedding     extensions.vector(1536),
  origem        text not null,
  ativo         boolean not null default true
);
```

- `servicos.catalogo_id` → item de serviço (obrigatório).
- `servicos.produto_id` → item de produto (opcional — nem todo serviço tem peça).
- `servicos.especificacao_livre`, `servicos.foto_path` → o que é específico daquela execução.
- `servicos.tipo_servico` **permanece**, alimentado pela `familia`.

**Por que manter o enum como "família"** (é o que faz o pivot ser incremental, não um big-bang):

1. Os 4 cards de `/admin/inteligencia-mercado` — incluindo o cohort Perfect, que é ativo comercial — continuam funcionando sem reescrita.
2. Existe sempre um eixo comparável entre oficinas e um fallback seguro de copy quando o catálogo estiver mal preenchido.
3. `marca_peca` (hoje restrito a amortecedor) migra para `produtos_catalogo.marca` **sem perder o histórico** da Perfect.

**Escopo:** serviço é por oficina (o global entrega valor no minuto zero; a oficina só toca no que é dela). Produto é global — "Perfect" é Perfect para todo mundo, e é exatamente essa consolidação que vira a base de dados de mercado.

### 3.2 O agente de catálogo (decisão 1)

Agente especialista novo, no fluxo de operação/onboarding. **Ele não substitui a extração de cadastro** — roda depois dela, sobre o campo `servico` e os atributos detectados.

**Entrada:** texto do que a oficina falou (ou transcrição do áudio, ou descrição da foto) + candidatos do catálogo (oficina + global).
**Saída** (Structured Outputs `strict`, [ADR-0027](../adr/0027-extracao-de-cadastro-por-llm.md)):

```jsonc
{
  "acao": "usar_existente" | "criar_novo" | "perguntar",
  "catalogo_id": "uuid|null",
  "proposta": { "nome": "...", "familia": "...", "produto_label": "...", "aliases": ["..."] },
  "produto":  { "nome": "...", "marca": "...", "modelo": "...", "especificacao": "..." } | null,
  "intervalo": { "base": "tempo|km", "dias": 0, "km": 0 } | null,
  "pergunta": "string|null",
  "confianca": 0.0
}
```

**Pipeline de dedupe — barato → caro, LLM só no fim** (é isto que impede duplicata, não o modelo sozinho):

| Etapa | Técnica | Decisão |
|---|---|---|
| 1 | slug/alias exato (normalizado: sem acento, caixa, plural) | match ⇒ usa, custo zero |
| 2 | `pg_trgm similarity()` ≥ 0.6 (índice GIN) | gera candidatos |
| 3 | embedding `text-embedding-3-small` + HNSW cosine | ≥ 0.90 usa · 0.75-0.90 **pergunta** · < 0.75 candidato a novo |
| 4 | agente decide entre candidatos ambíguos e propõe o item novo | sempre com confirmação da oficina |

Exemplo: *"troquei a correia"* com "Correia dentada" já no catálogo cai na faixa cinza (~0.82) ⇒ o bot pergunta *"É a correia dentada ou a correia do alternador?"* em vez de criar item duplicado.

**Limite de autoridade ([ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md) intacta):** o agente pode **usar** item existente sozinho (não cria estado novo). **Criar** item de catálogo, definir intervalo ou vincular produto exige confirmação explícita da oficina no card ([ADR-0017](../adr/0017-confirmacao-antes-de-registrar-troca.md)). Toda criação vira `agent_tool_calls` auditável.

**Foto (decisão 1 — "tudo será armazenado"):** exige **revisar a [ADR-0016](../adr/0016-suporte-imagem-pdf-sem-storage.md)**, que hoje decide explicitamente descartar os bytes. Consequências a tratar na mesma entrega: bucket privado no Supabase Storage com path `oficina_id/servico_id/`, RLS por oficina, política de retenção, atualização da [política de privacidade](../../app/privacidade) (que hoje não menciona imagens) e custo de storage. **Prazo de retenção é o único ponto que ainda precisa da sua definição** (sugestão: 24 meses, alinhado ao ciclo mais longo de lembrete).

### 3.3 Intervalo: km ou tempo (decisão 2)

**Regra:** interpretar livre primeiro; perguntar só quando não entender; **nunca salvar sem confirmação**.

1. A oficina fala: *"correia dentada, troca a cada 60 mil"* ⇒ o agente interpreta `km = 60000`.
2. Não falou nada ⇒ pergunta com 3 reply buttons (limite da Cloud API): **[Por tempo] [Por km] [Não sei]**.
3. Falou algo ambíguo (*"seis mil"*, *"um ano e meio"*, *"na próxima revisão"*) ⇒ pergunta de desambiguação, também com botões quando houver 2-3 saídas claras: *"6 mil km ou 6 meses?"* → **[6 mil km] [6 meses]**.
4. "Não sei" ⇒ sugere a cadência do item global equivalente, se existir, e pede confirmação.
5. O valor entra no card final (ADR-0017) junto com **a data prevista**, e só é gravado depois do "Confirmar".

Sem lista fixa de unidades: dias, semanas, meses, anos e km são todos interpretados do texto (o projeto já tem [`date-parse.ts`](../../lib/whatsapp/date-parse.ts) como base). Botões são **atalho de desambiguação**, não formulário.

### 3.4 Km — modelo de dados e cálculo

```sql
alter table public.veiculos
  add column km_atual integer,
  add column km_atualizado_em date,
  add column km_medio_mes integer;          -- aprendido; null = usa default da oficina

alter table public.servicos add column km_servico integer;

alter table public.lembretes
  add column base_calculo text,             -- 'tempo' | 'km'
  add column km_alvo integer;

alter table public.oficinas add column km_medio_mes_padrao integer not null default 1000;
```

- **A fila continua temporal.** Não há telemetria: km vira **data prevista** no `scheduled_at` — `dias = intervalo_km / (km_medio_mes / 30)`.
- `km_medio_mes` **se auto-aprende** a partir do 2º serviço do mesmo veículo (Δkm ÷ meses), com piso/teto sanitário (300-5.000 km/mês).
- Fontes de km: texto, áudio e **foto do painel** — a vision já lê odômetro.
- Km novo **recalcula** os lembretes pendentes daquele veículo.
- **A oficina vê a data**, não só o km: a copy hoje já informa a data exata justamente porque prazo escondido gera divergência (regras §4.1). Com km, exibir "~52.000 km · 14/03/2027" mantém as duas leituras coerentes.

### 3.5 Template Meta e o guardrail revisado (decisão 3)

Hoje: **um template aprovado por tipo** (`lembrete_troca_oleo`, `lembrete_amortecedor`, `lembrete_revisao_geral`), 3 parâmetros posicionais. Com catálogo aberto isso é inviável — cada serviço novo exigiria aprovação da Meta (horas a dias) antes de poder lembrar.

**Template genérico:**

```
lembrete_servico (Utility, pt_BR)
Oi {{1}}, aqui é da {{2}}.
Está chegando a hora da próxima {{4}} do seu {{3}}. Quer agendar?
```
`{{1}}` cliente · `{{2}}` oficina · `{{3}}` veículo · `{{4}}` **serviço**, vindo de `servicos_catalogo.produto_label`

**Guardrail alterado conforme sua decisão.** A regra P0-2 (`regras-de-negocio.md:436`) hoje é *"nenhum texto livre da oficina vira parâmetro de template"*. Passa a ser:

> **Só texto já canonizado no catálogo entra como parâmetro de template.** O valor nunca vem da fala crua da oficina: vem de `servicos_catalogo.produto_label`, criado pelo agente de catálogo e confirmado pela oficina antes de existir.

Duas coisas que **permanecem** — e não são guardrail nosso, são limitação do provedor:

1. **Sanitização de formato**: a Cloud API rejeita parâmetro com quebra de linha, tab ou 4+ espaços consecutivos. Sem isso o envio falha em runtime (`erro_envio`), não no cadastro.
2. **Limite de tamanho** (~40 chars): o valor entra numa frase pronta; texto longo quebra a leitura da mensagem.

Ou seja: a curadoria de **conteúdo** passa a ser responsabilidade do agente + confirmação da oficina (sua decisão); a validação de **formato** continua no código, porque é requisito técnico de envio.

Os 3 templates atuais continuam válidos para os itens globais (o catálogo pode fixar `template_name`), então nada quebra enquanto o genérico não é aprovado.

### 3.6 Espaçamento de lembretes (decisão 5)

Com vários serviços por veículo, ciclos diferentes se cruzam e o mesmo cliente recebe 3 mensagens numa semana — que ele lê como spam, e spam derruba a qualidade do número na Meta.

**Regra:** no `enqueue_due_whatsapp_reminders`, um lembrete cujo cliente recebeu (ou vai receber) outro lembrete **há menos de 7 dias** é empurrado, não enviado. Determinística, sem template novo, sem depender da Meta.

- Janela configurável (`oficinas.dias_min_entre_lembretes`, default 7).
- O empurrão é registrado no lembrete (motivo + data original) para a oficina e o admin verem por que atrasou.
- Teto de adiamento (ex.: 30 dias) para um serviço não ficar preso atrás de outros indefinidamente.
- **Agrupamento** ("está na hora de: troca de óleo e alinhamento") fica para depois, com dado real de colisão — exige template novo aprovado pela Meta. Instrumentar a frequência de empurrão desde a F2 é o que informa essa decisão.

### 3.7 Painel da oficina (decisão 4)

[ADR-0010](../adr/0010-painel-web-no-mvp.md) já desenhou 4 telas (Dashboard, Clientes, Lembretes, Retornos) com login OTP por WhatsApp — e o OTP **já está em produção** no admin (`auth_otps`), então a autenticação é reuso, não construção.

O pivot acrescenta a tela que faltava e reordena a prioridade:

| Ordem | Tela | Por quê |
|---|---|---|
| 1 | **Catálogo de serviços** | é o que o pivot exige: ver, editar intervalo, corrigir nome, mesclar duplicata, desativar item |
| 2 | **Clientes** | conferir e corrigir o que o bot cadastrou (hoje só dá para corrigir via `/suporte`) |
| 3 | **Lembretes** | próximos 7 dias + histórico; antecipar/cancelar |
| 4 | **Dashboard** | métricas — valor percebido, mas não desbloqueia nada |
| 5 | Retornos | depende de registro de retorno (Fase 4 original) |

O planejamento detalhado (rotas, layout, RLS por sessão de oficina, telas 1-3) sai num doc próprio de backlog — ver §5 F4.

---

## 4. Riscos e guardrails

| # | Risco | Mitigação |
|---|---|---|
| 1 | **Duplicata no catálogo** ("correia", "correia dentada", "correa dentada") | pipeline de 4 etapas (§3.2): slug → trigram → embedding → pergunta. Nunca cria em faixa cinza |
| 2 | **Item fora do nicho** ("lavagem", "seguro", ou pior) | o agente valida domínio automotivo; fora do nicho ⇒ pergunta, não cria |
| 3 | **Cadência absurda** ("lembra em 10 dias") queima o cliente final | limites no check (7-3650 dias / 500-300.000 km), confirmação explícita, alerta de outlier no admin |
| 4 | **Km estimado errado** (cliente roda 3.000 km/mês, default 1.000) | auto-aprendizado do `km_medio_mes`, recálculo a cada km novo, piso/teto |
| 5 | **BI perde comparabilidade** (cada oficina nomeia diferente) | `familia` obrigatória em todo item; cards atuais continuam por família |
| 6 | **Multi-tenant** ([ADR-0003](../adr/0003-multi-tenancy-via-rls-oficina-id.md)) | RLS em `servicos_catalogo`: item global legível por todos, item de oficina só pela dona; escrita service-role |
| 7 | **Foto + LGPD** | bucket privado, RLS, retenção definida, política de privacidade atualizada, ADR-0016 revisada |
| 8 | **Custo por cadastro sobe** (embedding + agente extra + storage) | etapas 1-2 do dedupe resolvem a maioria sem LLM; embedding é ~0,00002 USD/item; medir custo/cadastro na F2 |
| 9 | **Fadiga de lembrete** — com N serviços por veículo, o cliente pode receber 4 mensagens em 2 semanas | espaçamento mínimo de 7 dias por cliente no enqueue, com teto de adiamento (§3.6) |
| 10 | **Regressão dos agendamentos existentes** | migração mapeia os 4 tipos 1:1 para itens globais; `scheduled_at` já gravado não é recalculado |

---

## 5. Plano de fases

Estimativas de esforço de implementação (não de calendário).

### F0 — ADRs + Meta · bloqueante, esforço baixo, calendário 3-7 dias
- **Submeter `lembrete_servico` (4 params) à Meta** — caminho crítico; nada da F2 vai a produção sem isso. Template único: agrupamento ficou para depois (decisão 5).
- ADRs: novo (supersede 0014, inclui o guardrail de template revisado), revisão da 0016 (Storage para foto, retenção 24 meses), cadência por km.
- **Pronto quando**: ADRs aceitos e template submetido.

### F1 — Catálogo no banco, comportamento idêntico · 2-3 dias
- Migrations: `servicos_catalogo`, `produtos_catalogo`, RLS, `servicos.catalogo_id/produto_id`.
- Seed dos 4 tipos atuais como itens globais (mesmas cadências e templates); `marca_peca` → `produtos_catalogo`.
- RPCs (`register_service_with_reminder`, `enqueue_due_whatsapp_reminders`) leem o catálogo; `tipo_servico` vira derivado da `familia`.
- Backfill dos serviços existentes.
- **Testes**: regressão total sem mudar expectativa; migração idempotente; RLS.
- **Pronto quando**: nenhum comportamento observável mudou.

### F2 — Agente de catálogo + serviço livre · 5-8 dias
- Agente especialista, schema estruturado, pipeline de dedupe (trigram + embedding), perguntas com botões.
- Prompt/JSON Schema do onboarding sem o enum fechado.
- Intervalo por km ou tempo, com desambiguação e confirmação no card.
- Template genérico em uso; sanitizador de formato; `renderReminderTemplate` resolve por catálogo com fallback de família.
- Espaçamento mínimo de 7 dias por cliente no enqueue (§3.6), com instrumentação da frequência de colisão.
- **Testes**: dedupe (typos, sinônimos, faixa cinza), prompt-injection no nome do item, item fora do nicho, intervalo ambíguo, espaçamento e teto de adiamento, idempotência, custo por cadastro.
- **Pronto quando**: a oficina cadastra "correia dentada, 60 mil km" por WhatsApp e o lembrete sai na data certa, sem duplicar item.

### F3 — Produto, foto e km · 4-6 dias
- Marca/modelo/especificação canonizados; Storage privado + retenção; km (campos, coleta, conversão, auto-aprendizado, recálculo).
- Copy alinhada — a landing para de prometer o que não existe.
- **Testes**: conversão km↔data, recálculo, veículo sem histórico, upload/RLS de foto, retenção.
- **Pronto quando**: o card mostra "Próxima: ~52.000 km · 14/03/2027" com dado real e a foto fica acessível só para a oficina dona.

### F4 — Painel da oficina + admin/BI · 6-10 dias
- Login OTP (reuso), telas 1-3 do §3.7, RLS por sessão de oficina.
- `/admin/tipos-servico` → `/admin/catalogo-servicos`: catálogo global, mesclagem de duplicatas, visão por oficina, auditoria.
- Inteligência de mercado por família + **produto/marca** (a cohort Perfect vira market-share de qualquer peça).
- **Pronto quando**: a oficina edita o próprio catálogo pela web e o admin mescla duplicatas.

### F5 — Depois
Catálogo sugerido por perfil de oficina; agrupamento de lembretes (quando houver dado real de colisão); dashboard e retornos (Fase 4 original).

**O que NÃO entra**: agendamento no calendário da oficina ([ADR-0009](../adr/0009-confirmacao-vs-pre-agendamento.md)), preço por serviço ([ADR-0012](../adr/0012-politica-de-preco.md)), integração com sistema de gestão, telemetria de veículo.

---

## 6. Decisões

Todas fechadas em 2026-08-08.

1. ✅ **Catálogo livre no banco, alimentado por agente especialista** — entende o que o mecânico falou, canoniza, não duplica, pergunta quando tem dúvida. Guarda nome, marca, especificação técnica, modelo e **foto**. → §3.1, §3.2
2. ✅ **Intervalo por km ou tempo, interpretado do texto** — pergunta só quando não entender, usa botões para desambiguar, e nunca salva sem confirmação. → §3.3
3. ✅ **Guardrail de template revisado** — texto do catálogo (curado por IA + confirmado pela oficina) pode ser parâmetro. Permanece a sanitização de **formato**, que é exigência técnica da Meta. → §3.5
4. ✅ **Painel da oficina entra no planejamento** — começando pela tela de catálogo. → §3.7, F4
5. ✅ **Espaçar agora, agrupar depois** — mínimo de 7 dias entre lembretes do mesmo cliente; agrupamento fica para quando houver dado real de colisão. → §3.6
6. ✅ **Foto retida por 24 meses** — cobre o ciclo de lembrete mais longo (amortecedor, 730 dias), então a imagem ainda existe quando o cliente volta.

### Decisão 5 — o contexto, para quem ler depois

**O problema.** Hoje cada cliente tem essencialmente um serviço (óleo), então recebe um lembrete a cada 90 dias. Com catálogo aberto, o mesmo carro passa a ter vários serviços com ciclos diferentes: óleo a cada 90 dias, alinhamento a cada 6 meses, filtro de combustível a cada 12 meses, correia a cada 5 anos.

Ciclos diferentes **se cruzam**. Em algum mês, dois ou três lembretes caem na mesma semana:

> Seg — "Oi Roberto, está chegando a hora da próxima troca de óleo do seu Gol. Quer agendar?"
> Qua — "Oi Roberto, está chegando a hora do próximo alinhamento do seu Gol. Quer agendar?"
> Sex — "Oi Roberto, está chegando a hora da próxima troca do filtro de combustível do seu Gol. Quer agendar?"

Três mensagens que o cliente lê como spam — e spam no WhatsApp custa caro: bloqueio do cliente derruba a **qualidade do número da Meta**, que é o ativo mais frágil da operação.

| Opção | Como fica | Custo |
|---|---|---|
| **(a) Espaçar** ✅ escolhida | lembrete que cai a menos de 7 dias de outro do mesmo cliente é empurrado | baixo, nenhum template novo |
| (b) Agrupar | uma mensagem: "está na hora de: troca de óleo e alinhamento" | template novo + aprovação Meta + lógica de janela |
| (c) Medir primeiro | não faz nada; instrumenta e revisita com dado real | zero agora, risco de queimar número antes de medir |

**Decidido: (a) agora, (b) depois com dados.** Espaçar resolve o dano imediato com uma regra determinística no scheduler, sem depender da Meta. Agrupar é melhor experiência, mas exige aprovação de template e uma decisão de copy que fica melhor informada depois de ver a frequência real de colisão — que hoje é zero, porque só existe um serviço por cliente. Implementação em §3.6.

---

## 7. Impacto em documentação

Mudança de comportamento ⇒ doc na mesma entrega (regra do `CLAUDE.md`):

- **ADRs**: novo supersedendo [ADR-0014](../adr/0014-cadencia-e-template-por-tipo-de-servico.md); revisão da [ADR-0016](../adr/0016-suporte-imagem-pdf-sem-storage.md) (Storage para foto); cadência por km; guardrail de template revisado (pode entrar no ADR novo).
- **`regras-de-negocio.md`**: §3.2 (campos do cadastro), §3.6 (parâmetro `{{produto}}` — **regra P0-2 alterada**), §4.1 (cadências → catálogo), §5, §8.2 (templates), §12 (inteligência de mercado).
- **`glossary.md`**: verbete `lembrete`; verbetes novos `catálogo de serviços`, `família`, `produto canônico`, `cadência`.
- **`PRD-whatsapp-bot.md`** §10; **`telas-web.md`** (painel da oficina).
- **Prompts**: `.cursor/prompts/whatsapp-onboarding-agent.md`, `whatsapp-reminder-agent.md`, novo `whatsapp-catalogo-agent.md`, espelhos em `.codex/`.
- **Módulos**: `.context/modules/whatsapp-bot`, `database`, `painel-admin` (+ módulo novo se o painel da oficina virar fronteira própria).
- **[`product-knowledge.ts`](../../lib/whatsapp/product-knowledge.ts)**: o bot hoje **fala** as cadências de fábrica; passa a falar "a cadência é a que sua oficina definir".
- **Comercial**: [`playbook.ts`](../../lib/representante/content/playbook.ts) e copy da landing.
- **Privacidade**: `app/privacidade` e `app/exclusao-dados` se armazenarmos foto.

---

## 8. Resumo executivo

| | Hoje | Depois |
|---|---|---|
| Serviços | 4 fixos, no código | catálogo aberto, canonizado por agente |
| Produtos/peças | `marca_peca`, só amortecedor | base canônica de produtos (nome, marca, modelo, especificação, foto) |
| Cadência | dias, global, só admin muda | dias **ou km**, definida pela oficina |
| Quem configura | admin (deploy/painel interno) | o mecânico, por WhatsApp e por painel próprio |
| Template Meta | 1 por tipo (aprovação por serviço novo) | 1 genérico com o serviço como parâmetro |
| Km | inexistente (mas vendido na landing) | coletado, estimado e recalculado |
| Foto | descartada após leitura | armazenada e vinculada ao serviço |
| Posicionamento | "lembrete de troca de óleo" | infraestrutura de retorno da oficina |

**Caminho crítico**: aprovação do template genérico `lembrete_servico` na Meta (F0). F1 pode começar em paralelo, porque não muda comportamento observável.
