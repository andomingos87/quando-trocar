# LICAO 0002: o deploy do codigo corre na frente das migrations

- **Data:** 2026-07-12
- **Modulo(s):** [[database]] (e entrega/deploy — ver `.context/conventions.md`)
- **Severidade:** media
- **Descoberta por:** operacao — erro em runtime apos deploy de mudanca de schema

## Sintoma
Voce faz `push` na `main`, a Vercel builda e sobe o codigo novo em segundos. Mas a coluna/tabela
que esse codigo usa **ainda nao existe** no banco, e a aplicacao quebra em runtime
(`column "X" does not exist`, `relation "Y" does not exist`) ate a migration ser aplicada a parte.

## Causa
Sao dois passos **separados e sem gate entre si**: (1) o deploy do codigo e git-integrado na Vercel
(sobe no push); (2) a aplicacao das migrations do Supabase e um passo manual/independente. Nada
garante que o schema chegue antes do codigo. Logo o codigo pode chegar primeiro.

## Como evitar / resolver
- **Aplicar a migration ANTES** de subir o codigo que depende dela (schema primeiro, codigo depois).
- Preferir mudancas **aditivas e retrocompativeis**: coluna nullable / com default, backfill num passo
  seguinte, ler colunas novas com fallback. Assim o codigo antigo e o novo convivem durante a janela.
- **Depois de um deploy que mexe em schema, conferir a lista de migrations aplicadas vs. os arquivos**
  em `supabase/migrations/` — se um arquivo existe mas nao consta como aplicado, aplique.
- Nunca editar migration ja aplicada; sempre criar uma nova (ver [[database]]).

## Referencias
- `.context/conventions.md` (secao Entrega: deploy git-integrado na Vercel, sem GitHub Actions).
- `.context/modules/database/AGENTS.md` (regras de migration).
