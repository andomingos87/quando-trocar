# LICAO 0001: SECURITY DEFINER em `public` continua chamavel por anon/authenticated mesmo apos revogar de `public`

- **Data:** 2026-07-12
- **Modulo(s):** [[database]], [[billing]] (funcoes de Vault `set/get/payment_secret_exists`)
- **Severidade:** media
- **Descoberta por:** advisors de seguranca do Supabase (lints 0028/0029) + code review

## Sintoma
Voce cria uma funcao `SECURITY DEFINER` no schema `public` e faz `revoke all ... from public`.
Parece trancada. Mas ela continua exposta na API REST em `POST /rest/v1/rpc/<funcao>` e
executavel pelos papeis `anon` e `authenticated` — no caso de segredos (ex.: `get_payment_secret`),
isso vazaria o valor em claro para qualquer chamada nao autenticada.

## Causa
O Supabase concede `EXECUTE` a `anon` e `authenticated` por *default privileges* no schema `public`.
Esses grants sao **explicitos** para cada papel — `revoke ... from public` nao os remove, porque
`public` (o pseudo-papel) e um conjunto distinto dos grants nominais a `anon`/`authenticated`.
Com `SECURITY DEFINER`, a funcao roda com os privilegios do dono, entao a exposicao e real.

## Como evitar / resolver
- Ao criar funcao `SECURITY DEFINER` em `public`, **sempre**:
  `revoke all on function public.<fn>(<args>) from public, anon, authenticated;`
  e conceder so a quem precisa: `grant execute on function public.<fn>(...) to service_role;`
- Funcao que so o backend usa (segredos, jobs) nunca deve ter `EXECUTE` para `anon`/`authenticated`.
- **Event trigger functions** (ex.: `rls_auto_enable()`) nao precisam de `EXECUTE` de nenhum papel de
  API — disparam pelo dono no contexto do evento. Revogar de `anon`/`authenticated` e seguro e nao
  afeta o disparo.
- **Rode os advisors de seguranca do Supabase apos qualquer DDL de funcao** — eles pegam exatamente
  esse vazamento (lints `anon_/authenticated_security_definer_function_executable`).

## Referencias
- `supabase/migrations/20260712120000_gateway_pagamento_asaas.sql` (Vault: `set/get/payment_secret_exists`, com revoke nominal).
- `supabase/migrations/20260712150000_harden_rls_auto_enable_grants.sql` (correcao de `rls_auto_enable`).
- `.context/modules/billing/AGENTS.md` (segredos no Vault, so `service_role`).
- `docs/regras-de-negocio.md` §9.5 (gateway/segredos).
