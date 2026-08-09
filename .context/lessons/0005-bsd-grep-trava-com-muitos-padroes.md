# LICAO 0005: `grep -F -f` com milhares de padroes trava no macOS

- **Data:** 2026-08-08
- **Modulo(s):** [[prospeccao]] (vale para qualquer script de shell do repo)
- **Severidade:** alta
- **Descoberta por:** o dono do projeto notando que um job estava "rodando" ha 1h32

## Sintoma
Um filtro de arquivo grande roda **para sempre** sem erro, sem output e sem terminar. O
processo aparece vivo e consumindo CPU, o que faz parecer progresso. Nada no log, nenhum
codigo de saida — indistinguivel de "esta trabalhando".

No caso concreto: `unzip -p Empresas0.zip | grep -F -f raizes.txt` com 5.428 raizes de CNPJ
contra ~66 milhoes de linhas. Passou de **1h30 sem terminar**. O equivalente em `awk` levou
**57 segundos**.

## Causa
O GNU grep implementa Aho-Corasick para `-F -f`: casa todos os padroes numa passada, custo
praticamente independente da quantidade. **O grep do macOS (BSD) nao tem essa otimizacao** —
ele compara padrao a padrao, o que da O(linhas x padroes). Com 5.428 x 66.000.000 o numero de
comparacoes explode.

Com **um** padrao o BSD grep e rapido — foi o que mascarou o problema: o script irmao
(`baixar-rfb.sh`, um unico codigo de municipio) rodava em ~2 min por arquivo e passou a falsa
confianca de que a abordagem escalava.

## Como evitar / resolver
Para casar muitas chaves contra muitas linhas, usar `awk` com array associativo — hash O(1)
por linha, e de quebra permite casar a **coluna certa** em vez de qualquer posicao da linha:

```bash
awk -F';' 'NR==FNR { chaves[$0] = 1; next }
           { k = $1; gsub(/"/, "", k); if (k in chaves) print }' chaves.txt - 
```

Regras que ficam:
- **`grep -F -f` so com poucos padroes** (dezenas). Acima disso, `awk`, ou `ggrep` se houver
  certeza de que o GNU grep esta instalado — o que num Mac limpo nao esta.
- Nao assumir ferramenta GNU em script de shell deste repo: o ambiente de desenvolvimento e
  macOS. Vale tambem para `sed -i`, `date -d`, `readlink -f`, `xargs -r`, `stat -c`.
- **Job longo precisa de sinal de progresso.** Se aquele filtro imprimisse uma linha a cada N
  registros, a travada teria aparecido em segundos em vez de em uma hora e meia.

## Referencias
- `scripts/prospeccao/baixar-rfb-empresas.sh` — filtro em `awk`, com o porque no comentario
- [Licao 0004](./0004-rfb-nao-tem-o-nono-digito.md) — a outra armadilha da mesma ingestao
