#!/usr/bin/env bash
# Segundo passo do enriquecimento: baixa os arquivos de Empresas dos Dados Abertos do
# CNPJ e filtra apenas as raizes de CNPJ que a ingestao de estabelecimentos ja
# selecionou. Traz razao social e porte, que nao existem no arquivo de Estabelecimentos.
#
# Ordem de uso:
#   1) scripts/prospeccao/baixar-rfb.sh 2026-07 6477
#   2) npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477
#        (grava a base e escreve .data/rfb/<comp>/cnpjs-basicos-<municipio>.txt)
#   3) scripts/prospeccao/baixar-rfb-empresas.sh 2026-07 6477
#   4) repetir (2) — o upsert e idempotente e so complementa razao social e porte
#
# Sao ~1,3 GB, contra os ~5,3 GB dos estabelecimentos: o filtro por raiz de CNPJ e o
# que torna esse passo barato.

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
PREFIXOS="${DEST}/cnpjs-basicos-${MUNICIPIO}.txt"
SAIDA="${DEST}/empresas-${MUNICIPIO}.csv"

if [[ ! -s "$PREFIXOS" ]]; then
  echo "arquivo de raizes nao encontrado ou vazio: $PREFIXOS" >&2
  echo "rode antes: npm run prospeccao:ingerir -- --municipio ${MUNICIPIO} ..." >&2
  exit 1
fi

mkdir -p "$DEST"
: > "$SAIDA"

# Filtro com awk e nao com `grep -F -f`: sao ~5 mil raizes contra ~66 milhoes de linhas,
# e o grep do macOS (BSD) nao tem a otimizacao multi-padrao do GNU grep — ele compara
# padrao a padrao, o que na pratica trava (medido: >1h30 sem terminar, contra 57s aqui).
# De quebra o awk casa a raiz na COLUNA 1 exata, em vez de em qualquer lugar da linha.
FILTRO='NR==FNR { raizes[$0] = 1; next } { chave = $1; gsub(/"/, "", chave); if (chave in raizes) print }'

for i in 0 1 2 3 4 5 6 7 8 9; do
  arquivo="Empresas${i}.zip"
  zip="${DEST}/${arquivo}"

  if [[ -f "$zip" ]]; then
    echo "[$(date +%H:%M:%S)] ${arquivo} ja baixado, reaproveitando"
  else
    echo "[$(date +%H:%M:%S)] baixando ${arquivo}..."
    curl -fsS --retry 3 --retry-delay 5 --max-time 3600 \
      -u "${SHARE_TOKEN}:" "${BASE}/${arquivo}" -o "$zip"
  fi

  echo "[$(date +%H:%M:%S)] filtrando ${arquivo}..."
  unzip -p "$zip" | LC_ALL=C awk -F';' "$FILTRO" "$PREFIXOS" - >> "$SAIDA"

  rm -f "$zip"
  echo "[$(date +%H:%M:%S)] ${arquivo} ok — $(wc -l < "$SAIDA" | tr -d ' ') linhas acumuladas"
done
echo "[$(date +%H:%M:%S)] concluido: $SAIDA"
