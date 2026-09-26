# Modulo: database

Schema, migrations e politicas de acesso do Supabase Postgres. E a fronteira compartilhada por
todos os outros modulos — mudanca aqui reverbera em bot, admin e billing.

## Fronteiras

**Pertence a este modulo:**
- `supabase/migrations/*.sql` — schema versionado.
- `lib/supabase/admin.ts` — cliente server-side (service role).
- Politicas RLS e indices declarados nas migrations.

**NAO pertence:** logica de dominio que consome o banco (fica no modulo dono do dominio:
[[whatsapp-bot]], [[painel-admin]], [[billing]]).

## Regras/invariantes do modulo
- **Nunca editar migration ja aplicada** — criar uma nova com timestamp (`YYYYMMDDHHMMSS_descricao.sql`).
- RLS habilitada em tabelas expostas a usuarios autenticados; acesso do app e majoritariamente
  server-side via service role. **Todo dado de oficina escopado por `oficina_id`.**
- Preferir indices unicos para provider IDs e chaves de negocio (garante idempotencia no nivel do banco)
  em vez de checagem de duplicata so na aplicacao.
- Guardar payloads crus de provider para auditoria; nao expor ao usuario da oficina por padrao.
- `SUPABASE_SERVICE_ROLE_KEY` so no servidor; nunca em `NEXT_PUBLIC_`.
- Mudanca de schema que altera comportamento de produto deve atualizar `docs/regras-de-negocio.md`.

## Catalogo de servicos (ADR-0031, fase F1)

Fonte da cadencia e do template de cada lembrete. Duas tabelas service-role only (RLS habilitada
sem policy; a leitura pelo painel da oficina entra na F4):

- **`servicos_catalogo`** — o que foi feito. Escopo duplo: `oficina_id is null` = item global,
  preenchido = item da oficina. Unicidade de slug por escopo via indice de expressao
  (`coalesce(oficina_id, uuid-zero), slug`).
- **`produtos_catalogo`** — o que foi usado. Sempre global; `slug` unico.
- `servicos.catalogo_id` / `servicos.produto_id` ligam o operacional ao catalogo.

Invariantes que nao podem quebrar:

- **O seed dos 4 itens globais e um espelho de `tipos_servico_default`** (mesma cadencia, mesmo
  template). E o que garante o comportamento identico da F1. Guardado por
  `tests/catalogo-servicos.test.ts` — mudar um lado sem o outro quebra o teste, nao a producao.
- **`padrao_familia`**: no maximo um item default por familia em cada escopo (indice unico
  parcial). E a ponte `familia -> item` do `register_service_with_reminder`; sem ele a resolucao
  vira ambigua e a cadencia cai no fallback legado em silencio.
- **Cascata de cadencia**: item da oficina > item global > `tipos_servico_default` >
  `oficinas.dias_lembrete_padrao`. Nenhum degrau pode ser removido sem migrar o anterior.
- Item com `base = 'km'` e sem `intervalo_dias` e valido: a cadencia cai para o proximo degrau
  ate a F3 converter km em data (ADR-0033).
- `produto_label` e a unica origem permitida de texto de servico em parametro de template
  (ADR-0031 §5). Fallback por familia vive em `lib/whatsapp/service-confirmation.ts`.
- `match_servicos_catalogo` e `security definer`: search_path fixo e `revoke` nominal de
  anon/authenticated (licao 0001).

## Simulacao de dados (scripts/db/simulacao)

Gerador deterministico (`npm run sim:gerar|sim:verificar|sim:purgar`) que popula o projeto Supabase
**de simulacao** (`fplkasckmvvccnkrkszr`) com 197 oficinas pagantes e 6 meses de historia. Le a
config do banco (planos, catalogo global, FAQ, admin) e escreve as tabelas transacionais na ordem
das FKs. Runbook: `docs/runbooks/simulacao-dados.md`; premissas: `docs/simulacao/`.

Invariantes:
- Recusa qualquer ref que nao seja o de simulacao (producao esta em lista negra no codigo).
- Telefones sempre `+5500/+5501/+5502` (DDDs inexistentes) — chave de purge e garantia de que
  nada alcanca gente real.
- Nunca deixa `lembretes.pendente` no passado nem outbox pendente antigo.
- O copy do bot vive espelhado em `scripts/db/simulacao/lib/copy.ts`: mudou o texto em
  `lib/whatsapp/*`, atualiza la (e' dado de teste, nao regra de produto).

## Fluxo de trabalho
- Migrations seguem as fases (ver prefixos `phase_*` no nome). Ao criar tabela/coluna nova, checar
  se precisa de indice de FK e de RLS antes de aplicar.
- Rodar advisors do Supabase apos mudanca de schema (ver instrucoes do MCP Supabase / runbooks).

## Testes
- Cobertura indireta via testes de repositorio (`tests/whatsapp-repository.test.ts`) e de dominio admin.
- `tests/catalogo-servicos.test.ts` le as migrations do catalogo e valida o contrato entre elas
  (espelho do seed, slug do produto, revoke das funcoes, corpo do lembrete inalterado). Nao toca o
  banco — a validacao contra o banco real e manual (advisors, `list_migrations`, backfill).

## Referencias
- Runbooks de migration: `docs/runbooks/`
- Glossario (tabelas/termos): `docs/glossary.md`
- Convencoes: `.context/conventions.md`
- Regras Supabase: `AGENTS.md` (secao Supabase Rules)
- Licoes: `.context/lessons/0001-security-definer-grants-vazam.md`,
  `.context/lessons/0002-deploy-corre-na-frente-das-migrations.md`
