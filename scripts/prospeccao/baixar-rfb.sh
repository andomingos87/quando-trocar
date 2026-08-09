#!/usr/bin/env bash
# Baixa os arquivos de Estabelecimentos/Empresas dos Dados Abertos do CNPJ (Receita Federal)
# e pre-filtra por municipio, em streaming, para nao materializar ~20GB de CSV em disco.
#
# A RFB publica via Nextcloud publico (share token abaixo), nao por path direto:
#   https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9
# O download real sai pelo WebDAV do share, autenticando com o token como usuario.
#
# Uso:
#   scripts/prospeccao/baixar-rfb.sh <competencia> <codigo-municipio-rfb>
#   scripts/prospeccao/baixar-rfb.sh 2026-07 6477      # Guarulhos/SP
#
# O codigo do municipio e o da RFB (tabela Municipios.zip), NAO o do IBGE.
# Saida: .data/rfb/<competencia>/estabelecimentos-<municipio>.csv (pre-filtro grosso;
# o filtro exato por coluna e feito pelo parser em lib/prospeccao/rfb-parser.ts).

set -euo pipefail

COMPETENCIA="${1:-}"
MUNICIPIO="${2:-}"

if [[ -z "$COMPETENCIA" || -z "$MUNICIPIO" ]]; then
  echo "uso: $0 <competencia AAAA-MM> <codigo-municipio-rfb>" >&2
  exit 1
fi

SHARE_TOKEN="YggdBLfdninEJX9"
BASE="https://arquivos.receitafederal.gov.br/public.php/webdav/${COMPETENCIA}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="${RAIZ}/.data/rfb/${COMPETENCIA}"
SAIDA="${DEST}/estabelecimentos-${MUNICIPIO}.csv"

mkdir -p "$DEST"
: > "$SAIDA"

baixar_e_filtrar() {
  local arquivo="$1" padrao="$2" destino="$3"
  local zip="${DEST}/${arquivo}"

  if [[ -f "$zip" ]]; then
    echo "[$(date +%H:%M:%S)] ${arquivo} ja baixado, reaproveitando"
  else
    echo "[$(date +%H:%M:%S)] baixando ${arquivo}..."
    curl -fsS --retry 3 --retry-delay 5 --max-time 3600 \
      -u "${SHARE_TOKEN}:" "${BASE}/${arquivo}" -o "$zip"
  fi

  echo "[$(date +%H:%M:%S)] filtrando ${arquivo}..."
  # unzip -p envia o CSV para stdout; nada de ~2GB de texto tocando o disco.
  # LC_ALL=C porque o arquivo e latin-1 e o grep so precisa casar bytes ASCII.
  unzip -p "$zip" | LC_ALL=C grep "$padrao" >> "$destino" || true

  rm -f "$zip"
  echo "[$(date +%H:%M:%S)] ${arquivo} ok — $(wc -l < "$destino" | tr -d ' ') linhas acumuladas"
}

for i in 0 1 2 3 4 5 6 7 8 9; do
  # Pre-filtro grosso: o codigo do municipio aparece entre aspas em alguma coluna.
  # Pode dar falso positivo (numero do endereco, p.ex.); o parser valida a coluna certa.
  baixar_e_filtrar "Estabelecimentos${i}.zip" "\"${MUNICIPIO}\"" "$SAIDA"
done

echo "[$(date +%H:%M:%S)] concluido: $SAIDA"
