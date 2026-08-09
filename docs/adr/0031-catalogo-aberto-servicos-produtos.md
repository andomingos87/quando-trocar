# ADR 0031: Catálogo aberto de serviços e produtos, canonizado por agente

- **Status**: accepted
- **Data**: 2026-08-08
- **Decisores**: Anderson Domingos
- **Supersede**: [ADR-0014](./0014-cadencia-e-template-por-tipo-de-servico.md) (cadência e template Meta por tipo de serviço)
- **Fonte**: [`docs/product/pivot-catalogo-de-servicos.md`](../product/pivot-catalogo-de-servicos.md) (decisões 1, 2, 3 e 5 do dono, fechadas em 2026-08-08)

## Contexto

O produto nasceu como "lembrete de troca de óleo" e a ADR-0014 abriu espaço para amortecedor e revisão — mas via **enum fechado de 4 valores** (`troca_oleo | amortecedor | revisao | outro`), com cadência e template Meta definidos globalmente pelo admin. Correia dentada, fluido de freio, filtro, alinhamento, bateria — tudo cai em `outro` com 180 dias, errado para quase todos. A oficina não consegue expressar o próprio negócio no produto.

O discurso já pivotou antes do banco: a regra de negócio promete "qualquer peça ou serviço automotivo com retorno previsível" (`regras-de-negocio.md §2`), e a landing vende monitoramento por km. O posicionamento real é **infraestrutura de retorno**, não lembrete de óleo.

A decisão do dono: o mecânico fala livremente o que fez (texto, áudio ou foto); um agente especialista entende, canoniza e cadastra — sem duplicar, perguntando quando tiver dúvida — montando uma base sólida de produtos e serviços de manutenção automotiva com nome, marca, modelo e especificação técnica.

## Decisão

**O enum fechado sai; entra um catálogo aberto em duas tabelas, alimentado por um agente de canonização com dedupe determinístico em cascata, confirmação da oficina antes de criar, e um template Meta genérico cujo parâmetro de serviço vem exclusivamente do catálogo curado.**

### 1. Duas entidades canônicas

- **`servicos_catalogo`** — *o que foi feito* (gera cadência). Escopo duplo: `oficina_id = null` é item **global** (seed curado por nós, entrega valor no minuto zero); `oficina_id` preenchido é item da oficina. Campos: `slug`, `nome`, `familia`, `produto_label`, `aliases[]`, `embedding vector(1536)`, `base` (`tempo|km|ambos`), `intervalo_dias`, `intervalo_km`, `template_name` (null = genérico), `origem`, `ativo`.
- **`produtos_catalogo`** — *o que foi usado* (peça/produto; dado de mercado). Escopo **global**: "Perfect" é Perfect para toda oficina, e é essa consolidação que vira a base de dados. Campos: `slug`, `nome`, `marca`, `modelo`, `especificacao`, `familia`, `embedding`, `origem`, `ativo`.
- `servicos.catalogo_id` (obrigatório após backfill) e `servicos.produto_id` (opcional) ligam o registro operacional ao catálogo. `servicos.marca_peca` migra para `produtos_catalogo.marca` preservando o histórico Perfect.

### 2. `tipo_servico` vira `familia` — e permanece

O enum atual sobrevive como **família** obrigatória de todo item de catálogo (`troca_oleo | amortecedor | revisao | outro`), derivada, nunca mais informada diretamente. É o que mantém: os 4 cards de `/admin/inteligencia-mercado` (incl. cohort Perfect) sem reescrita, um eixo comparável entre oficinas, e um fallback seguro de copy quando o item não tiver label utilizável.

### 3. Agente de canonização com dedupe em cascata

O agente **não substitui** a extração de cadastro (ADR-0027) — roda depois dela, sobre o campo `servico`. Pipeline barato → caro, LLM só no fim:

1. **slug/alias exato** (normalizado: sem acento, caixa, plural) → match ⇒ usa, custo zero;
2. **`pg_trgm similarity()` ≥ 0.6** → gera candidatos;
3. **embedding** (`text-embedding-3-small`, HNSW cosine — mesma infra da FAQ CV5) → ≥ 0.90 usa · 0.75–0.90 **pergunta** · < 0.75 candidato a novo;
4. **LLM** (Structured Outputs `strict`) decide entre candidatos ambíguos, valida que o item é do nicho automotivo e propõe o item novo (`nome`, `familia`, `produto_label`, `aliases`, produto com marca/modelo/especificação quando houver).

**Limite de autoridade (ADR-0001 intacta):** o agente pode *usar* item existente sozinho. **Criar** item, definir intervalo ou vincular produto exige confirmação explícita da oficina no card (ADR-0017). Na faixa cinza de similaridade o agente **pergunta, nunca cria**. Toda criação vira `agent_tool_calls` auditável.

### 4. Intervalo informado pela oficina, em km ou tempo

