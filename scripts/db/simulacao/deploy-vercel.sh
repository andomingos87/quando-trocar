#!/usr/bin/env bash
# Sobe (ou atualiza) o preview público da simulação no Vercel a partir de uma cópia limpa do HEAD.
# Projeto Vercel separado ("quando-trocar-simulacao"), deploy de arquivos locais — não toca no
# projeto de produção nem no .vercel/ deste repositório.
#
#   scripts/db/simulacao/deploy-vercel.sh <scope-vercel>        # ex.: aureas-projects-ca9dee86
#
# Pré-requisitos: `vercel login` feito, `.env.simulacao` presente (SUPABASE_URL/SERVICE_ROLE da
# simulação + ADMIN_OTP_DEV_BYPASS_CODE + REP_OTP_DEV_BYPASS_CODE). Envs só são criadas na
# primeira execução (usa `vercel env ls` para não duplicar).
set -euo pipefail

SCOPE="${1:?informe o scope/time do Vercel (vercel teams ls)}"
PROJECT="${VERCEL_SIM_PROJECT:-quando-trocar-simulacao}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$REPO/.env.simulacao" ] || { echo "faltou .env.simulacao"; exit 1; }
set -a; . "$REPO/.env.simulacao"; set +a
case "$SUPABASE_URL" in *fplkasckmvvccnkrkszr*) ;; *) echo "RECUSADO: SUPABASE_URL não é o projeto de simulação"; exit 1;; esac

git -C "$REPO" archive HEAD | tar -x -C "$WORK"
cd "$WORK"
vercel link --yes --scope "$SCOPE" --project "$PROJECT"

existentes="$(vercel env ls production --scope "$SCOPE" 2>/dev/null || true)"
addenv() {
  if printf '%s' "$existentes" | grep -q "^ *$1 "; then echo "env $1 já existe"; return; fi
  printf '%s' "$2" | vercel env add "$1" production --yes --scope "$SCOPE" >/dev/null
  echo "env $1 criada"
}
addenv SUPABASE_URL "$SUPABASE_URL"
addenv SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
addenv ADMIN_SESSION_SECRET "$(openssl rand -hex 32)"
addenv REP_SESSION_SECRET "$(openssl rand -hex 32)"
addenv ADMIN_OTP_DEV_BYPASS_CODE "$ADMIN_OTP_DEV_BYPASS_CODE"
addenv REP_OTP_DEV_BYPASS_CODE "$REP_OTP_DEV_BYPASS_CODE"
addenv WHATSAPP_VERIFY_TOKEN "$(openssl rand -hex 16)"
addenv NEXT_PUBLIC_SITE_URL "https://$PROJECT.vercel.app"
addenv NEXT_PUBLIC_WHATSAPP_NUMBER "5500900000000"
addenv NEXT_PUBLIC_CONTACT_EMAIL "contato@quandotrocar.com.br"
addenv INADIMPLENCIA_DIAS_GRACE "7"
# Propositalmente SEM: WHATSAPP_ACCESS_TOKEN, OPENAI_API_KEY, ASAAS_*, MERCADO_PAGO_*, WINDSOR_API_KEY, INTERNAL_JOB_SECRET.

vercel --prod --yes --scope "$SCOPE"
