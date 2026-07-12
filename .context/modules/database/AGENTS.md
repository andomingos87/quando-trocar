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

## Fluxo de trabalho
- Migrations seguem as fases (ver prefixos `phase_*` no nome). Ao criar tabela/coluna nova, checar
  se precisa de indice de FK e de RLS antes de aplicar.
- Rodar advisors do Supabase apos mudanca de schema (ver instrucoes do MCP Supabase / runbooks).

## Testes
- Cobertura indireta via testes de repositorio (`tests/whatsapp-repository.test.ts`) e de dominio admin.

## Referencias
- Runbooks de migration: `docs/runbooks/`
- Glossario (tabelas/termos): `docs/glossary.md`
- Convencoes: `.context/conventions.md`
- Regras Supabase: `AGENTS.md` (secao Supabase Rules)
- Licoes: `.context/lessons/0001-security-definer-grants-vazam.md`,
  `.context/lessons/0002-deploy-corre-na-frente-das-migrations.md`