Interpretação livre primeiro ("a cada 60 mil", "todo ano"); pergunta só quando não entender, com reply buttons como atalho de desambiguação (máx. 3, limite da Cloud API); **nunca salva sem confirmação**. Limites sanitários no schema: 7–3650 dias, 500–300.000 km. Km é convertido em data (ADR-0033).

### 5. Guardrail de template revisado (revisão da regra P0-2)

A regra "nenhum texto livre da oficina vira parâmetro de template" (`regras-de-negocio.md §3.6`) passa a ser:

> **Só texto já canonizado no catálogo entra como parâmetro de template.** O valor nunca vem da fala crua da oficina: vem de `servicos_catalogo.produto_label`, criado pelo agente de canonização e confirmado pela oficina antes de existir.

Permanecem no código, por serem requisito técnico da Cloud API (não julgamento de conteúdo): sanitização de formato (sem quebra de linha/tab/4+ espaços — parâmetro inválido falha o envio em runtime) e limite de tamanho (~40 chars). `PRODUCT_LABEL_BY_TIPO` deixa de ser a fonte do `{{produto}}` e vira o **fallback por família** quando o item não tiver `produto_label` válido.

### 6. Template Meta genérico

`lembrete_servico` (Utility, pt_BR, 4 parâmetros): `Oi {{1}}, aqui é da {{2}}. Está chegando a hora da próxima {{4}} do seu {{3}}. Quer agendar?` — `{{4}}` = `produto_label`. Os 3 templates da ADR-0014 continuam válidos para os itens globais (o item pode fixar `template_name`), então nada quebra enquanto o genérico não é aprovado. Aprovação Meta é pré-condição de produção (erro 132001 se ativado antes — ADR-0005).

### 7. Espaçamento mínimo entre lembretes (anti-fadiga)

Com N serviços por veículo, ciclos se cruzam e o mesmo cliente receberia várias mensagens na mesma semana — spam derruba o quality rating da Meta. Regra determinística no `enqueue_due_whatsapp_reminders`: lembrete cujo cliente recebeu/receberá outro há menos de `oficinas.dias_min_entre_lembretes` (default 7) é **adiado**, com motivo registrado e teto de adiamento (30 dias). Agrupamento numa mensagem só fica para quando houver dado real de colisão (exigiria template novo).

## Alternativas consideradas

- **Manter o enum e só adicionar valores** — Descartado. Cada serviço novo viraria deploy + migration; nunca cobre a cauda longa do nicho.
- **Catálogo 100% por oficina (sem camada global)** — Descartado. Catálogo vazio no dia 1 mata o onboarding por WhatsApp, o momento mais frágil do funil; e sem eixo global o BI perde comparabilidade.
- **Catálogo 100% global (oficina não cria)** — Descartado. Reintroduz o gargalo do admin que o pivot quer eliminar.
- **Label da oficina com fila de revisão manual no admin antes de entrar em template** (proposta v1 do doc de pivot) — Descartada pelo dono em favor da curadoria por agente + confirmação da oficina. O admin mantém visão e mesclagem de duplicatas a posteriori, mas não é gate síncrono.
- **LLM decide sozinho criar item de catálogo** — Descartado. Violaria a ADR-0001; criação é estado de negócio e exige confirmação humana.

## Consequências

### Positivas

- Qualquer serviço automotivo com retorno previsível vira lembrete — o produto deixa de estar preso ao óleo.
- Base canônica de serviços e produtos (marca, modelo, especificação) — ativo de dados que generaliza a inteligência de mercado além do cohort Perfect.
- Oficina configura o próprio negócio sem admin e sem deploy.
- Um único template Meta cobre a cauda longa; serviço novo não espera aprovação da Meta.

### Negativas / trade-offs

- Custo por cadastro sobe (trgm + embedding + eventualmente agente). Mitigado: etapas 1–2 resolvem a maioria sem LLM; medir custo/cadastro na entrega.
- Duplicata residual no catálogo é possível apesar da cascata; admin ganha ferramenta de mesclagem (fase F4 do plano).
- Um `produto_label` mal curado chega ao cliente final. Mitigado: validador de formato, fallback por família, confirmação da oficina, auditoria.
- `tipos_servico_default` vira redundante (mantida como fallback até a desativação formal).

## Referências

- [`docs/product/pivot-catalogo-de-servicos.md`](../product/pivot-catalogo-de-servicos.md) — mapeamento completo e decisões.
- [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md), [ADR-0005](./0005-templates-meta-vs-mensagem-livre.md), [ADR-0017](./0017-confirmacao-antes-de-registrar-troca.md), [ADR-0027](./0027-extracao-de-cadastro-por-llm.md).
- [ADR-0032](./0032-storage-fotos-servico.md) (foto), [ADR-0033](./0033-cadencia-por-km.md) (km).
- Plano de execução: [`docs/backlog-catalogo-servicos/README.md`](../backlog-catalogo-servicos/README.md).
