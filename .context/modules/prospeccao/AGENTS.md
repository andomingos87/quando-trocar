# Modulo: prospeccao

Descoberta e qualificacao de oficinas candidatas ao ICP, segmentadas por Cidade/UF,
antes de virarem lead. E o topo do funil: termina onde o modulo [[whatsapp-bot]] comeca.

Plano tecnico completo: `docs/architecture/prospeccao-icp-oficinas.md`.

## Fronteiras

**Pertence a este modulo:**
- `lib/prospeccao/*` — fontes, parser, normalizacao, dedupe, persistencia.
- `scripts/prospeccao/*` — CLIs de download e ingestao (piloto, execucao local).
- Tabelas `prospeccao_areas`, `prospeccao_execucoes`, `prospeccao_estabelecimentos`.

**NAO pertence:**
- Criacao e conducao do lead — e de [[whatsapp-bot]] (`leads_oficina`) e do painel
  ([[painel-admin]]). Este modulo entrega candidatos aprovados; quem os transforma em
  lead e a acao humana na UI admin.
- Schema em si — migrations vivem em [[database]].

## Regras/invariantes do modulo

1. **A base persistente vem da Receita Federal, nao do Google.** Os Termos do Maps
   Platform permitem guardar `place_id` indefinidamente e lat/lng por ate 30 dias, e
   nada alem disso. Conteudo do Places (nome, telefone, endereco, rating) so pode
   viver em `places_cache`, que o cron `prospeccao-expirar-cache-places` limpa.
   **Nunca copiar campo de `places_cache` para coluna persistente.**
2. **Nada vira lead automaticamente.** A promocao a `leads_oficina` e ato humano,
   auditado. Vale a mesma logica da ADR-0001: o sistema (e o LLM, quando entrar em P6)
   sugere; a mudanca de estado comercial e deterministica e humana.
3. **Cruzar com o funil antes de prospectar.** Todo lote passa por
   `descartarJaConhecidos()` — abordar quem ja e lead ou cliente queima a relacao.
4. **Sinal fraco nao descarta.** Dedupe por CNPJ/place_id/telefone decide sozinho;
   similaridade de nome so levanta `suspeita` para revisao humana.
5. **Ingestao e idempotente.** Upsert por `cnpj`; reingerir a mesma competencia
   atualiza cadastro sem regredir `status`, `score_*` ou `lead_id`.
6. **Arquivos da RFB sao latin-1.** Ler como utf-8 corrompe todo nome com acento.
   `lerLinhasLatin1()` no script de ingestao existe por isso.
7. **A RFB nao tem o nono digito do celular.** Zero dos telefones vem com 9 digitos;
   36% sao moveis legados de 8. `normalizarTelefoneRfb()` restaura — sem isso o numero
   gravado nao existe mais. Ver [licao 0004](../../lessons/0004-rfb-nao-tem-o-nono-digito.md).
8. **CNAE principal fora do dominio automotivo nao entra** (salvo a lista-ponte em
   `cnaes.ts`). Transportadora e estacionamento com mecanica no secundario mantem a
   propria frota: sem cliente final, nao ha retorno para agendar.
9. **MEI nao tem razao social de verdade** — a RFB monta uma colando a raiz do CNPJ no
   nome da pessoa. `limparRazaoSocial()` remove o prefixo. Em Guarulhos isso afetava
   93% da base (5.027 dos 5.435 sao micro).
10. **Nada de `grep -F -f` com muitos padroes em script de shell.** O grep do macOS nao
    tem a otimizacao multi-padrao do GNU e trava. Usar `awk` com array associativo —
    ver [licao 0005](../../lessons/0005-bsd-grep-trava-com-muitos-padroes.md).

## Fluxo de trabalho

```bash
# 1. baixar e pre-filtrar estabelecimentos (~5,3 GB de download)
scripts/prospeccao/baixar-rfb.sh 2026-07 6477       # Guarulhos/SP

# 2. conferir o que seria gravado
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477 --dry-run

# 3. gravar (tambem escreve as raizes de CNPJ para o passo 4)
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477

# 4. enriquecer com razao social e porte (~1,3 GB, filtrado pelas raizes do passo 3)
scripts/prospeccao/baixar-rfb-empresas.sh 2026-07 6477
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477
```

O passo 4 repete o 3 de proposito: o upsert e idempotente e so complementa os campos
que faltavam. Rodar duas vezes nao duplica nem regride qualificacao.

**O passo 4 nao e opcional na pratica.** So 27% dos estabelecimentos tem nome fantasia
no arquivo de Estabelecimentos; a razao social dos outros 73% vive no de Empresas. Sem
ele a lista chega ao vendedor com "(sem nome)" em tres de cada quatro linhas.

O codigo do municipio e o da **RFB** (tabela `Municipios.zip`), nao o do IBGE —
Guarulhos e `6477`. Confundir os dois devolve o municipio errado em silencio.

## Estado atual

Implementado: P1 (schema, modulo) e P2 (fonte RFB, normalizacao, dedupe).
**Guarulhos/SP ingerida** (competencia 2026-07): 5.435 estabelecimentos, 98% com
telefone, 37,6% com movel, 95% com e-mail, 100% com nome.

Proximas fases em `docs/backlog-prospeccao/`: score ICP (Prospec-1), painel admin e
promocao a lead (Prospec-2), canal de e-mail (Prospec-3), Google Places (Prospec-4),
classificador LLM (Prospec-5).

## Testes

- `tests/prospeccao-rfb-parser.test.ts` — layout, CSV com `;` dentro de aspas, datas.
- `tests/prospeccao-normalize.test.ts` — telefone BR, nome canonico, endereco.
- `tests/prospeccao-icp.test.ts` — regra de CNAE, dedupe em cascata, colapso de lote.

## Referencias

- Plano tecnico: `docs/architecture/prospeccao-icp-oficinas.md`
- Layout dos arquivos da RFB: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
- Politica do Places: https://developers.google.com/maps/documentation/places/web-service/policies
- Modulos vizinhos: [[whatsapp-bot]], [[painel-admin]], [[database]]
