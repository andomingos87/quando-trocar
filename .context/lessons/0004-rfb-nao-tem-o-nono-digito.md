# LICAO 0004: a base da Receita Federal nao tem o nono digito do celular

- **Data:** 2026-08-08
- **Modulo(s):** [[prospeccao]]
- **Severidade:** alta
- **Descoberta por:** medicao do dado real na ingestao de Guarulhos (P2)

## Sintoma
A ingestao roda, os telefones passam na validacao de E.164 e o banco aceita tudo. Mas
`telefone_movel` fica `false` para a base inteira, e os numeros gravados simplesmente **nao
existem mais** — nao tocam, nao tem WhatsApp.

## Causa
Os Dados Abertos do CNPJ guardam o telefone como foi declarado no cadastro, e a maioria dos
cadastros e anterior a implantacao do nono digito (concluida em 2016). Ninguem migrou a base.

Medicao em Guarulhos, 3.038 estabelecimentos ativos do ICP:

| formato do `telefone_1` | quantidade |
|---|---|
| 9 digitos (movel atual) | **0** |
| 8 digitos iniciando em 6-9 (movel legado) | 1.090 |
| 8 digitos iniciando em 2-5 (fixo) | 1.910 |
| outro / vazio | 38 |

**Zero.** Uma heuristica de "movel = 9 digitos comecando em 9" — que e a regra correta para
numero moderno, e a que o resto do projeto usa — nunca dispara aqui. E como 36% da base e movel
legado, e justamente a parte abordavel por WhatsApp que se perde.

## Como evitar / resolver
Restaurar o nono digito na normalizacao, pelo plano de numeracao brasileiro:

- numero local de **8 digitos iniciando em 6-9** → movel pre-2016 → prefixar `9`
- numero local de **8 digitos iniciando em 2-5** → fixo → deixar como esta
- numero local de **9 digitos** → ja e movel atual (comeca em 9)

Implementado em `normalizarTelefoneRfb()` (`lib/prospeccao/normalize.ts`), que devolve
`nonoDigitoInferido` para o caso de algum dia ser preciso auditar quais numeros foram deduzidos.

## Regra geral que fica
**Dado publico brasileiro e um retrato do momento do cadastro, nao do presente.** Antes de
confiar em qualquer campo vindo de base governamental, medir a distribuicao real em vez de
assumir o formato atual — o mesmo vale para CEP sem hifen, CNAE com mascara, razao social com
`;` no meio e situacao cadastral defasada. Uma unica passada de contagem sobre o arquivo custa
segundos e evita construir em cima de um formato que nao existe no dado.

## Referencias
- `lib/prospeccao/normalize.ts` — `normalizarTelefoneRfb()`
- `tests/prospeccao-normalize.test.ts` — casos de movel legado e fixo
- Plano tecnico: `docs/architecture/prospeccao-icp-oficinas.md` §6.1
