# ADR 0032: Fotos de serviço no Supabase Storage, retenção de 24 meses (revisão da ADR-0016)

- **Status**: accepted
- **Data**: 2026-08-08
- **Decisores**: Anderson Domingos
- **Revisa**: [ADR-0016](./0016-suporte-imagem-pdf-sem-storage.md) (ponto 2 — "sem Supabase Storage, bytes descartados após processamento")
- **Fonte**: [`docs/product/pivot-catalogo-de-servicos.md`](../product/pivot-catalogo-de-servicos.md) (decisões 1 e 6 do dono, fechadas em 2026-08-08)

## Contexto

A ADR-0016 decidiu processar imagem/PDF de forma síncrona **sem armazenar a mídia bruta**: bytes baixados da Cloud API, passados ao vision e descartados. Na época a foto era só insumo de extração (odômetro, placa, valor).

O pivot do catálogo (ADR-0031) muda o papel da foto: ela passa a ser **evidência do serviço e do produto** — foto da peça, da nota, do painel — vinculada ao registro e à base canônica de produtos. A decisão do dono foi explícita: "a gente pode receber também uma foto, e tudo isso será armazenado". O que a ADR-0016 descartava por não ter uso, agora tem uso.

O restante da ADR-0016 **permanece válido**: processamento síncrono no webhook, vision com `gpt-4o-mini`, PDF com `unpdf`, timeouts, rate limit por oficina, fallback contextual.

## Decisão

**Fotos recebidas no fluxo de cadastro de serviço passam a ser persistidas em bucket privado do Supabase Storage, escopadas por oficina, com retenção de 24 meses. O armazenamento é best-effort: falha de upload nunca bloqueia o cadastro nem o pipeline de vision.**

1. **Bucket privado `fotos-servicos`**, path `oficina_id/servico_id/{media_id}.jpg`. Nenhum acesso público; leitura via URL assinada de curta duração, só para a oficina dona (painel, F4) e para o admin.
2. **RLS/policy por oficina** no storage (`storage.objects`), coerente com a ADR-0003. Escrita apenas via service-role (o webhook roda server-side).
3. **`servicos.foto_path`** guarda o path; `media_id` original continua em `raw_payload` (rastreabilidade, como hoje).
4. **Retenção 24 meses**: job mensal (pg_cron, mesmo padrão dos crons existentes) remove objetos com mais de 730 dias e limpa `foto_path`. 24 meses cobre o ciclo de lembrete mais longo hoje (amortecedor, 730d) — a foto ainda existe quando o cliente volta.
5. **Ordem no webhook**: download → upload ao Storage (best-effort, timeout curto) → vision → descarte dos bytes em memória. Se o upload falhar, loga e segue — o comportamento atual (ADR-0016) é o piso.
6. **LGPD**: `app/privacidade` e `app/exclusao-dados` passam a declarar o armazenamento de imagens e o prazo; o fluxo de exclusão de dados remove também os objetos do Storage da oficina/cliente. Publicar a política atualizada é pré-condição para ativar o armazenamento em produção.

## Alternativas consideradas

- **Continuar descartando (ADR-0016 como está)** — Descartado pelo dono. Sem foto persistida não há evidência do serviço, nem base visual de produtos, nem exibição no painel da oficina.
- **Retenção indefinida** — Descartado. Custo crescente e exposição LGPD sem ganho claro além de 24 meses.
- **Retenção 12 meses** — Descartado. A foto sumiria antes do lembrete de itens de ciclo longo (amortecedor, correia).
- **Armazenar em provedor externo (S3)** — Descartado. Supabase Storage já está no stack, com RLS integrada ao modelo multi-tenant existente.
- **Upload síncrono obrigatório (falha bloqueia cadastro)** — Descartado. A foto é complemento; o cadastro e o lembrete são o produto. Best-effort preserva a resiliência da ADR-0016.

## Consequências

### Positivas

- Evidência visual do serviço vinculada ao registro; base de produtos ganha lastro real.
- Painel da oficina (F4) pode exibir a foto do serviço.
- Retenção definida e automatizada — sem acúmulo indefinido.

### Negativas / trade-offs

- Custo de storage novo (previsível: limite diário de mídia por oficina já existe — `WHATSAPP_MEDIA_DAILY_LIMIT`).
- Superfície LGPD maior: política de privacidade e fluxo de exclusão precisam ser atualizados **na mesma entrega** (pré-condição de ativação).
- Mais um passo no webhook síncrono (mitigado: best-effort com timeout curto).

## Referências

- [ADR-0016](./0016-suporte-imagem-pdf-sem-storage.md) — tudo que esta revisão não toca permanece vigente.
- [ADR-0003](./0003-multi-tenancy-via-rls-oficina-id.md) — multi-tenancy por `oficina_id`.
- [ADR-0031](./0031-catalogo-aberto-servicos-produtos.md) — o catálogo que dá uso à foto.
- `lib/whatsapp/image-vision.ts`, `lib/whatsapp/webhook-handler.ts`, `app/privacidade`, `app/exclusao-dados`.
- Plano de execução: [`docs/backlog-catalogo-servicos/README.md`](../backlog-catalogo-servicos/README.md) (fase F3).
